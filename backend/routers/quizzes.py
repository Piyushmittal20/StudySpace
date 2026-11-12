"""
Quiz management and interactive assessment router.
Supports quiz creation, questions with explanations, attempts scoring, and mistake review.
"""
from fastapi import APIRouter, Depends, HTTPException
import sqlite3
import json
from typing import List, Optional
from datetime import datetime
from backend.database import get_db, sync_fts_entry, delete_fts_entry
from backend.models.schemas import (
    QuizCreate, QuizResponse, QuizQuestionResponse, QuizAttemptSubmit,
    QuizAttemptResponse, StatusResponse
)

router = APIRouter(prefix="/api/quizzes", tags=["Quizzes"])

@router.get("", response_model=List[QuizResponse])
def list_quizzes(
    topic_id: Optional[int] = None,
    material_id: Optional[int] = None,
    db: sqlite3.Connection = Depends(get_db)
):
    """Lists quizzes with question counts and linked topics."""
    sql = """
        SELECT q.*, m.title as material_title, t.name as topic_name,
               (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) as questions_count
        FROM quizzes q
        LEFT JOIN materials m ON q.material_id = m.id
        LEFT JOIN topics t ON q.topic_id = t.id
        WHERE 1=1
    """
    params = []
    if topic_id:
        sql += " AND q.topic_id = ?"
        params.append(topic_id)
    if material_id:
        sql += " AND q.material_id = ?"
        params.append(material_id)

    sql += " ORDER BY q.created_at DESC"
    rows = db.execute(sql, params).fetchall()

    return [
        QuizResponse(
            id=r["id"],
            title=r["title"],
            description=r["description"] or "",
            material_id=r["material_id"],
            material_title=r["material_title"],
            topic_id=r["topic_id"],
            topic_name=r["topic_name"],
            difficulty=r["difficulty"] or "medium",
            questions_count=r["questions_count"],
            created_at=r["created_at"]
        ) for r in rows
    ]

@router.post("", response_model=QuizResponse)
def create_quiz(data: QuizCreate, db: sqlite3.Connection = Depends(get_db)):
    """Creates a new quiz with its list of questions."""
    cursor = db.execute("""
        INSERT INTO quizzes (title, description, material_id, topic_id, difficulty)
        VALUES (?, ?, ?, ?, ?)
    """, (data.title.strip(), data.description or "", data.material_id, data.topic_id, data.difficulty or "medium"))
    quiz_id = cursor.lastrowid

    for idx, q in enumerate(data.questions):
        opts_json = json.dumps(q.options) if q.options else "[]"
        db.execute("""
            INSERT INTO quiz_questions (quiz_id, question_type, question_text, options, correct_answer, explanation, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (quiz_id, q.question_type or "mcq", q.question_text.strip(), opts_json, q.correct_answer.strip(), q.explanation or "", idx + 1))

    sync_fts_entry(db, "quiz", quiz_id, data.title, data.description or "")
    return get_quiz(quiz_id, db=db)

@router.get("/{quiz_id}", response_model=QuizResponse)
def get_quiz(quiz_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Retrieves quiz details including all questions and options."""
    q_row = db.execute("""
        SELECT q.*, m.title as material_title, t.name as topic_name
        FROM quizzes q
        LEFT JOIN materials m ON q.material_id = m.id
        LEFT JOIN topics t ON q.topic_id = t.id
        WHERE q.id = ?
    """, (quiz_id,)).fetchone()

    if not q_row:
        raise HTTPException(status_code=404, detail="Quiz not found")

    questions_rows = db.execute(
        "SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order ASC, id ASC", (quiz_id,)
    ).fetchall()

    questions = []
    for qr in questions_rows:
        try:
            opts = json.loads(qr["options"]) if qr["options"] else []
        except Exception:
            opts = []
        questions.append(QuizQuestionResponse(
            id=qr["id"],
            quiz_id=qr["quiz_id"],
            question_type=qr["question_type"],
            question_text=qr["question_text"],
            options=opts,
            correct_answer=qr["correct_answer"],
            explanation=qr["explanation"] or "",
            sort_order=qr["sort_order"]
        ))

    return QuizResponse(
        id=q_row["id"],
        title=q_row["title"],
        description=q_row["description"] or "",
        material_id=q_row["material_id"],
        material_title=q_row["material_title"],
        topic_id=q_row["topic_id"],
        topic_name=q_row["topic_name"],
        difficulty=q_row["difficulty"] or "medium",
        questions_count=len(questions),
        created_at=q_row["created_at"],
        questions=questions
    )

@router.post("/{quiz_id}/attempt", response_model=QuizAttemptResponse)
def submit_quiz_attempt(quiz_id: int, attempt_data: QuizAttemptSubmit, db: sqlite3.Connection = Depends(get_db)):
    """
    Submits user answers for a quiz.
    Evaluates correctness, computes score percentage, records mistake details, and persists attempt.
    """
    q_row = db.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
    if not q_row:
        raise HTTPException(status_code=404, detail="Quiz not found")

    questions_rows = db.execute("SELECT * FROM quiz_questions WHERE quiz_id = ?", (quiz_id,)).fetchall()
    if not questions_rows:
        raise HTTPException(status_code=400, detail="Quiz has no questions")

    correct_count = 0
    detailed_answers = []

    for qr in questions_rows:
        q_id_str = str(qr["id"])
        user_ans = attempt_data.answers.get(q_id_str, "").strip()
        correct_ans = qr["correct_answer"].strip()

        # Check correctness (case-insensitive strip comparison)
        is_correct = (user_ans.lower() == correct_ans.lower())
        if is_correct:
            correct_count += 1

        detailed_answers.append({
            "question_id": qr["id"],
            "question_text": qr["question_text"],
            "question_type": qr["question_type"],
            "user_answer": user_ans,
            "correct_answer": correct_ans,
            "is_correct": is_correct,
            "explanation": qr["explanation"] or ""
        })

    total = len(questions_rows)
    score_pct = round((correct_count / total) * 100.0, 1)

    answers_json_str = json.dumps(detailed_answers)
    cursor = db.execute("""
        INSERT INTO quiz_attempts (quiz_id, score, total_questions, answers_json)
        VALUES (?, ?, ?, ?)
    """, (quiz_id, score_pct, total, answers_json_str))
    attempt_id = cursor.lastrowid

    att_row = db.execute("SELECT * FROM quiz_attempts WHERE id = ?", (attempt_id,)).fetchone()
    return QuizAttemptResponse(
        id=att_row["id"],
        quiz_id=att_row["quiz_id"],
        quiz_title=q_row["title"],
        score=att_row["score"],
        total_questions=att_row["total_questions"],
        answers_json=detailed_answers,
        completed_at=att_row["completed_at"]
    )

@router.get("/{quiz_id}/attempts", response_model=List[QuizAttemptResponse])
def get_quiz_attempts(quiz_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Retrieves all past attempts for a specific quiz."""
    q_row = db.execute("SELECT title FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
    if not q_row:
        raise HTTPException(status_code=404, detail="Quiz not found")

    rows = db.execute(
        "SELECT * FROM quiz_attempts WHERE quiz_id = ? ORDER BY completed_at DESC", (quiz_id,)
    ).fetchall()

    attempts = []
    for r in rows:
        try:
            ans = json.loads(r["answers_json"])
        except Exception:
            ans = []
        attempts.append(QuizAttemptResponse(
            id=r["id"],
            quiz_id=r["quiz_id"],
            quiz_title=q_row["title"],
            score=r["score"],
            total_questions=r["total_questions"],
            answers_json=ans,
            completed_at=r["completed_at"]
        ))
    return attempts

@router.delete("/{quiz_id}", response_model=StatusResponse)
def delete_quiz(quiz_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Deletes a quiz and all associated questions and attempts."""
    q_row = db.execute("SELECT id FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
    if not q_row:
        raise HTTPException(status_code=404, detail="Quiz not found")

    delete_fts_entry(db, "quiz", quiz_id)
    db.execute("DELETE FROM quizzes WHERE id = ?", (quiz_id,))
    return StatusResponse(message="Quiz deleted successfully")
