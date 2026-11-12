"""
Global search router.
Searches across materials, document sections, notes, flashcards, and quizzes.
"""
from fastapi import APIRouter, Depends, Query
import sqlite3
from typing import Optional
from backend.database import get_db
from backend.services.search_service import search_all
from backend.models.schemas import SearchResponse, SearchResultItem

router = APIRouter(prefix="/api/search", tags=["Search"])

@router.get("", response_model=SearchResponse)
def execute_search(
    q: str = Query(..., min_length=1, description="Search term or topic name"),
    entity_type: Optional[str] = Query(None, description="Optional filter: material, section, note, flashcard, quiz"),
    subject_id: Optional[int] = Query(None, description="Optional filter by subject ID"),
    limit: int = Query(40, le=100),
    db: sqlite3.Connection = Depends(get_db)
):
    """Executes a global search across all personal study material, notes, and assessments."""
    results_raw = search_all(
        conn=db,
        query=q,
        entity_type_filter=entity_type,
        subject_id_filter=subject_id,
        limit=limit
    )

    items = [
        SearchResultItem(
            entity_type=r["entity_type"],
            entity_id=r["entity_id"],
            title=r["title"],
            excerpt=r["excerpt"],
            subject_name=r.get("subject_name"),
            topic_name=r.get("topic_name"),
            tags=r.get("tags") or "",
            target_url=r["target_url"]
        ) for r in results_raw
    ]

    return SearchResponse(
        query=q,
        total_results=len(items),
        results=items
    )
