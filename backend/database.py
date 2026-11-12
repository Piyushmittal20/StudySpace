"""
Database module for StudySpace.
Provides SQLite connection management, schema initialization, and FTS5 full-text search.
"""
import sqlite3
from typing import Generator
from contextlib import contextmanager
from backend import config

def get_connection() -> sqlite3.Connection:
    """Creates and configures a SQLite connection."""
    conn = sqlite3.connect(str(config.DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    return conn

@contextmanager
def get_db_context() -> Generator[sqlite3.Connection, None, None]:
    """Context manager for database connections outside FastAPI route handlers."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def get_db() -> Generator[sqlite3.Connection, None, None]:
    """FastAPI dependency for database session."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    """Initializes database tables, indexes, and full-text search indexes safely."""
    with get_db_context() as conn:
        cursor = conn.cursor()

        # 1. Subjects table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS subjects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT DEFAULT '',
            color TEXT DEFAULT '#3B82F6',
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 2. Chapters table (Subject -> Chapter)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS chapters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(subject_id, name)
        );
        """)

        # 3. Topics table (Chapter -> Topic)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            is_completed INTEGER DEFAULT 0,
            completed_at TIMESTAMP,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(chapter_id, name)
        );
        """)

        # 4. Materials table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            source_type TEXT NOT NULL, -- 'pdf', 'docx', 'pptx', 'txt', 'md', 'xlsx', 'web', 'video'
            file_path TEXT,
            source_url TEXT,
            file_size INTEGER DEFAULT 0,
            subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
            chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
            topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
            tags TEXT DEFAULT '',
            is_favorite INTEGER DEFAULT 0,
            summary TEXT DEFAULT '',
            last_opened_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 5. Material Sections (extracted document chunks / pages / slides / web sections)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS material_sections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
            section_index INTEGER NOT NULL,
            title TEXT DEFAULT '',
            content TEXT NOT NULL,
            page_or_slide TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 6. Notes table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
            topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
            material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL,
            is_pinned INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 7. Flashcards table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS flashcards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL,
            topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            tag TEXT DEFAULT '',
            difficulty_level TEXT DEFAULT 'medium',
            repetition_count INTEGER DEFAULT 0,
            interval_days INTEGER DEFAULT 1,
            ease_factor REAL DEFAULT 2.5,
            next_review_at DATE DEFAULT CURRENT_DATE,
            last_reviewed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 8. Quizzes table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS quizzes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL,
            topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
            difficulty TEXT DEFAULT 'medium',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 9. Quiz Questions table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS quiz_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
            question_type TEXT NOT NULL DEFAULT 'mcq', -- 'mcq', 'true_false', 'short_answer'
            question_text TEXT NOT NULL,
            options TEXT DEFAULT '[]', -- JSON array of strings
            correct_answer TEXT NOT NULL,
            explanation TEXT DEFAULT '',
            sort_order INTEGER DEFAULT 0
        );
        """)

        # 10. Quiz Attempts table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS quiz_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
            score REAL NOT NULL,
            total_questions INTEGER NOT NULL,
            answers_json TEXT NOT NULL DEFAULT '[]',
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 11. Bookmarks table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS bookmarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
            section_id INTEGER REFERENCES material_sections(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            note TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 12. Study Sessions table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS study_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL,
            topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP,
            duration_seconds INTEGER DEFAULT 0,
            activity_type TEXT DEFAULT 'reading', -- 'reading', 'flashcards', 'quiz', 'notes'
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 13. Key-Value Settings table (for UI preferences, AI overrides, etc.)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings_kv (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        """)

        # 14. Calendar Events & Important Dates table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS calendar_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            event_date TEXT NOT NULL, -- 'YYYY-MM-DD'
            event_time TEXT DEFAULT '', -- 'HH:MM' or empty
            category TEXT DEFAULT 'event', -- 'event', 'exam', 'assignment', 'milestone', 'deadline', 'revision'
            priority TEXT DEFAULT 'normal', -- 'normal', 'high', 'urgent'
            subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
            topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
            is_completed INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Indexes for fast lookups
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_materials_subject ON materials(subject_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_materials_topic ON materials(topic_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_materials_favorite ON materials(is_favorite);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sections_material ON material_sections(material_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_notes_material ON notes(material_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_notes_topic ON notes(topic_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_flashcards_next_review ON flashcards(next_review_at);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_flashcards_topic ON flashcards(topic_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_quizzes_topic ON quizzes(topic_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_study_sessions_date ON study_sessions(start_time);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_calendar_events_subject ON calendar_events(subject_id);")

        # FTS5 Full Text Search Table
        try:
            cursor.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS fts_index USING fts5(
                entity_type,  -- 'material', 'section', 'note', 'flashcard'
                entity_id,
                title,
                content,
                tags,
                tokenize = 'porter unicode61'
            );
            """)
        except sqlite3.OperationalError:
            # Fallback if FTS5 is not compiled (though verified working)
            pass

def sync_fts_entry(conn: sqlite3.Connection, entity_type: str, entity_id: int, title: str, content: str, tags: str = ""):
    """Synchronizes an item into the FTS5 search index."""
    try:
        conn.execute("DELETE FROM fts_index WHERE entity_type = ? AND entity_id = ?", (entity_type, str(entity_id)))
        conn.execute(
            "INSERT INTO fts_index (entity_type, entity_id, title, content, tags) VALUES (?, ?, ?, ?, ?)",
            (entity_type, str(entity_id), title or "", content or "", tags or "")
        )
    except Exception:
        # Graceful fallback if FTS table is not present
        pass

def delete_fts_entry(conn: sqlite3.Connection, entity_type: str, entity_id: int):
    """Deletes an item from the FTS5 search index."""
    try:
        conn.execute("DELETE FROM fts_index WHERE entity_type = ? AND entity_id = ?", (entity_type, str(entity_id)))
    except Exception:
        pass
