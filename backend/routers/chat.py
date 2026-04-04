"""
routers/chat.py
----------------
  POST /api/datasets/{id}/chat         → answer a question about the dataset
  GET  /api/datasets/{id}/chat/history → return past messages

NOTE: This is a rule-based stub that answers from the stored report.
      Replace the _answer() function with your LlamaIndex + Grok RAG
      implementation when you build the AI assistant feature.
"""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user, get_supabase

router = APIRouter(tags=["chat"])


class ChatRequest(BaseModel):
    question: str


# ── Simple rule-based answerer (replace with RAG later) ───────────────────────

def _answer_from_report(question: str, report: dict) -> str:
    """
    Generate a plain-text answer from the EDA report.
    This is a smart stub — it matches question keywords to report sections.
    Replace with LlamaIndex + Grok for full RAG.
    """
    q = question.lower()
    name = report.get("dataset_name", "this dataset")
    rows = report.get("total_rows", 0)
    cols = report.get("total_columns", 0)
    missing_pct = report.get("missing_pct", 0)
    dup = report.get("duplicate_rows", 0)
    outliers = report.get("outlier_count", 0)
    score = report.get("health_score", 0)
    recs = report.get("recommendations", [])
    bias = report.get("bias_flags", [])
    columns = report.get("columns", [])
    dropped = report.get("dropped_columns", [])

    if any(k in q for k in ["health", "score", "quality", "overall"]):
        verdict = "high" if score >= 80 else "moderate" if score >= 60 else "poor"
        return (
            f"The dataset '{name}' has a health score of {score}/100, indicating {verdict} overall quality. "
            f"It contains {rows:,} rows and {cols} columns. "
            f"Missing data is {missing_pct:.1f}%, there are {dup:,} duplicate rows, "
            f"and {outliers:,} outlier values were detected across numeric columns."
        )

    if any(k in q for k in ["missing", "null", "empty", "nan"]):
        worst = sorted(columns, key=lambda c: c.get("missing_pct", 0), reverse=True)[:3]
        col_list = ", ".join(f"'{c['name']}' ({c['missing_pct']:.1f}%)" for c in worst if c.get("missing_pct", 0) > 0)
        if col_list:
            return (
                f"Overall, {missing_pct:.1f}% of cells are missing. "
                f"The columns with the most missing data are: {col_list}. "
                f"Consider median imputation for numeric columns and mode/unknown-category for categorical ones."
            )
        return f"Overall missing data is {missing_pct:.1f}%, which is within acceptable limits."

    if any(k in q for k in ["duplicate", "repeat"]):
        if dup == 0:
            return "No duplicate rows were found in this dataset."
        return (
            f"{dup:,} duplicate rows were detected ({dup/rows*100:.1f}% of total). "
            f"Remove them before training to prevent data leakage and inflated accuracy metrics."
        )

    if any(k in q for k in ["outlier", "anomal"]):
        if outliers == 0:
            return "No significant outliers were detected in numeric columns."
        worst = sorted(
            [c for c in columns if c.get("outlier_pct", 0) > 0],
            key=lambda c: c.get("outlier_pct", 0), reverse=True
        )[:3]
        col_list = ", ".join(f"'{c['name']}' ({c.get('outlier_pct',0):.1f}%)" for c in worst)
        return (
            f"{outliers:,} outlier values were detected. "
            f"Columns most affected: {col_list}. "
            f"Use IQR capping (clip to 1st/99th percentile) or RobustScaler before training."
        )

    if any(k in q for k in ["bias", "imbalance", "fair"]):
        if not bias:
            return "No significant bias or class imbalance was detected in this dataset."
        return "Bias flags detected:\n" + "\n".join(f"• {f}" for f in bias[:5])

    if any(k in q for k in ["recommend", "suggest", "action", "fix", "improve", "next step"]):
        if recs:
            return "Here are the top recommendations for this dataset:\n" + "\n".join(f"{i+1}. {r}" for i, r in enumerate(recs[:5]))
        return "No critical issues — the dataset appears ready for feature engineering."

    if any(k in q for k in ["column", "feature", "field"]):
        numeric = [c["name"] for c in columns if "mean" in c]
        categorical = [c["name"] for c in columns if "top_values" in c]
        return (
            f"The dataset has {len(columns)} columns after cleaning. "
            f"Numeric columns ({len(numeric)}): {', '.join(numeric[:8])}{'…' if len(numeric) > 8 else ''}. "
            f"Categorical columns ({len(categorical)}): {', '.join(categorical[:8])}{'…' if len(categorical) > 8 else ''}."
        )

    if any(k in q for k in ["drop", "remov", "exclud"]):
        if not dropped:
            return "No columns were dropped. All columns had acceptable missing data rates."
        return "Dropped columns and reasons:\n" + "\n".join(f"• '{d['name']}': {d['reason']}" for d in dropped)

    if any(k in q for k in ["classif", "regression", "algorithm", "model", "ml"]):
        return (
            f"Based on the dataset profile ({rows:,} rows, {cols} columns, {missing_pct:.1f}% missing), "
            f"I recommend switching to the 'Algo Advisor' tab for a full ranked list of algorithms "
            f"with explanations tailored to this dataset."
        )

    if any(k in q for k in ["correlat"]):
        corrs = report.get("correlations", [])
        if not corrs:
            return "No significant correlations were found between numeric columns."
        top = corrs[:3]
        pairs = "; ".join(f"{c['col1']} ↔ {c['col2']} (r={c['value']:.3f})" for c in top)
        return (
            f"Top correlations found: {pairs}. "
            f"Strong correlations (|r| > 0.85) may cause multicollinearity in linear models — "
            f"consider dropping one column from each highly-correlated pair."
        )

    # Default fallback
    return (
        f"The dataset '{name}' has {rows:,} rows, {cols} columns, and a health score of {score}/100. "
        f"You can ask me about: missing data, duplicates, outliers, correlations, bias flags, "
        f"dropped columns, or recommendations."
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/api/datasets/{dataset_id}/chat")
async def chat(
    dataset_id: str,
    body: ChatRequest,
    user_id: str = Depends(get_current_user),
):
    """Answer a question grounded in the dataset's EDA report."""
    supabase = get_supabase()

    # Load report
    resp = (
        supabase.table("datasets")
        .select("report, name")
        .eq("id", dataset_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    report = resp.data["report"]
    if isinstance(report, str):
        report = json.loads(report)
    report["dataset_name"] = resp.data["name"]

    answer = _answer_from_report(body.question, report)

    # Persist both messages to `chats` table
    now = datetime.now(timezone.utc).isoformat()
    supabase.table("chats").insert([
        {
            "id": str(uuid.uuid4()),
            "dataset_id": dataset_id,
            "user_id": user_id,
            "role": "user",
            "content": body.question,
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "dataset_id": dataset_id,
            "user_id": user_id,
            "role": "assistant",
            "content": answer,
            "created_at": now,
            "sources": ["EDA Report"],
        },
    ]).execute()

    return {"answer": answer, "sources": ["EDA Report"]}


@router.get("/api/datasets/{dataset_id}/chat/history")
async def chat_history(
    dataset_id: str,
    user_id: str = Depends(get_current_user),
):
    """Return all past chat messages for a dataset."""
    supabase = get_supabase()
    resp = (
        supabase.table("chats")
        .select("id, role, content, created_at, sources")
        .eq("dataset_id", dataset_id)
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
    )
    return resp.data or []