import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_notes_crud_and_conversion():
    """Tests note creation, updating, pinning, and converting to a flashcard."""
    # 1. Create note
    res = client.post("/api/notes", json={
        "title": "Amdahl's Law Note",
        "content": "Gives the theoretical speedup in latency of the execution of a task at fixed workload.",
        "is_pinned": False
    })
    assert res.status_code == 200
    note = res.json()
    note_id = note["id"]

    # 2. Update note (autosave test)
    upd_res = client.put(f"/api/notes/{note_id}", json={
        "title": "Amdahl's Law Formula",
        "content": "S_latency(s) = 1 / ((1 - p) + (p / s))",
        "is_pinned": True
    })
    assert upd_res.status_code == 200

    # 3. Verify get note
    get_res = client.get(f"/api/notes/{note_id}")
    assert get_res.json()["title"] == "Amdahl's Law Formula"
    assert get_res.json()["is_pinned"] is True

    # 4. Convert note to flashcard
    conv_res = client.post(f"/api/notes/{note_id}/to-flashcard")
    assert conv_res.status_code == 200
    fc = conv_res.json()
    assert fc["question"] == "Amdahl's Law Formula"

    # 5. Delete note
    del_res = client.delete(f"/api/notes/{note_id}")
    assert del_res.status_code == 200

def test_flashcard_spaced_repetition():
    """Tests flashcard creation and spaced repetition interval progression."""
    # 1. Create flashcard
    create_res = client.post("/api/flashcards", json={
        "question": "What is a deadlock in OS?",
        "answer": "A situation where a set of processes are blocked because each is holding a resource and waiting for another.",
        "tag": "OS"
    })
    assert create_res.status_code == 200
    card_id = create_res.json()["id"]

    # 2. Review rating: Good
    rev_res = client.post(f"/api/flashcards/{card_id}/review", json={"rating": "good"})
    assert rev_res.status_code == 200
    updated_card = rev_res.json()
    assert updated_card["repetition_count"] == 1
    assert updated_card["interval_days"] >= 1

    # 3. Clean up
    client.delete(f"/api/flashcards/{card_id}")

def test_quiz_attempt_and_scoring():
    """Tests creating a quiz, taking it, computing score, and reviewing mistakes."""
    # 1. Create Quiz
    create_res = client.post("/api/quizzes", json={
        "title": "Concurrency Mini Quiz",
        "description": "Tests threads and locks",
        "difficulty": "medium",
        "questions": [
            {
                "question_type": "mcq",
                "question_text": "What is a mutex?",
                "options": ["Mutual exclusion lock", "A network protocol", "A CPU register", "A disk format"],
                "correct_answer": "Mutual exclusion lock",
                "explanation": "A mutex provides mutually exclusive access to a shared resource."
            },
            {
                "question_type": "true_false",
                "question_text": "A race condition occurs when outcome depends on execution timing.",
                "options": ["True", "False"],
                "correct_answer": "True",
                "explanation": "Race conditions arise from non-synchronized concurrent access."
            }
        ]
    })
    assert create_res.status_code == 200
    quiz_id = create_res.json()["id"]

    # 2. Submit Attempt (1 correct, 1 wrong)
    q_data = client.get(f"/api/quizzes/{quiz_id}").json()
    q1_id = str(q_data["questions"][0]["id"])
    q2_id = str(q_data["questions"][1]["id"])

    attempt_res = client.post(f"/api/quizzes/{quiz_id}/attempt", json={
        "answers": {
            q1_id: "Mutual exclusion lock", # correct
            q2_id: "False"                  # wrong
        }
    })
    assert attempt_res.status_code == 200
    attempt = attempt_res.json()
    assert attempt["score"] == 50.0 # 1 out of 2 = 50%
    assert attempt["total_questions"] == 2
    assert attempt["answers_json"][0]["is_correct"] is True
    assert attempt["answers_json"][1]["is_correct"] is False

    # 3. Retrieve past attempts
    hist_res = client.get(f"/api/quizzes/{quiz_id}/attempts")
    assert hist_res.status_code == 200
    assert len(hist_res.json()) >= 1

    # 4. Clean up
    client.delete(f"/api/quizzes/{quiz_id}")
