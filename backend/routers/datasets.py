"""
routers/datasets.py
--------------------
Handles dataset lifecycle:
  POST /api/datasets/upload   → upload file, run EDA, store report in Supabase
  GET  /api/datasets          → list all datasets for current user
  GET  /api/datasets/{id}/report → fetch the stored EDA report
  DELETE /api/datasets/{id}   → delete dataset row + stored file
"""

import json
import os
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from supabase import create_client

from auth import get_current_user, get_supabase
from services.eda import run_eda

router = APIRouter(prefix="/api/datasets", tags=["datasets"])

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


# ── Upload & EDA ──────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    """
    1. Validate file type & size
    2. Save to a temp file
    3. Run EDA pipeline (sync — fast enough for <50 MB)
    4. Upload original file to Supabase Storage
    5. Insert row into `datasets` table with report JSON
    6. Return Dataset object
    """
    # Validate extension
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file type '{suffix}'. Use CSV or Excel.",
        )

    # Read & size-check
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds the 50 MB limit.",
        )

    dataset_id = str(uuid.uuid4())
    original_name = file.filename or f"dataset{suffix}"
    storage_path = f"{user_id}/{dataset_id}{suffix}"

    supabase = get_supabase()

    # Run EDA on temp file
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        eda_result = run_eda(tmp_path, original_name)
    finally:
        os.unlink(tmp_path)

    # Upload raw file to Supabase Storage (bucket: "datasets")
    try:
        supabase.storage.from_("datasets").upload(
            path=storage_path,
            file=content,
            file_options={"content-type": "application/octet-stream"},
        )
    except Exception as e:
        # Non-fatal — just log it; the analysis is what matters
        print(f"[WARN] Storage upload failed: {e}")

    # Insert into `datasets` table
    row = {
        "id": dataset_id,
        "user_id": user_id,
        "name": original_name,
        "status": "ready",
        "rows": eda_result["total_rows"],
        "columns": eda_result["total_columns"],
        "health_score": eda_result["health_score"],
        "report": json.dumps(eda_result),       # store full report as JSONB
        "file_path": storage_path,
    }

    db_resp = supabase.table("datasets").insert(row).execute()
    if not db_resp.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save dataset to database.",
        )

    return {
        "id": dataset_id,
        "name": original_name,
        "status": "ready",
        "rows": eda_result["total_rows"],
        "columns": eda_result["total_columns"],
        "health_score": eda_result["health_score"],
        "created_at": db_resp.data[0].get("created_at", ""),
    }


# ── List datasets ─────────────────────────────────────────────────────────────

@router.get("")
async def list_datasets(user_id: str = Depends(get_current_user)):
    """Return all datasets owned by the current user (no report payload)."""
    supabase = get_supabase()
    resp = (
        supabase.table("datasets")
        .select("id, name, status, rows, columns, health_score, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return resp.data or []


# ── Get full report ───────────────────────────────────────────────────────────

@router.get("/{dataset_id}/report")
async def get_report(
    dataset_id: str,
    user_id: str = Depends(get_current_user),
):
    """Return the full EDA report JSON for a dataset."""
    supabase = get_supabase()
    resp = (
        supabase.table("datasets")
        .select("id, name, report")
        .eq("id", dataset_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    row = resp.data
    # `report` is stored as JSONB — Supabase returns it already parsed
    report_data = row["report"] if isinstance(row["report"], dict) else json.loads(row["report"])
    report_data["dataset_id"] = row["id"]
    report_data["dataset_name"] = row["name"]
    return report_data


# ── Delete dataset ────────────────────────────────────────────────────────────

@router.delete("/{dataset_id}")
async def delete_dataset(
    dataset_id: str,
    user_id: str = Depends(get_current_user),
):
    """Delete the dataset row and its stored file."""
    supabase = get_supabase()

    # Fetch to get file path
    resp = (
        supabase.table("datasets")
        .select("file_path")
        .eq("id", dataset_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    file_path = resp.data.get("file_path")

    # Delete from storage
    if file_path:
        try:
            supabase.storage.from_("datasets").remove([file_path])
        except Exception as e:
            print(f"[WARN] Storage delete failed: {e}")

    # Delete from DB (also cascades to chats via FK if configured)
    supabase.table("datasets").delete().eq("id", dataset_id).eq("user_id", user_id).execute()

    return {"ok": True}