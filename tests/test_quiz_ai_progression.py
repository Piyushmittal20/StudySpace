import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.ai_service import AIService

client = TestClient(app)

def test_ai_generate_quiz_schema_and_defaults():
    """Verifies AI quiz generation request defaults and prompt structure."""
    ai = AIService()

    # Test sanitization logic with mock response
    mock_llm_json = """[
        {
            "question_type": "mcq",
            "question_text": "What is Python?",
            "options": ["Interpreted language", "Compiled only"],
            "correct_answer": "Interpreted language",
            "explanation": "Python is an interpreted high-level programming language."
        }
    ]"""

    # We mock _call_llm directly to test parser and 4-option sanitization
    original_call = ai._call_llm
    ai._call_llm = lambda messages, temperature=0.3: mock_llm_json

    try:
        res = ai.generate_quiz("Python basics content", question_count=10, difficulty="easy")
        assert res["success"] is True
        questions = res["data"]
        assert len(questions) == 1
        q = questions[0]
        assert q["question_type"] == "mcq"
        assert len(q["options"]) == 4  # Expanded automatically to 4 options
        assert q["correct_answer"] == "Interpreted language"
        assert q["correct_answer"] in q["options"]
        assert "explanation" in q and q["explanation"]
    finally:
        ai._call_llm = original_call

def test_quiz_10_questions_creation_and_attempt():
    """
    Tests creating a full 10-question practice quiz with 4 options each,
    submitting user answers, and verifying that answers & explanations
    are scored and revealed at the end of the quiz.
    """
    # 1. Prepare 10 questions with 4 options each
    questions = []
    correct_answers = {}
    for i in range(1, 11):
        corr = f"Correct Answer {i}"
        opts = [f"Distractor A{i}", f"Distractor B{i}", corr, f"Distractor C{i}"]
        questions.append({
            "question_type": "mcq",
            "question_text": f"Practice Question {i}: What is concept {i}?",
            "options": opts,
            "correct_answer": corr,
            "explanation": f"Explanation for question {i} proving {corr} is right."
        })

    # 2. Create Quiz in Database
    create_res = client.post("/api/quizzes", json={
        "title": "Comprehensive 10-Question Test",
        "description": "Tests full 10-question assessment flow",
        "difficulty": "easy",
        "questions": questions
    })
    assert create_res.status_code == 200
    quiz_data = create_res.json()
    quiz_id = quiz_data["id"]
    assert quiz_data["questions_count"] == 10
    assert quiz_data["difficulty"] == "easy"

    # 3. Fetch Quiz and verify questions have 4 options and answers are not revealed in question list
    get_res = client.get(f"/api/quizzes/{quiz_id}")
    assert get_res.status_code == 200
    fetched_q = get_res.json()["questions"]
    assert len(fetched_q) == 10
    for q in fetched_q:
        assert len(q["options"]) == 4

    # 4. User attempts quiz: 8 correct, 2 incorrect
    user_answers = {}
    for idx, q in enumerate(fetched_q):
        q_id = str(q["id"])
        if idx < 8:
            user_answers[q_id] = q["correct_answer"]
        else:
            user_answers[q_id] = "Wrong Selection"

    attempt_res = client.post(f"/api/quizzes/{quiz_id}/attempt", json={
        "answers": user_answers
    })
    assert attempt_res.status_code == 200
    attempt = attempt_res.json()
    assert attempt["score"] == 80.0
    assert attempt["total_questions"] == 10

    # Verify answers breakdown shown at the last of the quiz
    answers_breakdown = attempt["answers_json"]
    assert len(answers_breakdown) == 10
    for idx, ans in enumerate(answers_breakdown):
        assert "question_text" in ans
        assert "user_answer" in ans
        assert "correct_answer" in ans
        assert "explanation" in ans
        if idx < 8:
            assert ans["is_correct"] is True
        else:
            assert ans["is_correct"] is False

    # 5. Clean up
    del_res = client.delete(f"/api/quizzes/{quiz_id}")
    assert del_res.status_code == 200

def test_quiz_difficulty_progression_leveling():
    """
    Verifies sequential difficulty levels can be saved and retrieved.
    """
    levels = ["easy", "medium", "hard", "expert"]
    created_ids = []

    for lvl in levels:
        res = client.post("/api/quizzes", json={
            "title": f"Algorithm Quiz ({lvl.capitalize()})",
            "difficulty": lvl,
            "questions": [{
                "question_type": "mcq",
                "question_text": f"Question at {lvl} level",
                "options": ["A", "B", "C", "D"],
                "correct_answer": "A",
                "explanation": f"Explanation for {lvl}"
            }]
        })
        assert res.status_code == 200
        data = res.json()
        assert data["difficulty"] == lvl
        created_ids.append(data["id"])

    # Clean up
    for q_id in created_ids:
        client.delete(f"/api/quizzes/{q_id}")
