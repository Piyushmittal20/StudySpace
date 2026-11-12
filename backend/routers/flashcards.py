"""
Flashcards and Spaced Repetition (SRS) router.
Implements question/answer review scheduling using an SM-2 spaced repetition algorithm.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
import sqlite3
from typing import List, Optional
from datetime import datetime, date, timedelta
from backend.database import get_db, sync_fts_entry, delete_fts_entry
from backend.models.schemas import (
    FlashcardCreate, FlashcardUpdate, FlashcardResponse, FlashcardReviewRequest, StatusResponse
)

router = APIRouter(prefix="/api/flashcards", tags=["Flashcards"])

@router.get("", response_model=List[FlashcardResponse])
def list_flashcards(
    topic_id: Optional[int] = None,
    material_id: Optional[int] = None,
    due_only: bool = False,
    tag: Optional[str] = None,
    db: sqlite3.Connection = Depends(get_db)
):
    """Lists flashcards with filters for topic, material, tag, or due for revision."""
    sql = """
        SELECT f.*, m.title as material_title, t.name as topic_name
        FROM flashcards f
        LEFT JOIN materials m ON f.material_id = m.id
        LEFT JOIN topics t ON f.topic_id = t.id
        WHERE 1=1
    """
    params = []

    if topic_id:
        sql += " AND f.topic_id = ?"
        params.append(topic_id)
    if material_id:
        sql += " AND f.material_id = ?"
        params.append(material_id)
    if tag:
        sql += " AND f.tag LIKE ?"
        params.append(f"%{tag}%")
    if due_only:
        today_str = date.today().isoformat()
        sql += " AND f.next_review_at <= ?"
        params.append(today_str)

    sql += " ORDER BY f.next_review_at ASC, f.id DESC"
    rows = db.execute(sql, params).fetchall()

    return [
        FlashcardResponse(
            id=r["id"],
            material_id=r["material_id"],
            material_title=r["material_title"],
            topic_id=r["topic_id"],
            topic_name=r["topic_name"],
            question=r["question"],
            answer=r["answer"],
            tag=r["tag"] or "",
            difficulty_level=r["difficulty_level"] or "medium",
            repetition_count=r["repetition_count"] or 0,
            interval_days=r["interval_days"] or 1,
            ease_factor=r["ease_factor"] or 2.5,
            next_review_at=r["next_review_at"],
            last_reviewed_at=r["last_reviewed_at"],
            created_at=r["created_at"]
        ) for r in rows
    ]

@router.post("", response_model=FlashcardResponse)
def create_flashcard(data: FlashcardCreate, db: sqlite3.Connection = Depends(get_db)):
    """Creates a new flashcard."""
    cursor = db.execute("""
        INSERT INTO flashcards (material_id, topic_id, question, answer, tag, difficulty_level, next_review_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (data.material_id, data.topic_id, data.question.strip(), data.answer.strip(),
          data.tag or "", data.difficulty_level or "medium", date.today().isoformat()))
    fc_id = cursor.lastrowid

    sync_fts_entry(db, "flashcard", fc_id, data.question, data.answer, data.tag or "")
    return get_flashcard(fc_id, db=db)

@router.get("/{flashcard_id}", response_model=FlashcardResponse)
def get_flashcard(flashcard_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Retrieves a single flashcard."""
    row = db.execute("""
        SELECT f.*, m.title as material_title, t.name as topic_name
        FROM flashcards f
        LEFT JOIN materials m ON f.material_id = m.id
        LEFT JOIN topics t ON f.topic_id = t.id
        WHERE f.id = ?
    """, (flashcard_id,)).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Flashcard not found")

    return FlashcardResponse(
        id=row["id"],
        material_id=row["material_id"],
        material_title=row["material_title"],
        topic_id=row["topic_id"],
        topic_name=row["topic_name"],
        question=row["question"],
        answer=row["answer"],
        tag=row["tag"] or "",
        difficulty_level=row["difficulty_level"] or "medium",
        repetition_count=row["repetition_count"] or 0,
        interval_days=row["interval_days"] or 1,
        ease_factor=row["ease_factor"] or 2.5,
        next_review_at=row["next_review_at"],
        last_reviewed_at=row["last_reviewed_at"],
        created_at=row["created_at"]
    )

@router.put("/{flashcard_id}", response_model=StatusResponse)
def update_flashcard(flashcard_id: int, data: FlashcardUpdate, db: sqlite3.Connection = Depends(get_db)):
    """Updates question, answer, tag, or difficulty."""
    fc = db.execute("SELECT * FROM flashcards WHERE id = ?", (flashcard_id,)).fetchone()
    if not fc:
        raise HTTPException(status_code=404, detail="Flashcard not found")

    updates = []
    params = []
    if data.question is not None:
        updates.append("question = ?")
        params.append(data.question.strip())
    if data.answer is not None:
        updates.append("answer = ?")
        params.append(data.answer.strip())
    if data.topic_id is not None:
        updates.append("topic_id = ?")
        params.append(data.topic_id if data.topic_id > 0 else None)
    if data.tag is not None:
        updates.append("tag = ?")
        params.append(data.tag.strip())
    if data.difficulty_level is not None:
        updates.append("difficulty_level = ?")
        params.append(data.difficulty_level)

    if updates:
        params.append(flashcard_id)
        db.execute(f"UPDATE flashcards SET {', '.join(updates)} WHERE id = ?", params)

    return StatusResponse(message="Flashcard updated successfully")

@router.post("/{flashcard_id}/review", response_model=FlashcardResponse)
def review_flashcard(flashcard_id: int, review: FlashcardReviewRequest, db: sqlite3.Connection = Depends(get_db)):
    """
    Submits a revision rating ('again', 'hard', 'good', 'easy')
    and updates the spaced repetition interval and next review date.
    """
    fc = db.execute("SELECT * FROM flashcards WHERE id = ?", (flashcard_id,)).fetchone()
    if not fc:
        raise HTTPException(status_code=404, detail="Flashcard not found")

    rating = review.rating.lower().strip()
    rep_count = fc["repetition_count"] or 0
    interval = fc["interval_days"] or 1
    ease = fc["ease_factor"] or 2.5

    if rating == "again":
        rep_count = 0
        interval = 1
        ease = max(1.3, ease - 0.2)
    elif rating == "hard":
        rep_count += 1
        interval = max(1, int(interval * 1.2))
        ease = max(1.3, ease - 0.15)
    elif rating == "good":
        rep_count += 1
        if rep_count == 1:
            interval = 1
        elif rep_count == 2:
            interval = 6
        else:
            interval = int(interval * ease)
    elif rating == "easy":
        rep_count += 1
        if rep_count == 1:
            interval = 4
        elif rep_count == 2:
            interval = 10
        else:
            interval = int(interval * ease * 1.3)
        ease = min(3.0, ease + 0.15)
    else:
        raise HTTPException(status_code=400, detail="Invalid rating. Use 'again', 'hard', 'good', or 'easy'.")

    next_date = (date.today() + timedelta(days=max(1, interval))).isoformat()
    now_iso = datetime.now().isoformat()

    db.execute("""
        UPDATE flashcards
        SET repetition_count = ?, interval_days = ?, ease_factor = ?, next_review_at = ?, last_reviewed_at = ?
        WHERE id = ?
    """, (rep_count, interval, ease, next_date, now_iso, flashcard_id))

    return get_flashcard(flashcard_id, db=db)

@router.delete("/{flashcard_id}", response_model=StatusResponse)
def delete_flashcard(flashcard_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Deletes a flashcard."""
    fc = db.execute("SELECT id FROM flashcards WHERE id = ?", (flashcard_id,)).fetchone()
    if not fc:
        raise HTTPException(status_code=404, detail="Flashcard not found")

    delete_fts_entry(db, "flashcard", flashcard_id)
    db.execute("DELETE FROM flashcards WHERE id = ?", (flashcard_id,))
    return StatusResponse(message="Flashcard deleted successfully")
