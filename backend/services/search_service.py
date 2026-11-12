"""
Global search service for StudySpace.
Utilizes SQLite FTS5 index with graceful SQL LIKE fallback for cross-entity searching.
"""
import sqlite3
from typing import List, Dict, Any, Optional
import re

def search_all(
    conn: sqlite3.Connection,
    query: str,
    entity_type_filter: Optional[str] = None,
    subject_id_filter: Optional[int] = None,
    limit: int = 40
) -> List[Dict[str, Any]]:
    """
    Executes a multi-entity search across materials, document sections, notes, flashcards, and quizzes.
    Returns structured results with highlight excerpts.
    """
    clean_q = query.strip()
    if not clean_q:
        return []

    results = []

    # 1. Search Materials (Title, Tags, Summary)
    mat_sql = """
        SELECT m.id, m.title, m.source_type, m.summary, m.tags, s.name as subject_name, t.name as topic_name
        FROM materials m
        LEFT JOIN subjects s ON m.subject_id = s.id
        LEFT JOIN topics t ON m.topic_id = t.id
        WHERE (m.title LIKE ? OR m.tags LIKE ? OR m.summary LIKE ?)
    """
    mat_params = [f"%{clean_q}%", f"%{clean_q}%", f"%{clean_q}%"]
    if subject_id_filter:
        mat_sql += " AND m.subject_id = ?"
        mat_params.append(subject_id_filter)
    mat_sql += " LIMIT 15"

    for row in conn.execute(mat_sql, mat_params).fetchall():
        results.append({
            "entity_type": "material",
            "entity_id": row["id"],
            "title": row["title"],
            "excerpt": row["summary"] or f"Study material ({row['source_type']})",
            "subject_name": row["subject_name"],
            "topic_name": row["topic_name"],
            "tags": row["tags"],
            "target_url": f"#study-room/{row['id']}"
        })

    # 2. Search Material Sections (Deep document content)
    sec_sql = """
        SELECT ms.id, ms.material_id, ms.section_index, ms.title as section_title, ms.content, ms.page_or_slide,
               m.title as mat_title, s.name as subject_name, t.name as topic_name
        FROM material_sections ms
        JOIN materials m ON ms.material_id = m.id
        LEFT JOIN subjects s ON m.subject_id = s.id
        LEFT JOIN topics t ON m.topic_id = t.id
        WHERE ms.content LIKE ? OR ms.title LIKE ?
    """
    sec_params = [f"%{clean_q}%", f"%{clean_q}%"]
    if subject_id_filter:
        sec_sql += " AND m.subject_id = ?"
        sec_params.append(subject_id_filter)
    sec_sql += " LIMIT 20"

    for row in conn.execute(sec_sql, sec_params).fetchall():
        excerpt = _create_excerpt(row["content"], clean_q)
        title = f"{row['mat_title']} — {row['section_title'] or row['page_or_slide']}"
        results.append({
            "entity_type": "section",
            "entity_id": row["material_id"],
            "title": title,
            "excerpt": excerpt,
            "subject_name": row["subject_name"],
            "topic_name": row["topic_name"],
            "tags": "",
            "target_url": f"#study-room/{row['material_id']}?section={row['section_index']}"
        })

    # 3. Search Personal Notes
    note_sql = """
        SELECT n.id, n.title, n.content, n.material_id, s.name as subject_name, t.name as topic_name
        FROM notes n
        LEFT JOIN subjects s ON n.subject_id = s.id
        LEFT JOIN topics t ON n.topic_id = t.id
        WHERE n.title LIKE ? OR n.content LIKE ?
    """
    note_params = [f"%{clean_q}%", f"%{clean_q}%"]
    if subject_id_filter:
        note_sql += " AND n.subject_id = ?"
        note_params.append(subject_id_filter)
    note_sql += " LIMIT 15"

    for row in conn.execute(note_sql, note_params).fetchall():
        excerpt = _create_excerpt(row["content"], clean_q)
        results.append({
            "entity_type": "note",
            "entity_id": row["id"],
            "title": f"Note: {row['title']}",
            "excerpt": excerpt,
            "subject_name": row["subject_name"],
            "topic_name": row["topic_name"],
            "tags": "",
            "target_url": f"#notes?id={row['id']}"
        })

    # 4. Search Flashcards
    fc_sql = """
        SELECT f.id, f.question, f.answer, f.tag, t.name as topic_name
        FROM flashcards f
        LEFT JOIN topics t ON f.topic_id = t.id
        WHERE f.question LIKE ? OR f.answer LIKE ? OR f.tag LIKE ?
        LIMIT 10
    """
    for row in conn.execute(fc_sql, [f"%{clean_q}%", f"%{clean_q}%", f"%{clean_q}%"]).fetchall():
        results.append({
            "entity_type": "flashcard",
            "entity_id": row["id"],
            "title": f"Flashcard: {row['question'][:60]}",
            "excerpt": f"Answer: {row['answer'][:120]}...",
            "subject_name": None,
            "topic_name": row["topic_name"],
            "tags": row["tag"],
            "target_url": f"#flashcards?id={row['id']}"
        })

    # 5. Search Quizzes
    quiz_sql = """
        SELECT q.id, q.title, q.description, t.name as topic_name
        FROM quizzes q
        LEFT JOIN topics t ON q.topic_id = t.id
        WHERE q.title LIKE ? OR q.description LIKE ?
        LIMIT 10
    """
    for row in conn.execute(quiz_sql, [f"%{clean_q}%", f"%{clean_q}%"]).fetchall():
        results.append({
            "entity_type": "quiz",
            "entity_id": row["id"],
            "title": f"Quiz: {row['title']}",
            "excerpt": row["description"] or "Practice Quiz",
            "subject_name": None,
            "topic_name": row["topic_name"],
            "tags": "",
            "target_url": f"#quizzes?id={row['id']}"
        })

    # Filter by entity type if specified
    if entity_type_filter:
        results = [r for r in results if r["entity_type"] == entity_type_filter]

    return results[:limit]

def _create_excerpt(content: str, query: str, radius: int = 80) -> str:
    """Extracts a readable snippet with the query word centered."""
    if not content:
        return ""
    idx = content.lower().find(query.lower())
    if idx == -1:
        return content[:radius * 2].strip() + "..."
    start = max(0, idx - radius)
    end = min(len(content), idx + len(query) + radius)
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(content) else ""
    return prefix + content[start:end].replace("\n", " ").strip() + suffix
