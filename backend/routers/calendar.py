"""
Calendar and Important Dates router.
Supports marking exams, assignments, revision milestones, deadlines, and study sessions.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
import sqlite3
from typing import List, Optional
from datetime import datetime
from backend.database import get_db
from backend.models.schemas import (
    CalendarEventCreate, CalendarEventUpdate, CalendarEventResponse, StatusResponse
)

router = APIRouter(prefix="/api/calendar", tags=["Calendar"])

@router.get("/events", response_model=List[CalendarEventResponse])
def list_calendar_events(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    month: Optional[str] = None,
    category: Optional[str] = None,
    subject_id: Optional[int] = None,
    is_completed: Optional[bool] = None,
    db: sqlite3.Connection = Depends(get_db)
):
    """Lists calendar events with optional date range, month, category, or subject filters."""
    sql = """
        SELECT e.*, s.name as subject_name, t.name as topic_name
        FROM calendar_events e
        LEFT JOIN subjects s ON e.subject_id = s.id
        LEFT JOIN topics t ON e.topic_id = t.id
        WHERE 1=1
    """
    params = []

    if start_date:
        sql += " AND e.event_date >= ?"
        params.append(start_date)
    if end_date:
        sql += " AND e.event_date <= ?"
        params.append(end_date)
    if month:
        sql += " AND e.event_date LIKE ?"
        params.append(f"{month}%")
    if category and category != "all":
        sql += " AND e.category = ?"
        params.append(category)
    if subject_id:
        sql += " AND e.subject_id = ?"
        params.append(subject_id)
    if is_completed is not None:
        sql += " AND e.is_completed = ?"
        params.append(1 if is_completed else 0)

    sql += " ORDER BY e.event_date ASC, CASE WHEN e.event_time = '' THEN '23:59' ELSE e.event_time END ASC, e.id ASC"
    rows = db.execute(sql, params).fetchall()

    return [
        CalendarEventResponse(
            id=r["id"],
            title=r["title"],
            description=r["description"] or "",
            event_date=r["event_date"],
            event_time=r["event_time"] or "",
            category=r["category"] or "event",
            priority=r["priority"] or "normal",
            subject_id=r["subject_id"],
            subject_name=r["subject_name"],
            topic_id=r["topic_id"],
            topic_name=r["topic_name"],
            is_completed=bool(r["is_completed"]),
            created_at=r["created_at"],
            updated_at=r["updated_at"]
        )
        for r in rows
    ]

@router.post("/events", response_model=CalendarEventResponse, status_code=201)
def create_calendar_event(payload: CalendarEventCreate, db: sqlite3.Connection = Depends(get_db)):
    """Creates a new calendar event or important date."""
    cursor = db.cursor()
    cursor.execute("""
        INSERT INTO calendar_events (title, description, event_date, event_time, category, priority, subject_id, topic_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        payload.title.strip(),
        payload.description or "",
        payload.event_date.strip(),
        (payload.event_time or "").strip(),
        payload.category or "event",
        payload.priority or "normal",
        payload.subject_id if payload.subject_id and payload.subject_id > 0 else None,
        payload.topic_id if payload.topic_id and payload.topic_id > 0 else None
    ))
    event_id = cursor.lastrowid
    db.commit()

    row = db.execute("""
        SELECT e.*, s.name as subject_name, t.name as topic_name
        FROM calendar_events e
        LEFT JOIN subjects s ON e.subject_id = s.id
        LEFT JOIN topics t ON e.topic_id = t.id
        WHERE e.id = ?
    """, (event_id,)).fetchone()

    return CalendarEventResponse(
        id=row["id"],
        title=row["title"],
        description=row["description"] or "",
        event_date=row["event_date"],
        event_time=row["event_time"] or "",
        category=row["category"] or "event",
        priority=row["priority"] or "normal",
        subject_id=row["subject_id"],
        subject_name=row["subject_name"],
        topic_id=row["topic_id"],
        topic_name=row["topic_name"],
        is_completed=bool(row["is_completed"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"]
    )

@router.get("/events/{event_id}", response_model=CalendarEventResponse)
def get_calendar_event(event_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Retrieves a single calendar event by ID."""
    row = db.execute("""
        SELECT e.*, s.name as subject_name, t.name as topic_name
        FROM calendar_events e
        LEFT JOIN subjects s ON e.subject_id = s.id
        LEFT JOIN topics t ON e.topic_id = t.id
        WHERE e.id = ?
    """, (event_id,)).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Calendar event not found")

    return CalendarEventResponse(
        id=row["id"],
        title=row["title"],
        description=row["description"] or "",
        event_date=row["event_date"],
        event_time=row["event_time"] or "",
        category=row["category"] or "event",
        priority=row["priority"] or "normal",
        subject_id=row["subject_id"],
        subject_name=row["subject_name"],
        topic_id=row["topic_id"],
        topic_name=row["topic_name"],
        is_completed=bool(row["is_completed"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"]
    )

@router.put("/events/{event_id}", response_model=CalendarEventResponse)
def update_calendar_event(event_id: int, payload: CalendarEventUpdate, db: sqlite3.Connection = Depends(get_db)):
    """Updates an existing calendar event or marks it completed."""
    existing = db.execute("SELECT * FROM calendar_events WHERE id = ?", (event_id,)).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Calendar event not found")

    updates = []
    params = []

    if payload.title is not None:
        updates.append("title = ?")
        params.append(payload.title.strip())
    if payload.description is not None:
        updates.append("description = ?")
        params.append(payload.description)
    if payload.event_date is not None:
        updates.append("event_date = ?")
        params.append(payload.event_date.strip())
    if payload.event_time is not None:
        updates.append("event_time = ?")
        params.append(payload.event_time.strip())
    if payload.category is not None:
        updates.append("category = ?")
        params.append(payload.category)
    if payload.priority is not None:
        updates.append("priority = ?")
        params.append(payload.priority)
    if "subject_id" in payload.model_fields_set:
        updates.append("subject_id = ?")
        params.append(payload.subject_id if payload.subject_id and payload.subject_id > 0 else None)
    elif payload.subject_id is not None:
        updates.append("subject_id = ?")
        params.append(payload.subject_id if payload.subject_id > 0 else None)

    if "topic_id" in payload.model_fields_set:
        updates.append("topic_id = ?")
        params.append(payload.topic_id if payload.topic_id and payload.topic_id > 0 else None)
    elif payload.topic_id is not None:
        updates.append("topic_id = ?")
        params.append(payload.topic_id if payload.topic_id > 0 else None)
    if payload.is_completed is not None:
        updates.append("is_completed = ?")
        params.append(1 if payload.is_completed else 0)

    if updates:
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(event_id)
        sql = f"UPDATE calendar_events SET {', '.join(updates)} WHERE id = ?"
        db.execute(sql, params)
        db.commit()

    row = db.execute("""
        SELECT e.*, s.name as subject_name, t.name as topic_name
        FROM calendar_events e
        LEFT JOIN subjects s ON e.subject_id = s.id
        LEFT JOIN topics t ON e.topic_id = t.id
        WHERE e.id = ?
    """, (event_id,)).fetchone()

    return CalendarEventResponse(
        id=row["id"],
        title=row["title"],
        description=row["description"] or "",
        event_date=row["event_date"],
        event_time=row["event_time"] or "",
        category=row["category"] or "event",
        priority=row["priority"] or "normal",
        subject_id=row["subject_id"],
        subject_name=row["subject_name"],
        topic_id=row["topic_id"],
        topic_name=row["topic_name"],
        is_completed=bool(row["is_completed"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"]
    )

@router.delete("/events/{event_id}", response_model=StatusResponse)
def delete_calendar_event(event_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Deletes a calendar event."""
    existing = db.execute("SELECT id FROM calendar_events WHERE id = ?", (event_id,)).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Calendar event not found")

    db.execute("DELETE FROM calendar_events WHERE id = ?", (event_id,))
    db.commit()
    return StatusResponse(success=True, message="Calendar event deleted successfully")
