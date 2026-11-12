"""
Materials management endpoints.
Handles local file uploads, URL imports, reading room data, bookmarks, and metadata updates.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
import sqlite3
from typing import List, Optional
from datetime import datetime
from pathlib import Path
import uuid
import os

from backend.database import get_db, sync_fts_entry, delete_fts_entry
from backend.config import settings, UPLOADS_DIR
from backend.services.extractor import extract_content
from backend.services.web_importer import extract_from_url
from backend.models.schemas import (
    MaterialResponse, MaterialDetailResponse, MaterialSectionResponse,
    MaterialImportUrlRequest, MaterialUpdate, BookmarkCreate, BookmarkResponse,
    StatusResponse
)

router = APIRouter(prefix="/api/materials", tags=["Materials"])

@router.get("", response_model=List[MaterialResponse])
def list_materials(
    search: Optional[str] = None,
    subject_id: Optional[int] = None,
    topic_id: Optional[int] = None,
    source_type: Optional[str] = None,
    is_favorite: Optional[bool] = None,
    sort_by: str = "recent",  # 'recent', 'opened', 'title'
    db: sqlite3.Connection = Depends(get_db)
):
    """Lists study materials with filtering, search, and sorting."""
    sql = """
        SELECT m.*, s.name as subject_name, c.name as chapter_name, t.name as topic_name,
               (SELECT COUNT(*) FROM material_sections WHERE material_id = m.id) as sections_count
        FROM materials m
        LEFT JOIN subjects s ON m.subject_id = s.id
        LEFT JOIN chapters c ON m.chapter_id = c.id
        LEFT JOIN topics t ON m.topic_id = t.id
        WHERE 1=1
    """
    params = []

    if search:
        search_term = f"%{search.strip()}%"
        sql += """ AND (
            m.title LIKE ? 
            OR m.tags LIKE ? 
            OR m.summary LIKE ? 
            OR s.name LIKE ? 
            OR c.name LIKE ? 
            OR t.name LIKE ?
            OR EXISTS (SELECT 1 FROM material_sections ms WHERE ms.material_id = m.id AND (ms.title LIKE ? OR ms.content LIKE ?))
        )"""
        params.extend([search_term, search_term, search_term, search_term, search_term, search_term, search_term, search_term])
    if subject_id:
        sql += " AND m.subject_id = ?"
        params.append(subject_id)
    if topic_id:
        sql += " AND m.topic_id = ?"
        params.append(topic_id)
    if source_type:
        sql += " AND m.source_type = ?"
        params.append(source_type)
    if is_favorite is not None:
        sql += " AND m.is_favorite = ?"
        params.append(1 if is_favorite else 0)

    if sort_by == "opened":
        sql += " ORDER BY m.last_opened_at DESC NULLS LAST, m.id DESC"
    elif sort_by == "title":
        sql += " ORDER BY m.title ASC"
    else:  # recent
        sql += " ORDER BY m.created_at DESC"

    rows = db.execute(sql, params).fetchall()
    results = []
    for r in rows:
        results.append(MaterialResponse(
            id=r["id"],
            title=r["title"],
            source_type=r["source_type"],
            file_path=r["file_path"],
            source_url=r["source_url"],
            file_size=r["file_size"] or 0,
            subject_id=r["subject_id"],
            subject_name=r["subject_name"],
            chapter_id=r["chapter_id"],
            chapter_name=r["chapter_name"],
            topic_id=r["topic_id"],
            topic_name=r["topic_name"],
            tags=r["tags"] or "",
            is_favorite=bool(r["is_favorite"]),
            summary=r["summary"] or "",
            last_opened_at=r["last_opened_at"],
            created_at=r["created_at"],
            updated_at=r["updated_at"],
            sections_count=r["sections_count"]
        ))
    return results

@router.post("/upload", response_model=MaterialResponse)
async def upload_material(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    subject_id: Optional[int] = Form(None),
    chapter_id: Optional[int] = Form(None),
    topic_id: Optional[int] = Form(None),
    tags: Optional[str] = Form(""),
    db: sqlite3.Connection = Depends(get_db)
):
    """Uploads a local study file (PDF, DOCX, PPTX, TXT, MD, XLSX) and extracts readable sections."""
    original_name = file.filename or "uploaded_document"
    ext = Path(original_name).suffix.lower()

    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Supported formats: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )

    # Read content and validate size
    content_bytes = await file.read()
    file_size = len(content_bytes)
    if file_size > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size ({settings.MAX_UPLOAD_SIZE_BYTES // (1024*1024)} MB)."
        )

    # Check duplicate
    existing = db.execute(
        "SELECT id, title FROM materials WHERE file_size = ? AND title = ?",
        (file_size, title or Path(original_name).stem)
    ).fetchone()
    if existing:
        # We can still proceed or return a note, but let's make title distinct if duplicate
        pass

    # Save to local uploads folder safely
    safe_filename = f"{uuid.uuid4().hex[:8]}_{Path(original_name).name}"
    save_path = UPLOADS_DIR / safe_filename
    with open(save_path, "wb") as f:
        f.write(content_bytes)

    # Extract text sections
    source_type = ext.lstrip(".")
    try:
        sections = extract_content(save_path, source_type)
    except Exception as e:
        # Retain original file on disk as required by prompt
        sections = [{
            "section_index": 1,
            "title": "Extraction Note",
            "content": f"Text extraction encountered an issue: {str(e)}. The original file has been safely preserved.",
            "page_or_slide": "File Attached"
        }]

    doc_title = (title.strip() if title else Path(original_name).stem.replace("_", " ").title())

    # Auto-resolve chapter_id and subject_id from topic_id if provided
    if topic_id:
        topic_info = db.execute("""
            SELECT t.id, t.chapter_id, c.subject_id 
            FROM topics t 
            JOIN chapters c ON t.chapter_id = c.id 
            WHERE t.id = ?
        """, (topic_id,)).fetchone()
        if topic_info:
            if not chapter_id:
                chapter_id = topic_info["chapter_id"]
            if not subject_id:
                subject_id = topic_info["subject_id"]

    # Insert into materials table
    cursor = db.execute("""
        INSERT INTO materials (title, source_type, file_path, file_size, subject_id, chapter_id, topic_id, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (doc_title, source_type, safe_filename, file_size, subject_id, chapter_id, topic_id, tags or ""))
    material_id = cursor.lastrowid

    # Insert sections and index for FTS
    combined_content = []
    for sec in sections:
        db.execute("""
            INSERT INTO material_sections (material_id, section_index, title, content, page_or_slide)
            VALUES (?, ?, ?, ?, ?)
        """, (material_id, sec["section_index"], sec.get("title", ""), sec.get("content", ""), sec.get("page_or_slide", "")))
        combined_content.append(sec.get("content", ""))

    sync_fts_entry(db, "material", material_id, doc_title, "\n".join(combined_content), tags or "")

    return get_material(material_id, db=db)

@router.post("/import-url", response_model=MaterialResponse)
def import_url_material(data: MaterialImportUrlRequest, db: sqlite3.Connection = Depends(get_db)):
    """Imports educational content from a public webpage or video link."""
    # Check duplicate URL
    existing = db.execute("SELECT id, title FROM materials WHERE source_url = ?", (data.url.strip(),)).fetchone()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"This URL is already in your library as '{existing['title']}' (ID: {existing['id']})."
        )

    try:
        extracted = extract_from_url(data.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import URL: {str(e)}")

    doc_title = (data.title.strip() if data.title else extracted["title"])

    # Auto-resolve chapter_id and subject_id from topic_id if provided
    sub_id = data.subject_id
    chap_id = data.chapter_id
    top_id = data.topic_id
    if top_id:
        topic_info = db.execute("""
            SELECT t.id, t.chapter_id, c.subject_id 
            FROM topics t 
            JOIN chapters c ON t.chapter_id = c.id 
            WHERE t.id = ?
        """, (top_id,)).fetchone()
        if topic_info:
            if not chap_id:
                chap_id = topic_info["chapter_id"]
            if not sub_id:
                sub_id = topic_info["subject_id"]

    cursor = db.execute("""
        INSERT INTO materials (title, source_type, source_url, summary, subject_id, chapter_id, topic_id, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (doc_title, extracted["source_type"], extracted["source_url"], extracted.get("summary", ""),
          sub_id, chap_id, top_id, data.tags or ""))
    material_id = cursor.lastrowid

    combined_content = []
    for sec in extracted.get("sections", []):
        db.execute("""
            INSERT INTO material_sections (material_id, section_index, title, content, page_or_slide)
            VALUES (?, ?, ?, ?, ?)
        """, (material_id, sec["section_index"], sec.get("title", ""), sec.get("content", ""), sec.get("page_or_slide", "")))
        combined_content.append(sec.get("content", ""))

    sync_fts_entry(db, "material", material_id, doc_title, "\n".join(combined_content), data.tags or "")

    return get_material(material_id, db=db)

@router.get("/{material_id}", response_model=MaterialDetailResponse)
def get_material(material_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Retrieves full material details including extracted sections and bookmarks; records last_opened_at."""
    mat = db.execute("""
        SELECT m.*, s.name as subject_name, c.name as chapter_name, t.name as topic_name
        FROM materials m
        LEFT JOIN subjects s ON m.subject_id = s.id
        LEFT JOIN chapters c ON m.chapter_id = c.id
        LEFT JOIN topics t ON m.topic_id = t.id
        WHERE m.id = ?
    """, (material_id,)).fetchone()

    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")

    # Update last_opened_at
    db.execute("UPDATE materials SET last_opened_at = ? WHERE id = ?", (datetime.now().isoformat(), material_id))

    # Fetch sections
    sec_rows = db.execute(
        "SELECT * FROM material_sections WHERE material_id = ? ORDER BY section_index ASC", (material_id,)
    ).fetchall()
    sections = [
        MaterialSectionResponse(
            id=s["id"],
            material_id=s["material_id"],
            section_index=s["section_index"],
            title=s["title"] or "",
            content=s["content"] or "",
            page_or_slide=s["page_or_slide"] or "",
            created_at=s["created_at"]
        ) for s in sec_rows
    ]

    # Fetch bookmarks
    bm_rows = db.execute("SELECT * FROM bookmarks WHERE material_id = ? ORDER BY id DESC", (material_id,)).fetchall()
    bookmarks = [
        BookmarkResponse(
            id=b["id"],
            material_id=b["material_id"],
            section_id=b["section_id"],
            title=b["title"],
            note=b["note"] or "",
            created_at=b["created_at"]
        ) for b in bm_rows
    ]

    return MaterialDetailResponse(
        id=mat["id"],
        title=mat["title"],
        source_type=mat["source_type"],
        file_path=mat["file_path"],
        source_url=mat["source_url"],
        file_size=mat["file_size"] or 0,
        subject_id=mat["subject_id"],
        subject_name=mat["subject_name"],
        chapter_id=mat["chapter_id"],
        chapter_name=mat["chapter_name"],
        topic_id=mat["topic_id"],
        topic_name=mat["topic_name"],
        tags=mat["tags"] or "",
        is_favorite=bool(mat["is_favorite"]),
        summary=mat["summary"] or "",
        last_opened_at=mat["last_opened_at"],
        created_at=mat["created_at"],
        updated_at=mat["updated_at"],
        sections_count=len(sections),
        sections=sections,
        bookmarks=bookmarks
    )

@router.put("/{material_id}", response_model=StatusResponse)
def update_material(material_id: int, data: MaterialUpdate, db: sqlite3.Connection = Depends(get_db)):
    """Updates material title, subject/topic assignment, tags, or favorite status."""
    mat = db.execute("SELECT * FROM materials WHERE id = ?", (material_id,)).fetchone()
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")

    updates = ["updated_at = ?"]
    params = [datetime.now().isoformat()]

    # Auto-resolve chapter_id and subject_id from topic_id if provided
    resolved_chap_id = data.chapter_id
    resolved_sub_id = data.subject_id
    if data.topic_id is not None and data.topic_id > 0:
        topic_info = db.execute("""
            SELECT t.id, t.chapter_id, c.subject_id 
            FROM topics t 
            JOIN chapters c ON t.chapter_id = c.id 
            WHERE t.id = ?
        """, (data.topic_id,)).fetchone()
        if topic_info:
            if resolved_chap_id is None:
                resolved_chap_id = topic_info["chapter_id"]
            if resolved_sub_id is None:
                resolved_sub_id = topic_info["subject_id"]

    if data.title is not None:
        updates.append("title = ?")
        params.append(data.title.strip())
    if resolved_sub_id is not None:
        updates.append("subject_id = ?")
        params.append(resolved_sub_id if resolved_sub_id > 0 else None)
    if resolved_chap_id is not None:
        updates.append("chapter_id = ?")
        params.append(resolved_chap_id if resolved_chap_id > 0 else None)
    if data.topic_id is not None:
        updates.append("topic_id = ?")
        params.append(data.topic_id if data.topic_id > 0 else None)
    if data.tags is not None:
        updates.append("tags = ?")
        params.append(data.tags.strip())
    if data.is_favorite is not None:
        updates.append("is_favorite = ?")
        params.append(1 if data.is_favorite else 0)
    if data.summary is not None:
        updates.append("summary = ?")
        params.append(data.summary)

    params.append(material_id)
    db.execute(f"UPDATE materials SET {', '.join(updates)} WHERE id = ?", params)

    return StatusResponse(message="Material updated successfully")

@router.delete("/{material_id}", response_model=StatusResponse)
def delete_material(material_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Deletes material, sections, bookmarks, and removes local stored file."""
    mat = db.execute("SELECT * FROM materials WHERE id = ?", (material_id,)).fetchone()
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")

    # Safely remove file on disk if exists
    if mat["file_path"]:
        file_path = UPLOADS_DIR / mat["file_path"]
        if file_path.is_file():
            try:
                os.remove(file_path)
            except Exception:
                pass

    delete_fts_entry(db, "material", material_id)
    db.execute("DELETE FROM materials WHERE id = ?", (material_id,))
    return StatusResponse(message="Material deleted successfully")

@router.get("/{material_id}/download")
def download_material_file(material_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Downloads original uploaded file."""
    mat = db.execute("SELECT * FROM materials WHERE id = ?", (material_id,)).fetchone()
    if not mat or not mat["file_path"]:
        raise HTTPException(status_code=404, detail="No downloadable file for this material")

    file_path = UPLOADS_DIR / mat["file_path"]
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found on local disk")

    return FileResponse(
        path=str(file_path),
        filename=f"{mat['title']}{file_path.suffix}",
        media_type="application/octet-stream"
    )

# ---------------- Bookmarks ----------------
@router.post("/{material_id}/bookmarks", response_model=BookmarkResponse)
def add_bookmark(material_id: int, data: BookmarkCreate, db: sqlite3.Connection = Depends(get_db)):
    """Creates a bookmark on a material or specific section."""
    mat = db.execute("SELECT id FROM materials WHERE id = ?", (material_id,)).fetchone()
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")

    cursor = db.execute("""
        INSERT INTO bookmarks (material_id, section_id, title, note)
        VALUES (?, ?, ?, ?)
    """, (material_id, data.section_id, data.title.strip(), data.note or ""))
    bm_id = cursor.lastrowid
    row = db.execute("SELECT * FROM bookmarks WHERE id = ?", (bm_id,)).fetchone()
    return BookmarkResponse(
        id=row["id"],
        material_id=row["material_id"],
        section_id=row["section_id"],
        title=row["title"],
        note=row["note"] or "",
        created_at=row["created_at"]
    )

@router.delete("/bookmarks/{bookmark_id}", response_model=StatusResponse)
def delete_bookmark(bookmark_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Deletes a bookmark."""
    bm = db.execute("SELECT id FROM bookmarks WHERE id = ?", (bookmark_id,)).fetchone()
    if not bm:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    db.execute("DELETE FROM bookmarks WHERE id = ?", (bookmark_id,))
    return StatusResponse(message="Bookmark deleted successfully")
