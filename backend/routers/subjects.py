"""
Subject, Chapter, and Topic management endpoints.
Supports hierarchical tree view, reordering, completion tracking, and safe deletion.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
import sqlite3
from typing import List, Optional
from datetime import datetime
from backend.database import get_db
from backend.models.schemas import (
    SubjectCreate, SubjectUpdate, SubjectResponse,
    ChapterCreate, ChapterUpdate, ChapterResponse,
    TopicCreate, TopicUpdate, TopicResponse,
    DeleteFolderChoice, StatusResponse
)

router = APIRouter(prefix="/api/subjects", tags=["Subjects & Topics"])

@router.get("", response_model=List[SubjectResponse])
def get_subjects_tree(db: sqlite3.Connection = Depends(get_db)):
    """Returns the full hierarchical tree: Subject -> Chapters -> Topics with material counts."""
    subjects_rows = db.execute("SELECT * FROM subjects ORDER BY sort_order ASC, name ASC").fetchall()
    result = []

    for s_row in subjects_rows:
        s_id = s_row["id"]
        # Material count for subject
        mat_cnt = db.execute("SELECT COUNT(*) as count FROM materials WHERE subject_id = ?", (s_id,)).fetchone()["count"]

        # Chapters
        chapters_rows = db.execute(
            "SELECT * FROM chapters WHERE subject_id = ? ORDER BY sort_order ASC, name ASC", (s_id,)
        ).fetchall()
        chapters_list = []

        for c_row in chapters_rows:
            c_id = c_row["id"]
            # Topics
            topics_rows = db.execute(
                "SELECT * FROM topics WHERE chapter_id = ? ORDER BY sort_order ASC, name ASC", (c_id,)
            ).fetchall()
            topics_list = []

            for t_row in topics_rows:
                t_id = t_row["id"]
                t_mats = db.execute("SELECT COUNT(*) as cnt FROM materials WHERE topic_id = ?", (t_id,)).fetchone()["cnt"]
                t_notes = db.execute("SELECT COUNT(*) as cnt FROM notes WHERE topic_id = ?", (t_id,)).fetchone()["cnt"]
                t_cards = db.execute("SELECT COUNT(*) as cnt FROM flashcards WHERE topic_id = ?", (t_id,)).fetchone()["cnt"]

                topics_list.append(TopicResponse(
                    id=t_id,
                    chapter_id=c_id,
                    name=t_row["name"],
                    description=t_row["description"] or "",
                    is_completed=bool(t_row["is_completed"]),
                    completed_at=t_row["completed_at"],
                    sort_order=t_row["sort_order"],
                    created_at=t_row["created_at"],
                    materials_count=t_mats,
                    notes_count=t_notes,
                    flashcards_count=t_cards
                ))

            chapters_list.append(ChapterResponse(
                id=c_id,
                subject_id=s_id,
                name=c_row["name"],
                description=c_row["description"] or "",
                sort_order=c_row["sort_order"],
                created_at=c_row["created_at"],
                topics=topics_list
            ))

        result.append(SubjectResponse(
            id=s_id,
            name=s_row["name"],
            description=s_row["description"] or "",
            color=s_row["color"] or "#3B82F6",
            sort_order=s_row["sort_order"],
            created_at=s_row["created_at"],
            materials_count=mat_cnt,
            chapters=chapters_list
        ))

    return result

@router.post("", response_model=SubjectResponse)
def create_subject(data: SubjectCreate, db: sqlite3.Connection = Depends(get_db)):
    """Creates a new subject."""
    existing = db.execute("SELECT id FROM subjects WHERE LOWER(name) = LOWER(?)", (data.name.strip(),)).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail=f"Subject with name '{data.name}' already exists.")

    cursor = db.execute(
        "INSERT INTO subjects (name, description, color, sort_order) VALUES (?, ?, ?, ?)",
        (data.name.strip(), data.description or "", data.color or "#3B82F6", data.sort_order or 0)
    )
    s_id = cursor.lastrowid
    s_row = db.execute("SELECT * FROM subjects WHERE id = ?", (s_id,)).fetchone()
    return SubjectResponse(
        id=s_row["id"],
        name=s_row["name"],
        description=s_row["description"],
        color=s_row["color"],
        sort_order=s_row["sort_order"],
        created_at=s_row["created_at"],
        materials_count=0,
        chapters=[]
    )

@router.put("/{subject_id}", response_model=StatusResponse)
def update_subject(subject_id: int, data: SubjectUpdate, db: sqlite3.Connection = Depends(get_db)):
    """Updates subject details."""
    sub = db.execute("SELECT * FROM subjects WHERE id = ?", (subject_id,)).fetchone()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")

    updates = []
    params = []
    if data.name is not None:
        updates.append("name = ?")
        params.append(data.name.strip())
    if data.description is not None:
        updates.append("description = ?")
        params.append(data.description)
    if data.color is not None:
        updates.append("color = ?")
        params.append(data.color)
    if data.sort_order is not None:
        updates.append("sort_order = ?")
        params.append(data.sort_order)

    if updates:
        params.append(subject_id)
        db.execute(f"UPDATE subjects SET {', '.join(updates)} WHERE id = ?", params)

    return StatusResponse(message="Subject updated successfully")

@router.delete("/{subject_id}", response_model=StatusResponse)
def delete_subject(subject_id: int, choice: DeleteFolderChoice = None, db: sqlite3.Connection = Depends(get_db)):
    """
    Deletes a subject.
    If action == 'unassign', associated materials and notes are kept unassigned.
    If action == 'cascade', associated materials and notes are deleted.
    """
    action = choice.action if choice else "unassign"
    sub = db.execute("SELECT * FROM subjects WHERE id = ?", (subject_id,)).fetchone()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")

    if action == "unassign":
        db.execute("UPDATE materials SET subject_id = NULL, chapter_id = NULL, topic_id = NULL WHERE subject_id = ?", (subject_id,))
        db.execute("UPDATE notes SET subject_id = NULL, topic_id = NULL WHERE subject_id = ?", (subject_id,))
    elif action == "cascade":
        db.execute("DELETE FROM materials WHERE subject_id = ?", (subject_id,))
        db.execute("DELETE FROM notes WHERE subject_id = ?", (subject_id,))

    db.execute("DELETE FROM subjects WHERE id = ?", (subject_id,))
    return StatusResponse(message=f"Subject deleted successfully ({action} materials).")

# ---------------- Chapters Endpoints ----------------
@router.post("/chapters", response_model=ChapterResponse)
def create_chapter(data: ChapterCreate, db: sqlite3.Connection = Depends(get_db)):
    """Creates a chapter under a subject."""
    sub = db.execute("SELECT id FROM subjects WHERE id = ?", (data.subject_id,)).fetchone()
    if not sub:
        raise HTTPException(status_code=404, detail="Parent subject not found")

    cursor = db.execute(
        "INSERT INTO chapters (subject_id, name, description, sort_order) VALUES (?, ?, ?, ?)",
        (data.subject_id, data.name.strip(), data.description or "", data.sort_order or 0)
    )
    c_id = cursor.lastrowid
    c_row = db.execute("SELECT * FROM chapters WHERE id = ?", (c_id,)).fetchone()
    return ChapterResponse(
        id=c_row["id"],
        subject_id=c_row["subject_id"],
        name=c_row["name"],
        description=c_row["description"],
        sort_order=c_row["sort_order"],
        created_at=c_row["created_at"],
        topics=[]
    )

@router.put("/chapters/{chapter_id}", response_model=StatusResponse)
def update_chapter(chapter_id: int, data: ChapterUpdate, db: sqlite3.Connection = Depends(get_db)):
    """Updates chapter details."""
    ch = db.execute("SELECT * FROM chapters WHERE id = ?", (chapter_id,)).fetchone()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")

    updates = []
    params = []
    if data.name is not None:
        updates.append("name = ?")
        params.append(data.name.strip())
    if data.description is not None:
        updates.append("description = ?")
        params.append(data.description)
    if data.sort_order is not None:
        updates.append("sort_order = ?")
        params.append(data.sort_order)

    if updates:
        params.append(chapter_id)
        db.execute(f"UPDATE chapters SET {', '.join(updates)} WHERE id = ?", params)

    return StatusResponse(message="Chapter updated successfully")

@router.delete("/chapters/{chapter_id}", response_model=StatusResponse)
def delete_chapter(chapter_id: int, choice: DeleteFolderChoice = None, db: sqlite3.Connection = Depends(get_db)):
    """Deletes a chapter with choice on associated materials."""
    action = choice.action if choice else "unassign"
    ch = db.execute("SELECT * FROM chapters WHERE id = ?", (chapter_id,)).fetchone()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")

    if action == "unassign":
        db.execute("UPDATE materials SET chapter_id = NULL, topic_id = NULL WHERE chapter_id = ?", (chapter_id,))
    elif action == "cascade":
        db.execute("DELETE FROM materials WHERE chapter_id = ?", (chapter_id,))

    db.execute("DELETE FROM chapters WHERE id = ?", (chapter_id,))
    return StatusResponse(message="Chapter deleted successfully")

# ---------------- Topics Endpoints ----------------
@router.post("/topics", response_model=TopicResponse)
def create_topic(data: TopicCreate, db: sqlite3.Connection = Depends(get_db)):
    """Creates a topic under a chapter."""
    ch = db.execute("SELECT id FROM chapters WHERE id = ?", (data.chapter_id,)).fetchone()
    if not ch:
        raise HTTPException(status_code=404, detail="Parent chapter not found")

    cursor = db.execute(
        "INSERT INTO topics (chapter_id, name, description, sort_order) VALUES (?, ?, ?, ?)",
        (data.chapter_id, data.name.strip(), data.description or "", data.sort_order or 0)
    )
    t_id = cursor.lastrowid
    t_row = db.execute("SELECT * FROM topics WHERE id = ?", (t_id,)).fetchone()
    return TopicResponse(
        id=t_row["id"],
        chapter_id=t_row["chapter_id"],
        name=t_row["name"],
        description=t_row["description"],
        is_completed=bool(t_row["is_completed"]),
        completed_at=t_row["completed_at"],
        sort_order=t_row["sort_order"],
        created_at=t_row["created_at"],
        materials_count=0,
        notes_count=0,
        flashcards_count=0
    )

@router.put("/topics/{topic_id}", response_model=StatusResponse)
def update_topic(topic_id: int, data: TopicUpdate, db: sqlite3.Connection = Depends(get_db)):
    """Updates topic details and completion status."""
    tp = db.execute("SELECT * FROM topics WHERE id = ?", (topic_id,)).fetchone()
    if not tp:
        raise HTTPException(status_code=404, detail="Topic not found")

    updates = []
    params = []
    if data.name is not None:
        updates.append("name = ?")
        params.append(data.name.strip())
    if data.description is not None:
        updates.append("description = ?")
        params.append(data.description)
    if data.is_completed is not None:
        updates.append("is_completed = ?")
        params.append(1 if data.is_completed else 0)
        updates.append("completed_at = ?")
        params.append(datetime.now().isoformat() if data.is_completed else None)
    if data.sort_order is not None:
        updates.append("sort_order = ?")
        params.append(data.sort_order)

    if updates:
        params.append(topic_id)
        db.execute(f"UPDATE topics SET {', '.join(updates)} WHERE id = ?", params)

    return StatusResponse(message="Topic updated successfully")

@router.post("/topics/{topic_id}/toggle-complete", response_model=StatusResponse)
def toggle_topic_complete(topic_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Toggles the completion status of a topic."""
    tp = db.execute("SELECT is_completed FROM topics WHERE id = ?", (topic_id,)).fetchone()
    if not tp:
        raise HTTPException(status_code=404, detail="Topic not found")

    new_status = 0 if tp["is_completed"] else 1
    completed_at = datetime.now().isoformat() if new_status else None
    db.execute("UPDATE topics SET is_completed = ?, completed_at = ? WHERE id = ?", (new_status, completed_at, topic_id))
    return StatusResponse(message="Completion toggled", data={"is_completed": bool(new_status)})

@router.delete("/topics/{topic_id}", response_model=StatusResponse)
def delete_topic(topic_id: int, choice: DeleteFolderChoice = None, db: sqlite3.Connection = Depends(get_db)):
    """Deletes a topic with choice on associated materials."""
    action = choice.action if choice else "unassign"
    tp = db.execute("SELECT * FROM topics WHERE id = ?", (topic_id,)).fetchone()
    if not tp:
        raise HTTPException(status_code=404, detail="Topic not found")

    if action == "unassign":
        db.execute("UPDATE materials SET topic_id = NULL WHERE topic_id = ?", (topic_id,))
        db.execute("UPDATE notes SET topic_id = NULL WHERE topic_id = ?", (topic_id,))
    elif action == "cascade":
        db.execute("DELETE FROM materials WHERE topic_id = ?", (topic_id,))
        db.execute("DELETE FROM notes WHERE topic_id = ?", (topic_id,))

    db.execute("DELETE FROM topics WHERE id = ?", (topic_id,))
    return StatusResponse(message="Topic deleted successfully")
