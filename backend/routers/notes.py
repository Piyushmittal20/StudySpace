"""
Notes management router.
Supports personal markdown notes, linking to subjects/materials, pinning, and converting to flashcards.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
import sqlite3
from typing import List, Optional
from datetime import datetime
from backend.database import get_db, sync_fts_entry, delete_fts_entry
from backend.models.schemas import (
    NoteCreate, NoteUpdate, NoteResponse, StatusResponse, FlashcardResponse
)

router = APIRouter(prefix="/api/notes", tags=["Notes"])

@router.get("", response_model=List[NoteResponse])
def list_notes(
    search: Optional[str] = None,
    subject_id: Optional[int] = None,
    topic_id: Optional[int] = None,
    material_id: Optional[int] = None,
    is_pinned: Optional[bool] = None,
    db: sqlite3.Connection = Depends(get_db)
):
    """Lists personal notes with optional filtering and search."""
    sql = """
        SELECT n.*, s.name as subject_name, t.name as topic_name, m.title as material_title
        FROM notes n
        LEFT JOIN subjects s ON n.subject_id = s.id
        LEFT JOIN topics t ON n.topic_id = t.id
        LEFT JOIN materials m ON n.material_id = m.id
        WHERE 1=1
    """
    params = []

    if search:
        sql += " AND (n.title LIKE ? OR n.content LIKE ?)"
        params.extend([f"%{search.strip()}%", f"%{search.strip()}%"])
    if subject_id:
        sql += " AND n.subject_id = ?"
        params.append(subject_id)
    if topic_id:
        sql += " AND n.topic_id = ?"
        params.append(topic_id)
    if material_id:
        sql += " AND n.material_id = ?"
        params.append(material_id)
    if is_pinned is not None:
        sql += " AND n.is_pinned = ?"
        params.append(1 if is_pinned else 0)

    sql += " ORDER BY n.is_pinned DESC, n.updated_at DESC"
    rows = db.execute(sql, params).fetchall()

    return [
        NoteResponse(
            id=r["id"],
            title=r["title"],
            content=r["content"] or "",
            subject_id=r["subject_id"],
            subject_name=r["subject_name"],
            topic_id=r["topic_id"],
            topic_name=r["topic_name"],
            material_id=r["material_id"],
            material_title=r["material_title"],
            is_pinned=bool(r["is_pinned"]),
            created_at=r["created_at"],
            updated_at=r["updated_at"]
        ) for r in rows
    ]

@router.post("", response_model=NoteResponse)
def create_note(data: NoteCreate, db: sqlite3.Connection = Depends(get_db)):
    """Creates a new personal study note."""
    cursor = db.execute("""
        INSERT INTO notes (title, content, subject_id, topic_id, material_id, is_pinned)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (data.title.strip(), data.content or "", data.subject_id, data.topic_id, data.material_id, 1 if data.is_pinned else 0))
    n_id = cursor.lastrowid

    sync_fts_entry(db, "note", n_id, data.title, data.content or "")
    return get_note(n_id, db=db)

@router.get("/{note_id}", response_model=NoteResponse)
def get_note(note_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Retrieves a single note by ID."""
    row = db.execute("""
        SELECT n.*, s.name as subject_name, t.name as topic_name, m.title as material_title
        FROM notes n
        LEFT JOIN subjects s ON n.subject_id = s.id
        LEFT JOIN topics t ON n.topic_id = t.id
        LEFT JOIN materials m ON n.material_id = m.id
        WHERE n.id = ?
    """, (note_id,)).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Note not found")

    return NoteResponse(
        id=row["id"],
        title=row["title"],
        content=row["content"] or "",
        subject_id=row["subject_id"],
        subject_name=row["subject_name"],
        topic_id=row["topic_id"],
        topic_name=row["topic_name"],
        material_id=row["material_id"],
        material_title=row["material_title"],
        is_pinned=bool(row["is_pinned"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"]
    )

@router.put("/{note_id}", response_model=StatusResponse)
def update_note(note_id: int, data: NoteUpdate, db: sqlite3.Connection = Depends(get_db)):
    """Updates an existing note (supports autosave)."""
    note = db.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    updates = ["updated_at = ?"]
    params = [datetime.now().isoformat()]

    if data.title is not None:
        updates.append("title = ?")
        params.append(data.title.strip())
    if data.content is not None:
        updates.append("content = ?")
        params.append(data.content)
    if data.subject_id is not None:
        updates.append("subject_id = ?")
        params.append(data.subject_id if data.subject_id > 0 else None)
    if data.topic_id is not None:
        updates.append("topic_id = ?")
        params.append(data.topic_id if data.topic_id > 0 else None)
    if data.material_id is not None:
        updates.append("material_id = ?")
        params.append(data.material_id if data.material_id > 0 else None)
    if data.is_pinned is not None:
        updates.append("is_pinned = ?")
        params.append(1 if data.is_pinned else 0)

    params.append(note_id)
    db.execute(f"UPDATE notes SET {', '.join(updates)} WHERE id = ?", params)

    # Update search index
    updated_note = db.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
    sync_fts_entry(db, "note", note_id, updated_note["title"], updated_note["content"] or "")

    return StatusResponse(message="Note saved successfully")

@router.delete("/{note_id}", response_model=StatusResponse)
def delete_note(note_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Deletes a note."""
    note = db.execute("SELECT id FROM notes WHERE id = ?", (note_id,)).fetchone()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    delete_fts_entry(db, "note", note_id)
    db.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    return StatusResponse(message="Note deleted successfully")

@router.post("/{note_id}/to-flashcard", response_model=FlashcardResponse)
def convert_note_to_flashcard(note_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Turns a note into a flashcard (title as question, content as answer)."""
    note = db.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    cursor = db.execute("""
        INSERT INTO flashcards (material_id, topic_id, question, answer, tag)
        VALUES (?, ?, ?, ?, ?)
    """, (note["material_id"], note["topic_id"], note["title"], note["content"] or note["title"], "From Notes"))
    fc_id = cursor.lastrowid

    fc = db.execute("SELECT * FROM flashcards WHERE id = ?", (fc_id,)).fetchone()
    return FlashcardResponse(
        id=fc["id"],
        material_id=fc["material_id"],
        topic_id=fc["topic_id"],
        question=fc["question"],
        answer=fc["answer"],
        tag=fc["tag"] or "",
        difficulty_level=fc["difficulty_level"],
        repetition_count=fc["repetition_count"],
        interval_days=fc["interval_days"],
        ease_factor=fc["ease_factor"],
        next_review_at=fc["next_review_at"],
        last_reviewed_at=fc["last_reviewed_at"],
        created_at=fc["created_at"]
    )
