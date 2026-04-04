"""
routers/recommendations.py
---------------------------
  GET /api/datasets/{id}/recommendations → ranked algo recommendations
"""

import json

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user, get_supabase
from services.algo_advisor import get_algo_recommendations

router = APIRouter(tags=["recommendations"])


@router.get("/api/datasets/{dataset_id}/recommendations")
async def recommendations(
    dataset_id: str,
    user_id: str = Depends(get_current_user),
):
    """Return algorithm recommendations based on the stored EDA report."""
    supabase = get_supabase()

    resp = (
        supabase.table("datasets")
        .select("report")
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

    return get_algo_recommendations(report)