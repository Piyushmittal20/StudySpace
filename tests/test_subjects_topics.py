import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_subject_chapter_topic_lifecycle():
    """Tests creating, querying, toggling, and safely deleting subjects, chapters, and topics."""
    # 1. Create Subject
    sub_res = client.post("/api/subjects", json={
        "name": "Finance & Accounting",
        "description": "Financial statements and reporting",
        "color": "#10B981"
    })
    assert sub_res.status_code == 200
    sub_data = sub_res.json()
    sub_id = sub_data["id"]
    assert sub_data["name"] == "Finance & Accounting"

    # 2. Create Chapter
    chap_res = client.post("/api/subjects/chapters", json={
        "subject_id": sub_id,
        "name": "Chapter 1: Revenue Recognition"
    })
    assert chap_res.status_code == 200
    chap_data = chap_res.json()
    chap_id = chap_data["id"]

    # 3. Create Topic
    top_res = client.post("/api/subjects/topics", json={
        "chapter_id": chap_id,
        "name": "Topic: Five-Step Revenue Model"
    })
    assert top_res.status_code == 200
    top_data = top_res.json()
    top_id = top_data["id"]
    assert top_data["is_completed"] is False

    # 4. Verify Tree
    tree_res = client.get("/api/subjects")
    assert tree_res.status_code == 200
    tree_data = tree_res.json()
    found_sub = next((s for s in tree_data if s["id"] == sub_id), None)
    assert found_sub is not None
    assert len(found_sub["chapters"]) >= 1
    found_chap = next((c for c in found_sub["chapters"] if c["id"] == chap_id), None)
    assert found_chap is not None
    assert len(found_chap["topics"]) >= 1

    # 5. Toggle Topic Completion
    toggle_res = client.post(f"/api/subjects/topics/{top_id}/toggle-complete")
    assert toggle_res.status_code == 200
    assert toggle_res.json()["data"]["is_completed"] is True

    # 6. Safe delete topic
    del_top_res = client.request("DELETE", f"/api/subjects/topics/{top_id}", json={"action": "unassign"})
    assert del_top_res.status_code == 200

    # 7. Safe delete chapter
    del_chap_res = client.request("DELETE", f"/api/subjects/chapters/{chap_id}", json={"action": "unassign"})
    assert del_chap_res.status_code == 200

    # 8. Safe delete subject
    del_sub_res = client.request("DELETE", f"/api/subjects/{sub_id}", json={"action": "unassign"})
    assert del_sub_res.status_code == 200
