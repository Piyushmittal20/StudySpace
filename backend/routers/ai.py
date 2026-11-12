"""
AI learning tools router.
Provides grounded Q&A, simple explanations, smart summaries, and flashcard/quiz generation.
Gracefully informs the user if AI credentials are not yet configured.
"""
from fastapi import APIRouter, Depends, HTTPException
import sqlite3
from backend.database import get_db
from backend.config import settings
from backend.services.ai_service import ai_service
from backend.models.schemas import (
    AIExplainRequest, AISummaryRequest, AIAskQuestionRequest,
    AIGenerateFlashcardsRequest, AIGenerateQuizRequest, AIResponse
)

router = APIRouter(prefix="/api/ai", tags=["AI Tools"])

@router.get("/status")
def get_ai_status():
    """Returns whether AI integration is configured and the active model."""
    return {
        "is_configured": ai_service.is_configured,
        "model": settings.AI_MODEL if ai_service.is_configured else "Not configured",
        "base_url": settings.AI_BASE_URL if ai_service.is_configured else "",
        "message": "AI is ready." if ai_service.is_configured else "AI API key is not configured. Add it in Settings or .env file to enable AI features."
    }

@router.post("/explain", response_model=AIResponse)
def explain_passage(req: AIExplainRequest, db: sqlite3.Connection = Depends(get_db)):
    """Provides a clear explanation of a selected passage in various styles."""
    if not ai_service.is_configured:
        return AIResponse(
            success=False,
            is_configured=False,
            message="AI features require an API key. Go to Settings to configure your OpenAI-compatible API key."
        )

    context_title = ""
    if req.context_material_id:
        mat = db.execute("SELECT title FROM materials WHERE id = ?", (req.context_material_id,)).fetchone()
        if mat:
            context_title = mat["title"]

    try:
        res = ai_service.explain_simply(text=req.text, style=req.style, context_title=context_title)
        return AIResponse(success=True, result=res["result"], is_configured=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/summary", response_model=AIResponse)
def summarize_material(req: AISummaryRequest, db: sqlite3.Connection = Depends(get_db)):
    """Generates a truthful, structured summary of a study material."""
    if not ai_service.is_configured:
        return AIResponse(
            success=False,
            is_configured=False,
            message="AI features require an API key. Go to Settings to configure your OpenAI-compatible API key."
        )

    sections = db.execute(
        "SELECT * FROM material_sections WHERE material_id = ? ORDER BY section_index ASC",
        (req.material_id,)
    ).fetchall()

    if not sections:
        raise HTTPException(status_code=400, detail="This material has no extracted sections to summarize.")

    try:
        sec_dicts = [dict(s) for s in sections]
        res = ai_service.summarize_content(sec_dicts, focus=req.focus or "all")

        # Save summary back to material record
        db.execute("UPDATE materials SET summary = ? WHERE id = ?", (res["result"], req.material_id))

        return AIResponse(success=True, result=res["result"], is_configured=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ask", response_model=AIResponse)
def ask_question_about_material(req: AIAskQuestionRequest, db: sqlite3.Connection = Depends(get_db)):
    """Answers a question grounded strictly in the study material's extracted text (RAG)."""
    if not ai_service.is_configured:
        return AIResponse(
            success=False,
            is_configured=False,
            message="AI features require an API key. Go to Settings to configure your OpenAI-compatible API key."
        )

    if req.material_id:
        sections = db.execute(
            "SELECT * FROM material_sections WHERE material_id = ? ORDER BY section_index ASC",
            (req.material_id,)
        ).fetchall()
    elif req.topic_id:
        sections = db.execute("""
            SELECT ms.* FROM material_sections ms
            JOIN materials m ON ms.material_id = m.id
            WHERE m.topic_id = ?
        """, (req.topic_id,)).fetchall()
    else:
        raise HTTPException(status_code=400, detail="Must provide material_id or topic_id to ask questions about.")

    if not sections:
        raise HTTPException(status_code=400, detail="No study content found for this material/topic.")

    try:
        sec_dicts = [dict(s) for s in sections]
        res = ai_service.ask_question(question=req.question, sections=sec_dicts)
        return AIResponse(
            success=True,
            result=res["result"],
            citations=res.get("citations", []),
            is_configured=True
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-flashcards", response_model=AIResponse)
def generate_flashcards(req: AIGenerateFlashcardsRequest, db: sqlite3.Connection = Depends(get_db)):
    """Generates draft flashcards from material text for review."""
    if not ai_service.is_configured:
        return AIResponse(
            success=False,
            is_configured=False,
            message="AI features require an API key. Go to Settings to configure your OpenAI-compatible API key."
        )

    text_to_use = req.custom_text or ""
    if not text_to_use and req.material_id:
        sections = db.execute(
            "SELECT content FROM material_sections WHERE material_id = ? ORDER BY section_index ASC LIMIT 10",
            (req.material_id,)
        ).fetchall()
        text_to_use = "\n\n".join([s["content"] for s in sections])

    if not text_to_use:
        raise HTTPException(status_code=400, detail="No study content found to generate flashcards from.")

    try:
        res = ai_service.generate_flashcards(text=text_to_use, count=req.count or 5)
        return AIResponse(success=True, data=res["data"], is_configured=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-quiz", response_model=AIResponse)
def generate_quiz(req: AIGenerateQuizRequest, db: sqlite3.Connection = Depends(get_db)):
    """Generates 10 practice quiz questions (4 options each) from study content for interactive testing."""
    if not ai_service.is_configured:
        return AIResponse(
            success=False,
            is_configured=False,
            message="AI features require an API key. Go to Settings to configure your OpenAI-compatible API key."
        )

    text_to_use = req.custom_text or ""
    topic_context = ""

    # If material_id is provided, fetch sections and context
    if not text_to_use and req.material_id:
        mat_row = db.execute("SELECT title, topic_id FROM materials WHERE id = ?", (req.material_id,)).fetchone()
        if mat_row:
            topic_context = mat_row["title"]
            if not req.topic_id and mat_row["topic_id"]:
                req.topic_id = mat_row["topic_id"]

        sections = db.execute(
            "SELECT content FROM material_sections WHERE material_id = ? ORDER BY section_index ASC LIMIT 15",
            (req.material_id,)
        ).fetchall()
        if sections:
            text_to_use = "\n\n".join([s["content"] for s in sections])

    # If topic_id is provided, gather materials and notes for this topic
    if not text_to_use and req.topic_id:
        t_row = db.execute("SELECT name FROM topics WHERE id = ?", (req.topic_id,)).fetchone()
        if t_row:
            topic_context = t_row["name"]

        sections = db.execute("""
            SELECT ms.content FROM material_sections ms
            JOIN materials m ON ms.material_id = m.id
            WHERE m.topic_id = ?
            ORDER BY m.id ASC, ms.section_index ASC LIMIT 15
        """, (req.topic_id,)).fetchall()
        if sections:
            text_to_use = "\n\n".join([s["content"] for s in sections])
        else:
            notes = db.execute("SELECT title, content FROM notes WHERE topic_id = ?", (req.topic_id,)).fetchall()
            if notes:
                text_to_use = "\n\n".join([f"{n['title']}:\n{n['content']}" for n in notes])

    # If text is still empty but we have context, provide a context seed
    if not text_to_use:
        if topic_context:
            text_to_use = f"Core principles, key mechanisms, and foundational practices of {topic_context}."
        else:
            raise HTTPException(status_code=400, detail="No study content found to generate quiz from.")

    try:
        res = ai_service.generate_quiz(
            text=text_to_use,
            question_count=req.question_count or 10,
            difficulty=req.difficulty or "medium",
            topic_context=topic_context
        )
        return AIResponse(success=True, data=res["data"], is_configured=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
