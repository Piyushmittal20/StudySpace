@echo off
title StudySpace - Personal AI Learning Platform
echo Starting StudySpace...
echo Open your browser at: http://127.0.0.1:8000
echo.
call .\venv\Scripts\activate
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
pause
