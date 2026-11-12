"""
Health check and system diagnostics endpoint.
"""
from fastapi import APIRouter, Depends
import sqlite3
import os
from backend.database import get_db
from backend.config import settings, DATA_DIR
from backend.models.schemas import SystemHealthResponse

router = APIRouter(prefix="/api/health", tags=["Health"])

@router.get("", response_model=SystemHealthResponse)
def get_health(db: sqlite3.Connection = Depends(get_db)):
    """Returns application health, database connectivity, and AI configuration status."""
    db_connected = False
    total_materials = 0
    try:
        row = db.execute("SELECT COUNT(*) as count FROM materials").fetchone()
        total_materials = row["count"] if row else 0
        db_connected = True
    except Exception:
        db_connected = False

    # Calculate local storage size
    total_bytes = 0
    if DATA_DIR.exists():
        for root, _, files in os.walk(DATA_DIR):
            for f in files:
                total_bytes += os.path.getsize(os.path.join(root, f))
    size_mb = round(total_bytes / (1024 * 1024), 2)

    return SystemHealthResponse(
        status="healthy" if db_connected else "degraded",
        app_name=settings.APP_NAME,
        version=settings.VERSION,
        database_connected=db_connected,
        ai_configured=settings.is_ai_configured,
        ai_model=settings.AI_MODEL if settings.is_ai_configured else "Not configured",
        data_dir_size_mb=size_mb,
        total_materials=total_materials
    )
