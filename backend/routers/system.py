"""
System management, settings, backup and restore router.
Allows local data backup/restore and runtime AI key configuration.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
import os
import shutil

from backend.config import settings, BACKUPS_DIR
from backend.services.backup_service import create_backup, restore_backup, list_backups
from backend.database import get_db
from backend.models.schemas import StatusResponse

router = APIRouter(prefix="/api/system", tags=["System"])

class AIConfigUpdate(BaseModel):
    api_key: str
    base_url: Optional[str] = None
    model: Optional[str] = None

class RestoreRequest(BaseModel):
    filename: str
    confirm: bool

@router.get("/backups")
def get_backups():
    """Lists existing local backup archives."""
    return list_backups()

@router.post("/backup", response_model=StatusResponse)
def trigger_backup():
    """Creates an instant local ZIP backup of the database and uploaded study files."""
    try:
        backup_path = create_backup()
        return StatusResponse(
            success=True,
            message=f"Backup archive created successfully ({backup_path.name})",
            data={"filename": backup_path.name}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup creation failed: {str(e)}")

@router.post("/restore", response_model=StatusResponse)
def trigger_restore(req: RestoreRequest):
    """Restores database and study files from an existing backup with explicit confirmation."""
    if not req.confirm:
        raise HTTPException(status_code=400, detail="Explicit confirmation required to restore data.")

    target_zip = BACKUPS_DIR / req.filename
    if not target_zip.is_file():
        raise HTTPException(status_code=404, detail="Selected backup archive not found.")

    try:
        res = restore_backup(target_zip, confirm=True)
        return StatusResponse(success=True, message=res["message"], data=res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")

@router.get("/backup/{filename}/download")
def download_backup_file(filename: str):
    """Downloads a backup ZIP archive."""
    target_zip = BACKUPS_DIR / filename
    if not target_zip.is_file():
        raise HTTPException(status_code=404, detail="Backup file not found")

    return FileResponse(
        path=str(target_zip),
        filename=filename,
        media_type="application/zip"
    )

@router.post("/ai-config", response_model=StatusResponse)
def update_ai_settings(config: AIConfigUpdate, db = Depends(get_db)):
    """Updates runtime AI credentials and persists them in SQLite."""
    key = config.api_key.strip()
    base_url = config.base_url.strip() if config.base_url else ""
    model = config.model.strip() if config.model else ""

    # Smart auto-detection for Google Gemini keys (starts with AQ. or AIza)
    if key and (key.startswith("AQ.") or key.startswith("AIza")):
        if not base_url or "api.openai.com" in base_url:
            base_url = "https://generativelanguage.googleapis.com/v1beta/openai"
        if not model or model == "gpt-4o-mini":
            model = "gemini-flash-lite-latest"
    else:
        if not base_url:
            base_url = "https://api.openai.com/v1"
        if not model:
            model = "gpt-4o-mini"

    # Store in settings table
    db.execute("INSERT OR REPLACE INTO settings_kv (key, value) VALUES ('AI_API_KEY', ?)", (key,))
    db.execute("INSERT OR REPLACE INTO settings_kv (key, value) VALUES ('AI_BASE_URL', ?)", (base_url,))
    db.execute("INSERT OR REPLACE INTO settings_kv (key, value) VALUES ('AI_MODEL', ?)", (model,))

    # Update in-memory settings
    settings.AI_API_KEY = key
    settings.AI_BASE_URL = base_url
    settings.AI_MODEL = model

    return StatusResponse(
        success=True,
        message="AI settings updated successfully",
        data={"is_configured": bool(key), "model": model}
    )
