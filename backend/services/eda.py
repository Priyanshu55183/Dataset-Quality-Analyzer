"""
services/eda.py
---------------
Core EDA pipeline. Given a file path (CSV or Excel) it returns a fully
populated report dict that matches the frontend's Report TypeScript type.

Key analyses performed:
  - Missing value detection (per column + overall)
  - Duplicate row detection
  - Outlier detection via IQR (per numeric column)
  - Correlation matrix (top pairs)
  - Class imbalance detection
  - Bias flag generation (skewed distributions, high-cardinality, etc.)
  - Natural-language recommendations
  - Dropped-column log with reasons
  - Data health score (0-100)
"""

import math
from pathlib import Path
from typing import Any

import numpy as np
import polars as pl
from scipy import stats as scipy_stats


# ── Thresholds (tweak these to tune sensitivity) ─────────────────────────────
MISSING_DROP_THRESH = 0.60        # drop col if >60 % missing
HIGH_CARDINALITY_RATIO = 0.95     # flag as ID-like if unique/total > 95 %
CLASS_IMBALANCE_RATIO = 4.0       # flag if majority/minority class ratio > 4×
OUTLIER_IQR_FACTOR = 1.5          # standard IQR fence
CORR_HIGH_THRESH = 0.85           # flag strong correlation
MISSING_WARN_THRESH = 0.05        # warn at 5 % missing per column


def load_dataframe(file_path: str) -> pl.DataFrame:
    """Load CSV or Excel file into a Polars DataFrame."""
    path = Path(file_path)
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pl.read_csv(path, infer_schema_length=10_000, ignore_errors=True)
    elif suffix in (".xlsx", ".xls"):
        import pandas as pd
        pdf = pd.read_excel(path)
        return pl.from_pandas(pdf)
    else:
        raise ValueError(f"Unsupported file type: {suffix}")


def _iqr_outliers(series: pl.Series) -> tuple[int, float]:
    """Return (count, pct) of outliers using IQR fences."""
    vals = series.drop_nulls().to_numpy().astype(float)
    if len(vals) < 4:
        return 0, 0.0
    q1, q3 = np.percentile(vals, 25), np.percentile(vals, 75)
    iqr = q3 - q1
    if iqr == 0:
        return 0, 0.0
    fence_lo = q1 - OUTLIER_IQR_FACTOR * iqr
    fence_hi = q3 + OUTLIER_IQR_FACTOR * iqr
    count = int(np.sum((vals < fence_lo) | (vals > fence_hi)))
    pct = round(count / len(vals) * 100, 2)
    return count, pct


def _profile_column(col_name: str, series: pl.Series, total_rows: int) -> dict[str, Any]:
    """Build a ColumnProfile dict for one column."""
    null_count = series.null_count()
    missing_pct = round(null_count / total_rows * 100, 2) if total_rows > 0 else 0.0
    unique_count = series.n_unique()

    profile: dict[str, Any] = {
        "name": col_name,
        "dtype": str(series.dtype),
        "missing_pct": missing_pct,
        "unique_count": unique_count,
    }

    is_numeric = series.dtype in (
        pl.Int8, pl.Int16, pl.Int32, pl.Int64,
        pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64,
        pl.Float32, pl.Float64,
    )

    if is_numeric:
        clean = series.drop_nulls()
        if len(clean) > 0:
            arr = clean.to_numpy().astype(float)
            profile["mean"] = round(float(np.mean(arr)), 6)
            profile["std"] = round(float(np.std(arr)), 6)
            profile["min"] = round(float(np.min(arr)), 6)
            profile["max"] = round(float(np.max(arr)), 6)
            outlier_count, outlier_pct = _iqr_outliers(series)
            profile["outlier_pct"] = outlier_pct
            profile["outlier_count"] = outlier_count
    else:
        # Categorical: compute top value frequencies
        vc = series.drop_nulls().value_counts().sort("count", descending=True).head(10)
        profile["top_values"] = {
            str(row[col_name]): int(row["count"])
            for row in vc.iter_rows(named=True)
        }

    return profile


def _compute_correlations(df: pl.DataFrame) -> list[dict[str, Any]]:
    """Compute pairwise Pearson correlations for numeric columns."""
    numeric_cols = [
        c for c in df.columns
        if df[c].dtype in (
            pl.Int8, pl.Int16, pl.Int32, pl.Int64,
            pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64,
            pl.Float32, pl.Float64,
        )
    ]
    if len(numeric_cols) < 2:
        return []

    pdf = df.select(numeric_cols).to_pandas().dropna()
    corr_pairs = []
    for i, c1 in enumerate(numeric_cols):
        for c2 in numeric_cols[i + 1:]:
            if pdf[c1].std() == 0 or pdf[c2].std() == 0:
                continue
            r, _ = scipy_stats.pearsonr(pdf[c1], pdf[c2])
            if not math.isnan(r):
                corr_pairs.append({"col1": c1, "col2": c2, "value": round(r, 4)})

    corr_pairs.sort(key=lambda x: abs(x["value"]), reverse=True)
    return corr_pairs[:30]


def _detect_class_imbalance(df: pl.DataFrame) -> list[str]:
    """Check categorical columns for severe class imbalance."""
    flags = []
    total = len(df)
    for col in df.columns:
        if df[col].dtype not in (pl.Utf8, pl.String, pl.Categorical, pl.Boolean):
            continue
        vc = df[col].drop_nulls().value_counts().sort("count", descending=True)
        if len(vc) < 2:
            continue
        counts = vc["count"].to_list()
        ratio = counts[0] / counts[-1] if counts[-1] > 0 else float("inf")
        pct_majority = round(counts[0] / total * 100, 1)
        if ratio >= CLASS_IMBALANCE_RATIO:
            flags.append(
                f"Column '{col}' has severe class imbalance: "
                f"the dominant class represents {pct_majority}% of rows "
                f"(imbalance ratio {ratio:.1f}×). "
                f"Consider oversampling (SMOTE) or class weighting before classification."
            )
    return flags


def _generate_bias_flags(
    df: pl.DataFrame,
    column_profiles: list[dict],
    dropped_columns: list[dict],
    correlations: list[dict],
) -> list[str]:
    """Generate human-readable bias / data-quality flag strings."""
    flags = []
    total = len(df)

    for prof in column_profiles:
        name = prof["name"]

        # High-cardinality (likely ID/key column)
        if prof["unique_count"] / total > HIGH_CARDINALITY_RATIO:
            flags.append(
                f"Column '{name}' has very high cardinality "
                f"({prof['unique_count']:,} unique values out of {total:,} rows). "
                f"This looks like an ID or key column — exclude it from model features."
            )

        # Significant missing data (not severe enough to drop)
        mp = prof.get("missing_pct", 0)
        if MISSING_WARN_THRESH * 100 < mp < MISSING_DROP_THRESH * 100:
            flags.append(
                f"Column '{name}' is {mp:.1f}% missing. "
                f"Consider imputation (median for numeric, mode or 'Unknown' for categorical) "
                f"before modeling."
            )

        # Numeric columns with extreme skew
        if "std" in prof and "mean" in prof and prof["std"] > 0:
            if abs(prof["mean"]) > 0:
                cv = prof["std"] / abs(prof["mean"])
                if cv > 3:
                    flags.append(
                        f"Column '{name}' has very high coefficient of variation ({cv:.1f}). "
                        f"The distribution is highly spread — consider log or box-cox transform."
                    )

        # High outlier percentage
        if prof.get("outlier_pct", 0) > 10:
            flags.append(
                f"Column '{name}' has {prof['outlier_pct']:.1f}% outliers (IQR method). "
                f"Inspect these rows — they may be data entry errors or genuine anomalies."
            )

    # Strong correlations → multicollinearity warning
    for corr in correlations:
        if abs(corr["value"]) >= CORR_HIGH_THRESH:
            flags.append(
                f"Columns '{corr['col1']}' and '{corr['col2']}' are highly correlated "
                f"(r = {corr['value']:.3f}). "
                f"Consider removing one to reduce multicollinearity in linear models."
            )

    # Class imbalance
    flags.extend(_detect_class_imbalance(df))

    return flags


def _generate_recommendations(
    total_rows: int,
    missing_pct: float,
    duplicate_rows: int,
    outlier_count: int,
    dropped_columns: list[dict],
    bias_flags: list[str],
    correlations: list[dict],
    column_profiles: list[dict],
) -> list[str]:
    """Generate a prioritised list of plain-English action items."""
    recs = []

    if duplicate_rows > 0:
        recs.append(
            f"Remove {duplicate_rows:,} duplicate rows before modeling — "
            f"they can artificially inflate accuracy metrics."
        )

    if missing_pct > 2:
        recs.append(
            f"Overall missing data is {missing_pct:.1f}%. "
            f"For numeric columns use median imputation; "
            f"for categorical columns use mode or a dedicated 'Missing' category."
        )

    if dropped_columns:
        names = ", ".join(f"'{d['name']}'" for d in dropped_columns)
        recs.append(
            f"Columns {names} were automatically excluded due to excessive missing data (>60%). "
            f"Review whether these can be recovered from another data source."
        )

    high_corr = [c for c in correlations if abs(c["value"]) >= CORR_HIGH_THRESH]
    if high_corr:
        pairs = "; ".join(f"{c['col1']} ↔ {c['col2']} ({c['value']:.2f})" for c in high_corr[:3])
        recs.append(
            f"Highly correlated feature pairs detected: {pairs}. "
            f"Drop one from each pair or apply PCA to reduce redundancy."
        )

    outlier_cols = [p for p in column_profiles if p.get("outlier_pct", 0) > 5]
    if outlier_cols:
        names_o = ", ".join(f"'{p['name']}'" for p in outlier_cols[:4])
        recs.append(
            f"Columns {names_o} contain more than 5% outliers. "
            f"Use RobustScaler instead of StandardScaler, or cap values at the 1st/99th percentile."
        )

    if total_rows < 1000:
        recs.append(
            f"The dataset has only {total_rows:,} rows. "
            f"Models may overfit — prefer simpler algorithms (Logistic Regression, Decision Tree) "
            f"and use cross-validation."
        )
    elif total_rows > 500_000:
        recs.append(
            f"Large dataset ({total_rows:,} rows). "
            f"Consider mini-batch training or tree-based methods like XGBoost / LightGBM "
            f"that handle large data efficiently."
        )

    if not recs:
        recs.append(
            "No critical issues found. The dataset appears ready for feature engineering and modeling."
        )

    return recs


def _compute_health_score(
    missing_pct: float,
    duplicate_rows: int,
    total_rows: int,
    outlier_count: int,
    dropped_col_count: int,
    bias_flag_count: int,
) -> int:
    """
    Composite 0-100 score. Higher = better quality.
    Deductions are capped so score never goes below 10.
    """
    score = 100.0

    # Missing data (up to -25)
    score -= min(25, missing_pct * 2)

    # Duplicates (up to -20)
    dup_pct = duplicate_rows / total_rows * 100 if total_rows > 0 else 0
    score -= min(20, dup_pct * 4)

    # Outliers (up to -15)
    outlier_pct = outlier_count / total_rows * 100 if total_rows > 0 else 0
    score -= min(15, outlier_pct * 1.5)

    # Dropped columns (up to -20, each col costs 5)
    score -= min(20, dropped_col_count * 5)

    # Bias flags (up to -20, each flag costs 4)
    score -= min(20, bias_flag_count * 4)

    return max(10, round(score))


# ── Public entry point ────────────────────────────────────────────────────────

def run_eda(file_path: str, dataset_name: str) -> dict[str, Any]:
    """
    Run the full EDA pipeline and return a report dict that matches the
    frontend's Report TypeScript interface.
    """
    df = load_dataframe(file_path)
    total_rows, total_columns_raw = df.shape

    # ── Step 1: Drop columns with excessive missing data ──────────────────────
    dropped_columns: list[dict] = []
    cols_to_keep = []
    for col in df.columns:
        missing_ratio = df[col].null_count() / total_rows if total_rows > 0 else 0
        if missing_ratio > MISSING_DROP_THRESH:
            dropped_columns.append({
                "name": col,
                "reason": (
                    f"Dropped: {missing_ratio * 100:.1f}% of values are missing "
                    f"(threshold is {MISSING_DROP_THRESH * 100:.0f}%). "
                    f"A column with this much missing data adds noise rather than signal."
                ),
            })
        else:
            cols_to_keep.append(col)

    df = df.select(cols_to_keep)
    total_columns = len(cols_to_keep)

    # ── Step 2: Duplicate rows ────────────────────────────────────────────────
    duplicate_rows = total_rows - df.unique().shape[0]

    # ── Step 3: Per-column profiles ───────────────────────────────────────────
    column_profiles = [
        _profile_column(col, df[col], total_rows)
        for col in df.columns
    ]

    # ── Step 4: Overall missing stats ────────────────────────────────────────
    total_cells = total_rows * total_columns
    missing_cells = int(sum(p["missing_pct"] / 100 * total_rows for p in column_profiles))
    missing_pct = round(missing_cells / total_cells * 100, 2) if total_cells > 0 else 0.0

    # ── Step 5: Total outlier count ───────────────────────────────────────────
    outlier_count = int(sum(p.get("outlier_count", 0) for p in column_profiles))

    # ── Step 6: Correlations ──────────────────────────────────────────────────
    correlations = _compute_correlations(df)

    # ── Step 7: Bias flags ────────────────────────────────────────────────────
    bias_flags = _generate_bias_flags(df, column_profiles, dropped_columns, correlations)

    # ── Step 8: Recommendations ───────────────────────────────────────────────
    recommendations = _generate_recommendations(
        total_rows, missing_pct, duplicate_rows, outlier_count,
        dropped_columns, bias_flags, correlations, column_profiles,
    )

    # ── Step 9: Health score ─────────────────────────────────────────────────
    health_score = _compute_health_score(
        missing_pct, duplicate_rows, total_rows,
        outlier_count, len(dropped_columns), len(bias_flags),
    )

    # ── Step 10: Sub-scores ───────────────────────────────────────────────────
    completeness_score = round(max(0, 100 - missing_pct * 2), 1)
    consistency_score = round(max(0, 100 - (duplicate_rows / total_rows * 100 * 4)), 1) if total_rows else 100.0
    noise_score = round(max(0, 100 - (outlier_count / total_rows * 100 * 1.5)), 1) if total_rows else 100.0

    return {
        "health_score": health_score,
        "total_rows": total_rows,
        "total_columns": total_columns,
        "missing_cells": missing_cells,
        "missing_pct": missing_pct,
        "duplicate_rows": duplicate_rows,
        "outlier_count": outlier_count,
        "completeness_score": completeness_score,
        "consistency_score": consistency_score,
        "noise_score": noise_score,
        "columns": column_profiles,
        "correlations": correlations,
        "bias_flags": bias_flags,
        "recommendations": recommendations,
        "dropped_columns": dropped_columns,
    }