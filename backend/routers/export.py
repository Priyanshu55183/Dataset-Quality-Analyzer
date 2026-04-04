"""
routers/export.py
------------------
  POST /api/datasets/{id}/export/pdf  → generate PDF, store in Supabase, return file_id
  GET  /api/downloads/{file_id}       → stream the stored PDF to the browser
"""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import io

from auth import get_current_user, get_supabase
from services.pdf_generator import generate_pdf
from services.algo_advisor import get_algo_recommendations

router = APIRouter(tags=["export"])


# ── Generate PDF ──────────────────────────────────────────────────────────────

@router.post("/api/datasets/{dataset_id}/export/pdf")
async def export_pdf(
    dataset_id: str,
    user_id: str = Depends(get_current_user),
):
    """
    1. Load EDA report from DB
    2. Compute algo recommendations
    3. Render PDF via Jinja2 + WeasyPrint
    4. Upload PDF to Supabase Storage (bucket: "reports")
    5. Return { file_id }
    """
    supabase = get_supabase()

    # Load report
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
    report = row["report"] if isinstance(row["report"], dict) else json.loads(row["report"])
    report["dataset_id"] = row["id"]
    report["dataset_name"] = row["name"]

    # Get algo recommendations
    algos = get_algo_recommendations(report)

    # Generate PDF bytes
    try:
        pdf_bytes = generate_pdf(report, algos)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"PDF generation failed: {str(e)}",
        )

    # Upload to Supabase Storage (bucket: "reports")
    file_id = str(uuid.uuid4())
    storage_path = f"{user_id}/{file_id}.pdf"

    try:
        supabase.storage.from_("reports").upload(
            path=storage_path,
            file=pdf_bytes,
            file_options={"content-type": "application/pdf"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store PDF: {str(e)}")

    # Persist file_id in DB so the download endpoint can find it
    supabase.table("exports").insert({
        "id": file_id,
        "user_id": user_id,
        "dataset_id": dataset_id,
        "storage_path": storage_path,
    }).execute()

    return {"file_id": file_id}


# ── Download PDF ──────────────────────────────────────────────────────────────

@router.get("/api/downloads/{file_id}")
async def download_file(
    file_id: str,
    user_id: str = Depends(get_current_user),
):
    """
    Stream the stored PDF back to the browser.
    Checks that the file belongs to the requesting user.
    """
    supabase = get_supabase()

    # Look up storage path
    resp = (
        supabase.table("exports")
        .select("storage_path, dataset_id")
        .eq("id", file_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="File not found.")

    storage_path = resp.data["storage_path"]

    # Download from Supabase Storage
    try:
        file_bytes: bytes = supabase.storage.from_("reports").download(storage_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="datalens-report-{file_id[:8]}.pdf"'
        },
    )