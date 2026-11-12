"""
Backup and restore service for StudySpace.
Packages SQLite database and uploaded files into a portable ZIP archive.
"""
from pathlib import Path
import zipfile
import shutil
from datetime import datetime
from typing import Dict, Any, List
import os
from backend.config import DATA_DIR, UPLOADS_DIR, BACKUPS_DIR, DB_PATH
import logging

logger = logging.getLogger("studyspace.backup")

def create_backup() -> Path:
    """Creates a timestamped zip archive of the database and uploaded study files."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"studyspace_backup_{timestamp}.zip"
    backup_path = BACKUPS_DIR / backup_filename

    with zipfile.ZipFile(backup_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        # Include database if it exists
        if DB_PATH.is_file():
            zipf.write(DB_PATH, arcname="studyspace.db")

        # Include uploads
        if UPLOADS_DIR.is_dir():
            for root, _, files in os.walk(UPLOADS_DIR):
                for file in files:
                    file_full = Path(root) / file
                    arc_name = Path("uploads") / file_full.relative_to(UPLOADS_DIR)
                    zipf.write(file_full, arcname=str(arc_name))

    logger.info(f"Created backup archive at: {backup_path}")
    return backup_path

def restore_backup(zip_path: Path, confirm: bool = False) -> Dict[str, Any] if "Dict" in globals() else dict:
    """
    Restores the database and uploaded files from a backup archive.
    Requires explicit confirm=True.
    """
    if not confirm:
        raise ValueError("Confirmation required to restore backup. Existing data will be overwritten.")

    if not zip_path.is_file():
        raise FileNotFoundError(f"Backup file not found at {zip_path}")

    # Safety: create pre-restore snapshot
    pre_restore_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    pre_restore_path = BACKUPS_DIR / f"pre_restore_snapshot_{pre_restore_timestamp}.zip"
    try:
        create_backup()
    except Exception as e:
        logger.warning(f"Could not create safety snapshot before restore: {e}")

    # Extract archive
    temp_extract_dir = BACKUPS_DIR / f"temp_restore_{pre_restore_timestamp}"
    temp_extract_dir.mkdir(parents=True, exist_ok=True)

    try:
        with zipfile.ZipFile(zip_path, "r") as zipf:
            zipf.extractall(temp_extract_dir)

        # Replace database file
        extracted_db = temp_extract_dir / "studyspace.db"
        if extracted_db.is_file():
            shutil.copy2(extracted_db, DB_PATH)

        # Replace uploaded files
        extracted_uploads = temp_extract_dir / "uploads"
        if extracted_uploads.is_dir():
            for item in extracted_uploads.iterdir():
                dest = UPLOADS_DIR / item.name
                if item.is_file():
                    shutil.copy2(item, dest)
                elif item.is_dir():
                    shutil.copytree(item, dest, dirs_exist_ok=True)

        return {
            "success": True,
            "message": "Backup restored successfully. Please refresh the page.",
            "safety_snapshot": str(pre_restore_path.name)
        }
    finally:
        if temp_extract_dir.exists():
            shutil.rmtree(temp_extract_dir, ignore_errors=True)

def list_backups() -> list:
    """Lists available backup archives with metadata."""
    backups = []
    if not BACKUPS_DIR.is_dir():
        return []
    for file in sorted(BACKUPS_DIR.glob("*.zip"), key=lambda f: f.stat().st_mtime, reverse=True):
        stat = file.stat()
        backups.append({
            "filename": file.name,
            "size_bytes": stat.st_size,
            "size_mb": round(stat.st_size / (1024 * 1024), 2),
            "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
        })
    return backups
