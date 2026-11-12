# StudySpace — Personal AI Learning Platform

> **Everything you study, organized in one place and easier to understand.**

🌐 **Live Vercel Application**: [https://study-space-xi-six.vercel.app](https://study-space-xi-six.vercel.app)  
📖 **Interactive API Documentation**: [https://study-space-xi-six.vercel.app/docs](https://study-space-xi-six.vercel.app/docs)  
📦 **GitHub Repository**: [https://github.com/Piyushmittal20/StudySpace](https://github.com/Piyushmittal20/StudySpace)

---

## 📑 Table of Contents

- [Core Features](#-core-features)
- [Technology Stack](#-technology-stack)
- [Folder Structure](#-folder-structure)
- [Prerequisites](#-prerequisites)
- [Windows Installation Guide (Beginner-Friendly)](#-windows-installation-guide-beginner-friendly)
- [Running StudySpace](#-running-studyspace)
- [Importing Study Materials](#-importing-study-materials)
- [Configuring AI Tools](#-configuring-ai-tools)
- [Automated Testing & Postman](#-automated-testing--postman)
- [Data Storage, Backups & Restoration](#-data-storage-backups--restoration)
- [Troubleshooting & Common Questions](#-troubleshooting--common-questions)

---

## 🌟 Core Features

1. **Dashboard Overview**: Immediate answers to *What have I been studying?*, *Where can I find my material?*, and *What should I revise next?*
2. **My Library**: Searchable repository with grid/list views, type filtering (PDF, DOCX, PPTX, TXT, MD, XLSX, Web, Video), favorites, and instant document navigation.
3. **Curriculum Hierarchy**: Flexible tree structure (`Subject → Chapter → Topic → Study Material`) with topic completion checkboxes and safe folder deletion that protects your notes and files.
4. **Study Room**: Focused reader with section/page navigation, bookmarking, side-by-side personal notes drawer, and live study session timing.
5. **Truthful AI Learning Tools**:
   - **Explain Simply**: 5 distinct explanation styles (Simple English, Real-World Example, Step-by-Step, Business Scenario, Quick Revision).
   - **Smart Summaries**: Structured overviews with key definitions and high-yield takeaways.
   - **Grounded Q&A (RAG)**: Chat with your material where answers are strictly derived from your source text with section/page citations.
   - **AI Flashcards & Quizzes**: Automatically extracts revision cards and practice questions for your review before saving.
   - **Graceful Fallback**: 100% of non-AI features work seamlessly without an API key; no fake or fabricated answers.
6. **Spaced Repetition Flashcards**: Interactive 3D flip study mode using an SM-2 spaced repetition algorithm (`Again`, `Hard`, `Good`, `Easy`) that schedules future revisions automatically.
7. **Interactive Quizzes**: Multiple-choice, true/false, and short-answer practice assessments with real-time scoring, explanations, and mistake analysis.
8. **Personal Notes & Knowledge**: Markdown-ready note-taking linked directly to subjects or documents, with auto-save, pinning, and one-click conversion into flashcards.
9. **Global Full-Text Search**: Fast SQLite FTS5 search across document contents, note bodies, flashcards, and quiz questions.
10. **Learning Analytics**: Real progress indicators (topics completed, study durations, quiz attempt histories, topics needing practice).
11. **Privacy by Default**: All files and SQLite database records stay on your computer.

---

## 🛠 Technology Stack

- **Backend**: Python 3.10+ with [FastAPI](https://fastapi.tiangolo.com/) and [Uvicorn](https://www.uvicorn.org/)
- **Database**: [SQLite](https://www.sqlite.org/) (Local file with WAL mode and FTS5 full-text search)
- **Frontend**: Clean HTML5, [Tailwind CSS](https://tailwindcss.com/) (CDN), and Vanilla JavaScript (No React, Vue, or build tools required)
- **Document Extractors**: `pypdf` (PDF), `python-docx` (DOCX), `python-pptx` (PPTX), `openpyxl` (XLSX), `beautifulsoup4` (Web HTML)
- **Automated Testing**: `pytest` and Postman collection

---

## 📁 Folder Structure

```text
LMS/
├── backend/
│   ├── config.py             # Settings, limits, and .env loader
│   ├── database.py           # SQLite tables, connection manager, FTS5 sync
│   ├── main.py               # FastAPI application entry point & static routes
│   ├── models/
│   │   └── schemas.py        # Pydantic request & response models
│   ├── routers/
│   │   ├── health.py         # System health & diagnostics
│   │   ├── subjects.py       # Subjects, chapters, topics CRUD
│   │   ├── materials.py      # File upload, web import, bookmarks
│   │   ├── notes.py          # Personal notes & flashcard conversion
│   │   ├── flashcards.py     # Flashcard deck & spaced repetition (SRS)
│   │   ├── quizzes.py        # Quiz creation, taking, scoring, and history
│   │   ├── progress.py       # Study sessions & learning analytics
│   │   ├── search.py         # Multi-entity global search
│   │   ├── ai.py             # Explain, summarize, grounded Q&A
│   │   └── system.py         # Runtime AI settings & backup/restore
│   └── services/
│       ├── extractor.py      # Text extractor (PDF, DOCX, PPTX, TXT, MD, XLSX)
│       ├── web_importer.py   # Web scraper, article cleaner, SSRF protection
│       ├── ai_service.py     # OpenAI-compatible API client
│       ├── search_service.py # SQLite FTS5 and LIKE search engine
│       └── backup_service.py # Local ZIP backup and restore manager
├── data/
│   ├── uploads/              # Local storage for uploaded files (gitignored)
│   ├── backups/              # Local ZIP backup archives (gitignored)
│   └── studyspace.db         # SQLite database file (gitignored)
├── frontend/
│   ├── index.html            # Single-page application interface
│   ├── css/
│   │   └── style.css         # Custom animations, 3D flip card, typography
│   └── js/
│       ├── api.js            # Unified backend API client
│       ├── state.js          # Shared state & toast notifications
│       ├── app.js            # Router, global search, and modal handling
│       ├── dashboard.js      # Dashboard widgets & revision alerts
│       ├── library.js        # Library card/list views & filters
│       ├── subjects.js       # Hierarchy tree & safe folder deletion
│       ├── study_room.js     # Reader view, bookmarks, AI sidepanel
│       ├── notes.js          # Notes manager & auto-save
│       ├── flashcards.js     # 3D flip study mode & SRS grading
│       ├── quizzes.js        # Interactive quiz taking & mistake review
│       ├── progress.js       # Learning analytics & session timer
│       └── settings.js       # AI config & backup/restore UI
├── tests/                    # Automated pytest test suite
├── StudySpace.postman_collection.json # Ready-to-import Postman collection
├── .env.example              # Environment variables template
├── .gitignore                # Version control exclusions
├── requirements.txt          # Python dependencies
└── README.md                 # Project documentation
```

---

## 💻 Prerequisites

- **Operating System**: Windows 10 or 11 (also runs on macOS/Linux)
- **Python**: Version 3.10, 3.11, 3.12, 3.13, or 3.14 (Python 3.14 verified)
- **Web Browser**: Microsoft Edge, Google Chrome, Mozilla Firefox, or Brave

---

## 🚀 Windows Installation Guide (Beginner-Friendly)

Open **PowerShell** or **Command Prompt** in the project folder (`c:\Users\mitta\OneDrive\Documents\LMS`):

### Step 1: Create a Python Virtual Environment
A virtual environment keeps StudySpace's libraries isolated from your computer's global Python installation.

```powershell
python -m venv venv
```

### Step 2: Activate the Virtual Environment
Activate the environment so that commands run inside it:

```powershell
.\venv\Scripts\activate
```
*(You will see `(venv)` appear at the beginning of your command line prompt).*

### Step 3: Install Required Dependencies
Install all required libraries with a single command:

```powershell
pip install -r requirements.txt
```

### Step 4: Configure Local Environment (`.env`)
Copy the example environment file to `.env`:

```powershell
Copy-Item .env.example .env
```

---

## 🌐 Accessing StudySpace

### 1. Live Web Application (Permanent Vercel Link)
StudySpace is deployed and available globally via Vercel:
- 👉 **Web Application**: **[https://study-space-xi-six.vercel.app](https://study-space-xi-six.vercel.app)**
- 👉 **Interactive API Docs (Swagger UI)**: **[https://study-space-xi-six.vercel.app/docs](https://study-space-xi-six.vercel.app/docs)**

---

## 💻 Running Locally (Optional)

If you prefer running StudySpace offline on your local computer:

### 1. Start the Backend Server
With your Python virtual environment active, run:

```powershell
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Open Local Instance in Browser
- 👉 **Local App**: **[http://127.0.0.1:8000](http://127.0.0.1:8000)**
- 👉 **Local API Docs**: **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**

---

## 📥 Importing Study Materials

Click the blue **`+ Add Study Material`** button at the top right of the navigation bar:

### Option A: Upload From Computer
1. Choose **Upload From Computer**.
2. Select any local file:
   - **PDF** (`.pdf`) — Page-by-page extraction preserving document layout.
   - **Word** (`.docx`) — Extracts headings, sections, and paragraphs.
   - **PowerPoint** (`.pptx`) — Slide-by-slide titles and bullet points.
   - **Markdown** (`.md`) / **Text** (`.txt`) — Sectioned by headers or readable chunks.
   - **Excel** (`.xlsx`) — Clean tabular worksheet text extraction.
3. Optionally enter a custom title, assign to a Subject, or add tags.
4. Click **Upload & Extract**. The document opens automatically in the **Study Room**.

### Option B: Import From the Internet
1. Choose **Import Web Article / Video Link**.
2. Paste any publicly accessible URL:
   - **Web Articles & Documentation**: Strips advertisements, menus, and cookies, extracting clean educational text.
   - **YouTube & Online Videos**: Saves the video link and metadata so you can study and take notes while watching.
3. Click **Import Content**.
*(Security Notice: StudySpace includes SSRF protection that blocks internal/localhost addresses to keep your computer safe).*

---

## 🤖 Configuring AI Tools

StudySpace is designed around **Truthful AI**: answers are grounded strictly in your source documents, with explicit citations to pages and sections.

You can use **any OpenAI-compatible provider** (OpenAI, Groq, OpenRouter, local Ollama, etc.):

### How to Configure in the User Interface:
1. Open StudySpace and click **Settings** in the sidebar.
2. In the **AI Learning Tools Configuration** card:
   - Enter your **API Key** (e.g. `sk-...`).
   - (Optional) Set **API Base URL** (defaults to `https://api.openai.com/v1`).
   - (Optional) Set **Model Name** (defaults to `gpt-4o-mini`).
3. Click **Save AI Settings**.
4. The status badge will turn green (`✓ Configured`).

### What if I don't have an AI API key?
All non-AI features—uploading, reading, section navigation, full-text search, manual flashcards, spaced-repetition revision, quiz taking, note-taking, and progress analytics—work **100% without an API key**. When AI is unconfigured, AI buttons display a helpful setup guide instead of crashing or generating fake answers.

---

## 🧪 Automated Testing & Postman

### Running Automated Pytest Tests
StudySpace includes a comprehensive automated test suite covering health diagnostics, uploads, document extractors, web importer security, notes, flashcard SRS scheduling, quizzes, search, and AI fallback:

```powershell
.\venv\Scripts\python.exe -m pytest -v
```

All 12 test suites run and pass in under 2 seconds.

### Using the Postman Collection
A complete, pre-configured Postman collection is included in the project root:
`StudySpace.postman_collection.json`

1. Open **Postman**.
2. Click **Import** (top left).
3. Select `StudySpace.postman_collection.json`.
4. Ensure the `baseUrl` collection variable is set to `http://127.0.0.1:8000`.
5. Execute requests across the 10 organized workflow folders.

---

## 💾 Data Storage, Backups & Restoration

### Data Storage Locations
- **Database**: `data/studyspace.db` (SQLite single-file database)
- **Uploaded Files**: `data/uploads/` (Local filesystem directory)
- **Backups**: `data/backups/` (ZIP archives)

Restarting the server or refreshing your web browser **never erases your data**.

### Creating an Instant Backup:
- In the web app, go to **Settings** and click **📦 Create Backup Now**.
- StudySpace packages your entire SQLite database and all uploaded study documents into a timestamped `.zip` file inside `data/backups/`.
- Click **Download** to save the archive to an external USB drive or folder.

### Restoring from a Backup:
- In **Settings**, find your desired backup archive and click **Restore**.
- StudySpace prompts you with a clear confirmation warning to prevent accidental overwrites, automatically takes a pre-restore safety snapshot of your current data, and restores the selected archive.

---

## ❓ Troubleshooting & Common Questions

#### 1. Port 8000 is already in use
If another application is using port 8000, start StudySpace on another port (such as 8080):
```powershell
uvicorn backend.main:app --port 8080 --reload
```
Then visit `http://127.0.0.1:8080` in your browser.

#### 2. Virtual environment activation error in PowerShell
If PowerShell displays `Execution of scripts is disabled on this system`:
Run PowerShell as Administrator and execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Then activate again: `.\venv\Scripts\activate`.

#### 3. Where are my uploaded files stored?
They are stored locally in the `data/uploads/` directory inside the project folder. No files are uploaded to any external cloud storage.

#### 4. Can I search inside PDFs and Word documents?
Yes. When a file is uploaded, readable text is extracted and indexed into SQLite's full-text search engine (FTS5). Use the global search bar (`Ctrl+K`) to search across any phrase inside your documents.
