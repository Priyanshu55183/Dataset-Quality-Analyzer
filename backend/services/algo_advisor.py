"""
services/algo_advisor.py
------------------------
Rule-based algorithm advisor. Analyses the EDA report and returns a
ranked list of AlgoRecommendation objects matching the frontend's type.

Decision logic:
  - Infers problem type (classification / regression / clustering) from the
    dataset shape and the most categorical-looking column.
  - Scores each algorithm against the dataset's profile.
  - Returns top 5 ranked by score.
"""

from typing import Any


# ── Algorithm catalogue ───────────────────────────────────────────────────────

ALGORITHMS = [
    # ── Classification ────────────────────────────────────────────────────────
    {
        "name": "Random Forest",
        "category": "Classification / Regression",
        "complexity": "medium",
        "pros": [
            "Handles missing values and outliers well",
            "Works on both classification and regression",
            "Provides feature importance out of the box",
            "Robust to overfitting with enough trees",
        ],
        "cons": [
            "Slower to train on very large datasets",
            "Less interpretable than a single decision tree",
            "Memory-intensive for large forests",
        ],
        "conditions": {
            "min_rows": 100,
            "handles_missing": True,
            "handles_outliers": True,
            "handles_imbalance": True,
            "scale_sensitive": False,
            "problem_types": ["classification", "regression"],
            "base_score": 80,
        },
    },
    {
        "name": "Gradient Boosting (XGBoost / LightGBM)",
        "category": "Classification / Regression",
        "complexity": "medium",
        "pros": [
            "State-of-the-art performance on tabular data",
            "Built-in handling of missing values (XGBoost)",
            "Fast with LightGBM for large datasets",
            "Supports class weights for imbalanced data",
        ],
        "cons": [
            "More hyperparameters to tune",
            "Can overfit on small datasets",
            "Less interpretable without SHAP values",
        ],
        "conditions": {
            "min_rows": 500,
            "handles_missing": True,
            "handles_outliers": True,
            "handles_imbalance": True,
            "scale_sensitive": False,
            "problem_types": ["classification", "regression"],
            "base_score": 90,
        },
    },
    {
        "name": "Logistic Regression",
        "category": "Classification",
        "complexity": "low",
        "pros": [
            "Fast to train and predict",
            "Highly interpretable — coefficients are meaningful",
            "Good baseline for binary classification",
            "Outputs calibrated probabilities",
        ],
        "cons": [
            "Assumes linear decision boundary",
            "Sensitive to outliers and unscaled features",
            "Struggles with non-linear relationships",
        ],
        "conditions": {
            "min_rows": 50,
            "handles_missing": False,
            "handles_outliers": False,
            "handles_imbalance": True,
            "scale_sensitive": True,
            "problem_types": ["classification"],
            "base_score": 70,
        },
    },
    {
        "name": "Support Vector Machine (SVM)",
        "category": "Classification",
        "complexity": "high",
        "pros": [
            "Effective in high-dimensional spaces",
            "Works well when classes are clearly separable",
            "Many kernel options (RBF, polynomial, linear)",
        ],
        "cons": [
            "Slow on datasets > 50k rows",
            "Requires feature scaling",
            "Sensitive to choice of kernel and C parameter",
        ],
        "conditions": {
            "min_rows": 50,
            "max_rows": 50_000,
            "handles_missing": False,
            "handles_outliers": False,
            "handles_imbalance": False,
            "scale_sensitive": True,
            "problem_types": ["classification"],
            "base_score": 65,
        },
    },
    {
        "name": "K-Nearest Neighbours (KNN)",
        "category": "Classification / Regression",
        "complexity": "low",
        "pros": [
            "No training phase — very simple to implement",
            "Naturally handles multi-class classification",
            "Good for small, clean datasets",
        ],
        "cons": [
            "Very slow at prediction on large datasets",
            "Sensitive to outliers and unscaled features",
            "Performance degrades in high dimensions",
        ],
        "conditions": {
            "min_rows": 10,
            "max_rows": 20_000,
            "handles_missing": False,
            "handles_outliers": False,
            "handles_imbalance": False,
            "scale_sensitive": True,
            "problem_types": ["classification", "regression"],
            "base_score": 55,
        },
    },
    {
        "name": "Decision Tree",
        "category": "Classification / Regression",
        "complexity": "low",
        "pros": [
            "Extremely interpretable — can be visualised as a tree",
            "No feature scaling needed",
            "Handles both numeric and categorical features",
        ],
        "cons": [
            "Prone to overfitting without pruning",
            "Unstable — small data changes can alter the tree",
            "Poor generalisation compared to ensemble methods",
        ],
        "conditions": {
            "min_rows": 50,
            "handles_missing": False,
            "handles_outliers": True,
            "handles_imbalance": False,
            "scale_sensitive": False,
            "problem_types": ["classification", "regression"],
            "base_score": 60,
        },
    },
    {
        "name": "Linear Regression / Ridge / Lasso",
        "category": "Regression",
        "complexity": "low",
        "pros": [
            "Fast and interpretable",
            "Lasso performs built-in feature selection",
            "Ridge handles multicollinearity well",
            "Excellent baseline for regression tasks",
        ],
        "cons": [
            "Assumes linear relationship with target",
            "Sensitive to outliers",
            "Requires feature scaling for Ridge/Lasso",
        ],
        "conditions": {
            "min_rows": 30,
            "handles_missing": False,
            "handles_outliers": False,
            "handles_imbalance": False,
            "scale_sensitive": True,
            "problem_types": ["regression"],
            "base_score": 72,
        },
    },
    {
        "name": "K-Means Clustering",
        "category": "Clustering (Unsupervised)",
        "complexity": "low",
        "pros": [
            "Simple and fast for large datasets",
            "Works well when clusters are roughly spherical",
            "Good for customer segmentation and grouping",
        ],
        "cons": [
            "Must specify number of clusters (k) in advance",
            "Sensitive to outliers and feature scaling",
            "Assumes clusters are convex and isotropic",
        ],
        "conditions": {
            "min_rows": 100,
            "handles_missing": False,
            "handles_outliers": False,
            "handles_imbalance": False,
            "scale_sensitive": True,
            "problem_types": ["clustering"],
            "base_score": 65,
        },
    },
    {
        "name": "Neural Network (MLP)",
        "category": "Classification / Regression",
        "complexity": "high",
        "pros": [
            "Can learn complex non-linear patterns",
            "Flexible architecture for many problem types",
            "Scales well with more data",
        ],
        "cons": [
            "Needs large amounts of data to generalise",
            "Slow to train; requires GPU for speed",
            "Difficult to interpret — 'black box'",
            "Many hyperparameters to tune",
        ],
        "conditions": {
            "min_rows": 5_000,
            "handles_missing": False,
            "handles_outliers": False,
            "handles_imbalance": True,
            "scale_sensitive": True,
            "problem_types": ["classification", "regression"],
            "base_score": 75,
        },
    },
    {
        "name": "Naive Bayes",
        "category": "Classification",
        "complexity": "low",
        "pros": [
            "Extremely fast training and prediction",
            "Works well on small datasets",
            "Handles high-dimensional data (e.g. text)",
        ],
        "cons": [
            "Assumes feature independence (often violated)",
            "Poor calibration of probabilities",
            "Struggles with correlated features",
        ],
        "conditions": {
            "min_rows": 20,
            "handles_missing": False,
            "handles_outliers": True,
            "handles_imbalance": False,
            "scale_sensitive": False,
            "problem_types": ["classification"],
            "base_score": 58,
        },
    },
]


# ── Problem type inference ────────────────────────────────────────────────────

def _infer_problem_type(report: dict[str, Any]) -> str:
    """
    Guess whether the task is classification, regression, or clustering.
    Logic:
      - If no column looks like a target (all numeric) → clustering
      - If the most categorical column has ≤ 20 unique values → classification
      - Otherwise → regression
    """
    cols = report.get("columns", [])
    total_rows = report.get("total_rows", 1)

    cat_cols = [
        c for c in cols
        if "top_values" in c  # categorical indicator from EDA
        and c.get("unique_count", 999) <= 20
    ]
    numeric_cols = [c for c in cols if "mean" in c]

    if not cat_cols and not numeric_cols:
        return "clustering"
    if cat_cols:
        return "classification"
    # All numeric → regression (or clustering if no obvious target)
    if len(numeric_cols) >= 5:
        return "regression"
    return "clustering"


# ── Scoring ───────────────────────────────────────────────────────────────────

def _score_algorithm(algo: dict, report: dict[str, Any], problem_type: str) -> int | None:
    """
    Return a 0-100 fit score for one algorithm, or None if inapplicable.
    """
    cond = algo["conditions"]
    total_rows = report.get("total_rows", 0)
    missing_pct = report.get("missing_pct", 0)
    outlier_count = report.get("outlier_count", 0)
    duplicate_rows = report.get("duplicate_rows", 0)
    has_imbalance = any("imbalance" in f.lower() for f in report.get("bias_flags", []))
    has_high_corr = any(abs(c["value"]) >= 0.85 for c in report.get("correlations", []))

    # Hard filters
    if problem_type not in cond["problem_types"]:
        return None
    if total_rows < cond.get("min_rows", 0):
        return None
    if "max_rows" in cond and total_rows > cond["max_rows"]:
        return None

    score = cond["base_score"]

    # Missing data
    if missing_pct > 5 and not cond["handles_missing"]:
        score -= 15
    elif missing_pct > 15 and not cond["handles_missing"]:
        score -= 25

    # Outliers
    outlier_pct = outlier_count / total_rows * 100 if total_rows > 0 else 0
    if outlier_pct > 5 and not cond["handles_outliers"]:
        score -= 10

    # Class imbalance
    if has_imbalance and not cond["handles_imbalance"]:
        score -= 12

    # Feature scaling sensitivity
    if cond["scale_sensitive"] and outlier_pct > 3:
        score -= 8  # outliers hurt scaled algos more

    # Multicollinearity
    if has_high_corr and algo["name"].startswith("Logistic"):
        score -= 10

    # Dataset size bonuses
    if total_rows > 100_000 and "Gradient" in algo["name"]:
        score += 8
    if total_rows < 1_000 and algo["complexity"] == "low":
        score += 5
    if total_rows > 500_000 and algo["complexity"] == "high":
        score -= 10  # neural net needs GPU

    # Duplicate rows penalty (data quality)
    dup_pct = duplicate_rows / total_rows * 100 if total_rows > 0 else 0
    if dup_pct > 5:
        score -= 5

    return max(0, min(100, score))


# ── Public entry point ────────────────────────────────────────────────────────

def get_algo_recommendations(report: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Score all algorithms against the report and return the top 5 as dicts
    matching the frontend AlgoRecommendation type.
    """
    problem_type = _infer_problem_type(report)

    scored = []
    for algo in ALGORITHMS:
        score = _score_algorithm(algo, report, problem_type)
        if score is None:
            continue
        scored.append({
            "name": algo["name"],
            "category": algo["category"],
            "complexity": algo["complexity"],
            "score": score,
            "pros": algo["pros"],
            "cons": algo["cons"],
            "reason": _build_reason(algo, report, problem_type, score),
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:5]


def _build_reason(
    algo: dict,
    report: dict[str, Any],
    problem_type: str,
    score: int,
) -> str:
    """Write a 1-2 sentence explanation for why this algorithm was recommended."""
    total_rows = report.get("total_rows", 0)
    missing_pct = report.get("missing_pct", 0)
    cond = algo["conditions"]

    parts = [f"Recommended for a {problem_type} task with {total_rows:,} rows."]

    if cond["handles_missing"] and missing_pct > 5:
        parts.append(f"Handles the {missing_pct:.1f}% missing data natively.")
    if not cond["scale_sensitive"]:
        parts.append("Does not require feature scaling.")
    if score >= 85:
        parts.append("Strong fit for this dataset's profile.")
    elif score >= 70:
        parts.append("Good fit with minor preprocessing recommended.")
    else:
        parts.append("Usable but consider addressing data quality issues first.")

    return " ".join(parts)