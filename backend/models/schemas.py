"""
Pydantic schemas for request validation and API responses.
"""
from pydantic import BaseModel, Field, HttpUrl
from typing import List, Optional, Any, Dict
from datetime import datetime, date

# ----------------- Base / Utility Schemas -----------------
class StatusResponse(BaseModel):
    success: bool = True
    message: str = "Operation successful"
    data: Optional[Any] = None

# ----------------- Subjects, Chapters, Topics -----------------
class SubjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = ""
    color: Optional[str] = "#3B82F6"
    sort_order: Optional[int] = 0

class SubjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None

class TopicResponse(BaseModel):
    id: int
    chapter_id: int
    name: str
    description: Optional[str] = ""
    is_completed: bool = False
    completed_at: Optional[datetime] = None
    sort_order: int = 0
    created_at: datetime
    materials_count: Optional[int] = 0
    notes_count: Optional[int] = 0
    flashcards_count: Optional[int] = 0

class ChapterResponse(BaseModel):
    id: int
    subject_id: int
    name: str
    description: Optional[str] = ""
    sort_order: int = 0
    created_at: datetime
    topics: List[TopicResponse] = []

class SubjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = ""
    color: str = "#3B82F6"
    sort_order: int = 0
    created_at: datetime
    materials_count: Optional[int] = 0
    chapters: List[ChapterResponse] = []

class ChapterCreate(BaseModel):
    subject_id: int
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = ""
    sort_order: Optional[int] = 0

class ChapterUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = None
    sort_order: Optional[int] = None

class TopicCreate(BaseModel):
    chapter_id: int
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = ""
    sort_order: Optional[int] = 0

class TopicUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = None
    is_completed: Optional[bool] = None
    sort_order: Optional[int] = None

class DeleteFolderChoice(BaseModel):
    action: str = Field("unassign", description="'unassign' to keep materials or 'cascade' to delete contents")

# ----------------- Materials -----------------
class MaterialImportUrlRequest(BaseModel):
    url: str
    title: Optional[str] = None
    subject_id: Optional[int] = None
    chapter_id: Optional[int] = None
    topic_id: Optional[int] = None
    tags: Optional[str] = ""

class MaterialUpdate(BaseModel):
    title: Optional[str] = None
    subject_id: Optional[int] = None
    chapter_id: Optional[int] = None
    topic_id: Optional[int] = None
    tags: Optional[str] = None
    is_favorite: Optional[bool] = None
    summary: Optional[str] = None

class MaterialSectionResponse(BaseModel):
    id: int
    material_id: int
    section_index: int
    title: str = ""
    content: str
    page_or_slide: str = ""
    created_at: datetime

class BookmarkResponse(BaseModel):
    id: int
    material_id: int
    section_id: Optional[int] = None
    title: str
    note: Optional[str] = ""
    created_at: datetime

class BookmarkCreate(BaseModel):
    material_id: int
    section_id: Optional[int] = None
    title: str = Field(..., min_length=1)
    note: Optional[str] = ""

class MaterialResponse(BaseModel):
    id: int
    title: str
    source_type: str
    file_path: Optional[str] = None
    source_url: Optional[str] = None
    file_size: int = 0
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    chapter_id: Optional[int] = None
    chapter_name: Optional[str] = None
    topic_id: Optional[int] = None
    topic_name: Optional[str] = None
    tags: Optional[str] = ""
    is_favorite: bool = False
    summary: Optional[str] = ""
    last_opened_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    sections_count: Optional[int] = 0

class MaterialDetailResponse(MaterialResponse):
    sections: List[MaterialSectionResponse] = []
    bookmarks: List[BookmarkResponse] = []

# ----------------- Notes -----------------
class NoteCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = ""
    subject_id: Optional[int] = None
    topic_id: Optional[int] = None
    material_id: Optional[int] = None
    is_pinned: Optional[bool] = False

class NoteUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = None
    subject_id: Optional[int] = None
    topic_id: Optional[int] = None
    material_id: Optional[int] = None
    is_pinned: Optional[bool] = None

class NoteResponse(BaseModel):
    id: int
    title: str
    content: str
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    topic_id: Optional[int] = None
    topic_name: Optional[str] = None
    material_id: Optional[int] = None
    material_title: Optional[str] = None
    is_pinned: bool = False
    created_at: datetime
    updated_at: datetime

# ----------------- Flashcards -----------------
class FlashcardCreate(BaseModel):
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)
    material_id: Optional[int] = None
    topic_id: Optional[int] = None
    tag: Optional[str] = ""
    difficulty_level: Optional[str] = "medium"

class FlashcardUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    topic_id: Optional[int] = None
    tag: Optional[str] = None
    difficulty_level: Optional[str] = None

class FlashcardReviewRequest(BaseModel):
    rating: str = Field(..., description="'again', 'hard', 'good', or 'easy'")

class FlashcardResponse(BaseModel):
    id: int
    material_id: Optional[int] = None
    material_title: Optional[str] = None
    topic_id: Optional[int] = None
    topic_name: Optional[str] = None
    question: str
    answer: str
    tag: Optional[str] = ""
    difficulty_level: str = "medium"
    repetition_count: int = 0
    interval_days: int = 1
    ease_factor: float = 2.5
    next_review_at: date
    last_reviewed_at: Optional[datetime] = None
    created_at: datetime

# ----------------- Quizzes -----------------
class QuizQuestionCreate(BaseModel):
    question_type: str = Field("mcq", description="'mcq', 'true_false', or 'short_answer'")
    question_text: str = Field(..., min_length=1)
    options: List[str] = []
    correct_answer: str = Field(..., min_length=1)
    explanation: Optional[str] = ""
    sort_order: Optional[int] = 0

class QuizCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = ""
    material_id: Optional[int] = None
    topic_id: Optional[int] = None
    difficulty: Optional[str] = "medium"
    questions: List[QuizQuestionCreate] = []

class QuizQuestionResponse(BaseModel):
    id: int
    quiz_id: int
    question_type: str
    question_text: str
    options: List[str] = []
    correct_answer: str
    explanation: Optional[str] = ""
    sort_order: int = 0

class QuizResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = ""
    material_id: Optional[int] = None
    material_title: Optional[str] = None
    topic_id: Optional[int] = None
    topic_name: Optional[str] = None
    difficulty: str = "medium"
    questions_count: int = 0
    created_at: datetime
    questions: Optional[List[QuizQuestionResponse]] = None

class QuizAttemptSubmit(BaseModel):
    answers: Dict[str, str] = Field(..., description="Map of question_id (as string) to user answer")

class QuizAttemptResponse(BaseModel):
    id: int
    quiz_id: int
    quiz_title: Optional[str] = None
    score: float
    total_questions: int
    answers_json: List[Dict[str, Any]]
    completed_at: datetime

# ----------------- Study Sessions & Progress -----------------
class StudySessionStart(BaseModel):
    material_id: Optional[int] = None
    topic_id: Optional[int] = None
    activity_type: str = "reading"

class StudySessionEnd(BaseModel):
    session_id: int

class StudySessionResponse(BaseModel):
    id: int
    material_id: Optional[int] = None
    material_title: Optional[str] = None
    topic_id: Optional[int] = None
    topic_name: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: int = 0
    activity_type: str
    created_at: datetime

class ProgressStatsResponse(BaseModel):
    topics_total: int
    topics_completed: int
    materials_total: int
    notes_total: int
    flashcards_total: int
    flashcards_due_today: int
    quizzes_total: int
    quiz_attempts_total: int
    average_quiz_score: float
    total_study_time_minutes: int
    recently_studied_materials: List[MaterialResponse] = []
    topics_needing_practice: List[Dict[str, Any]] = []

# ----------------- AI Requests & Responses -----------------
class AIExplainRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text passage or concept to explain")
    style: str = Field("simple", description="'simple', 'example', 'step_by_step', 'business', 'revision'")
    context_material_id: Optional[int] = None

class AISummaryRequest(BaseModel):
    material_id: int
    focus: Optional[str] = "all"  # 'all', 'key_points', 'definitions', 'takeaways'

class AIAskQuestionRequest(BaseModel):
    material_id: Optional[int] = None
    topic_id: Optional[int] = None
    question: str = Field(..., min_length=1)

class AIGenerateFlashcardsRequest(BaseModel):
    material_id: Optional[int] = None
    topic_id: Optional[int] = None
    custom_text: Optional[str] = None
    count: Optional[int] = 5

class AIGenerateQuizRequest(BaseModel):
    material_id: Optional[int] = None
    topic_id: Optional[int] = None
    custom_text: Optional[str] = None
    question_count: Optional[int] = 10
    question_type: Optional[str] = "mcq"  # strictly 4-option multiple choice
    difficulty: Optional[str] = "medium"

class AIResponse(BaseModel):
    success: bool
    result: Optional[str] = None
    data: Optional[Any] = None
    citations: Optional[List[Dict[str, Any]]] = None
    message: Optional[str] = None
    is_configured: bool = True

# ----------------- Search -----------------
class SearchResultItem(BaseModel):
    entity_type: str  # 'material', 'section', 'note', 'flashcard', 'quiz'
    entity_id: int
    title: str
    excerpt: str
    subject_name: Optional[str] = None
    topic_name: Optional[str] = None
    tags: Optional[str] = ""
    target_url: str

class SearchResponse(BaseModel):
    query: str
    total_results: int
    results: List[SearchResultItem] = []

# ----------------- Settings & Health -----------------
class SystemHealthResponse(BaseModel):
    status: str
    app_name: str
    version: str
    database_connected: bool
    ai_configured: bool
    ai_model: str
    data_dir_size_mb: float
    total_materials: int

# ----------------- Calendar Events & Important Dates -----------------
class CalendarEventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = ""
    event_date: str = Field(..., min_length=10, max_length=10) # 'YYYY-MM-DD'
    event_time: Optional[str] = "" # 'HH:MM' or empty
    category: Optional[str] = "event" # 'event', 'exam', 'assignment', 'milestone', 'deadline', 'revision'
    priority: Optional[str] = "normal" # 'normal', 'high', 'urgent'
    subject_id: Optional[int] = None
    topic_id: Optional[int] = None

class CalendarEventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    event_date: Optional[str] = None
    event_time: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    subject_id: Optional[int] = None
    topic_id: Optional[int] = None
    is_completed: Optional[bool] = None

class CalendarEventResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = ""
    event_date: str
    event_time: Optional[str] = ""
    category: str = "event"
    priority: str = "normal"
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    topic_id: Optional[int] = None
    topic_name: Optional[str] = None
    is_completed: bool = False
    created_at: Any
    updated_at: Any
