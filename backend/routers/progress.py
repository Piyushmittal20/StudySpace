"""
Learning Progress and Study Session tracking router.
Computes real statistics for completed topics, study durations, quiz accuracies, and revision alerts.
"""
from fastapi import APIRouter, Depends, HTTPException
import sqlite3
import json
from typing import List, Dict, Any
from datetime import datetime, date
from backend.database import get_db
from backend.models.schemas import (
    ProgressStatsResponse, StudySessionStart, StudySessionEnd,
    StudySessionResponse, MaterialResponse, StatusResponse
)

router = APIRouter(prefix="/api/progress", tags=["Progress"])

@router.get("/stats", response_model=ProgressStatsResponse)
def get_progress_stats(db: sqlite3.Connection = Depends(get_db)):
    """Computes comprehensive, real learning progress metrics from saved data."""
    # Topics stats
    topics_total = db.execute("SELECT COUNT(*) as c FROM topics").fetchone()["c"]
    topics_completed = db.execute("SELECT COUNT(*) as c FROM topics WHERE is_completed = 1").fetchone()["c"]

    # Materials total
    materials_total = db.execute("SELECT COUNT(*) as c FROM materials").fetchone()["c"]

    # Notes total
    notes_total = db.execute("SELECT COUNT(*) as c FROM notes").fetchone()["c"]

    # Flashcards total & due today
    flashcards_total = db.execute("SELECT COUNT(*) as c FROM flashcards").fetchone()["c"]
    today_str = date.today().isoformat()
    flashcards_due = db.execute("SELECT COUNT(*) as c FROM flashcards WHERE next_review_at <= ?", (today_str,)).fetchone()["c"]

    # Quizzes stats
    quizzes_total = db.execute("SELECT COUNT(*) as c FROM quizzes").fetchone()["c"]
    quiz_attempts_total = db.execute("SELECT COUNT(*) as c FROM quiz_attempts").fetchone()["c"]
    avg_score_row = db.execute("SELECT AVG(score) as avg_score FROM quiz_attempts").fetchone()
    avg_score = round(avg_score_row["avg_score"] or 0.0, 1)

    # Total study time (minutes) from recorded sessions
    session_time_row = db.execute("SELECT SUM(duration_seconds) as total_sec FROM study_sessions").fetchone()
    total_study_minutes = round((session_time_row["total_sec"] or 0) / 60)

    # Recently studied / opened materials
    recent_mat_rows = db.execute("""
        SELECT m.*, s.name as subject_name, c.name as chapter_name, t.name as topic_name,
               (SELECT COUNT(*) FROM material_sections WHERE material_id = m.id) as sections_count
        FROM materials m
        LEFT JOIN subjects s ON m.subject_id = s.id
        LEFT JOIN chapters c ON m.chapter_id = c.id
        LEFT JOIN topics t ON m.topic_id = t.id
        WHERE m.last_opened_at IS NOT NULL
        ORDER BY m.last_opened_at DESC
        LIMIT 5
    """).fetchall()

    recent_materials = [
        MaterialResponse(
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
        ) for r in recent_mat_rows
    ]

    # Topics that need practice (topics where average quiz score is below 70% or uncompleted topics with materials)
    practice_rows = db.execute("""
        SELECT t.id, t.name as topic_name, s.name as subject_name,
               COALESCE(AVG(qa.score), 0) as avg_score,
               COUNT(qa.id) as attempt_count
        FROM topics t
        JOIN chapters c ON t.chapter_id = c.id
        JOIN subjects s ON c.subject_id = s.id
        LEFT JOIN quizzes q ON q.topic_id = t.id
        LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id
        WHERE t.is_completed = 0
        GROUP BY t.id
        HAVING attempt_count > 0 AND avg_score < 75
        LIMIT 5
    """).fetchall()

    topics_needing_practice = [
        {
            "topic_id": r["id"],
            "topic_name": r["topic_name"],
            "subject_name": r["subject_name"],
            "avg_score": round(r["avg_score"], 1),
            "reason": f"Average quiz score: {round(r['avg_score'], 1)}%"
        } for r in practice_rows
    ]

    # If no low quiz scores, suggest uncompleted topics with materials
    if not topics_needing_practice:
        fallback_rows = db.execute("""
            SELECT t.id, t.name as topic_name, s.name as subject_name, COUNT(m.id) as mat_count
            FROM topics t
            JOIN chapters c ON t.chapter_id = c.id
            JOIN subjects s ON c.subject_id = s.id
            JOIN materials m ON m.topic_id = t.id
            WHERE t.is_completed = 0
            GROUP BY t.id
            ORDER BY mat_count DESC
            LIMIT 4
        """).fetchall()
        for fr in fallback_rows:
            topics_needing_practice.append({
                "topic_id": fr["id"],
                "topic_name": fr["topic_name"],
                "subject_name": fr["subject_name"],
                "avg_score": 0.0,
                "reason": f"Uncompleted topic with {fr['mat_count']} study material(s)"
            })

    return ProgressStatsResponse(
        topics_total=topics_total,
        topics_completed=topics_completed,
        materials_total=materials_total,
        notes_total=notes_total,
        flashcards_total=flashcards_total,
        flashcards_due_today=flashcards_due,
        quizzes_total=quizzes_total,
        quiz_attempts_total=quiz_attempts_total,
        average_quiz_score=avg_score,
        total_study_time_minutes=total_study_minutes,
        recently_studied_materials=recent_materials,
        topics_needing_practice=topics_needing_practice
    )

@router.post("/session/start", response_model=StudySessionResponse)
def start_study_session(data: StudySessionStart, db: sqlite3.Connection = Depends(get_db)):
    """Starts a live study session timer."""
    now_iso = datetime.now().isoformat()
    cursor = db.execute("""
        INSERT INTO study_sessions (material_id, topic_id, start_time, activity_type)
        VALUES (?, ?, ?, ?)
    """, (data.material_id, data.topic_id, now_iso, data.activity_type or "reading"))
    s_id = cursor.lastrowid
    row = db.execute("SELECT * FROM study_sessions WHERE id = ?", (s_id,)).fetchone()

    return StudySessionResponse(
        id=row["id"],
        material_id=row["material_id"],
        topic_id=row["topic_id"],
        start_time=row["start_time"],
        end_time=row["end_time"],
        duration_seconds=row["duration_seconds"] or 0,
        activity_type=row["activity_type"],
        created_at=row["created_at"]
    )

@router.post("/session/end", response_model=StudySessionResponse)
def end_study_session(data: StudySessionEnd, db: sqlite3.Connection = Depends(get_db)):
    """Ends a study session and computes duration in seconds."""
    session = db.execute("SELECT * FROM study_sessions WHERE id = ?", (data.session_id,)).fetchone()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    end_time = datetime.now()
    start_time = datetime.fromisoformat(session["start_time"])
    duration_seconds = max(1, int((end_time - start_time).total_seconds()))

    db.execute("""
        UPDATE study_sessions
        SET end_time = ?, duration_seconds = ?
        WHERE id = ?
    """, (end_time.isoformat(), duration_seconds, data.session_id))

    row = db.execute("SELECT * FROM study_sessions WHERE id = ?", (data.session_id,)).fetchone()
    return StudySessionResponse(
        id=row["id"],
        material_id=row["material_id"],
        topic_id=row["topic_id"],
        start_time=row["start_time"],
        end_time=row["end_time"],
        duration_seconds=row["duration_seconds"],
        activity_type=row["activity_type"],
        created_at=row["created_at"]
    )
