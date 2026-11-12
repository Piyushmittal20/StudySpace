import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_study_session_progress_and_backup():
    """Tests study session timing, progress stats calculation, and backup creation."""
    # 1. Start study session
    start_res = client.post("/api/progress/session/start", json={
        "activity_type": "reading"
    })
    assert start_res.status_code == 200
    session_id = start_res.json()["id"]

    # 2. End study session
    end_res = client.post("/api/progress/session/end", json={
        "session_id": session_id
    })
    assert end_res.status_code == 200
    assert end_res.json()["duration_seconds"] >= 0

    # 3. Check progress statistics
    stats_res = client.get("/api/progress/stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert "topics_total" in stats
    assert "average_quiz_score" in stats
    assert "total_study_time_minutes" in stats

    # 4. Trigger backup creation
    backup_res = client.post("/api/system/backup")
    assert backup_res.status_code == 200
    assert backup_res.json()["success"] is True

    # 5. List backups
    list_res = client.get("/api/system/backups")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1
