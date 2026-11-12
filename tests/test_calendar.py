import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_calendar_crud_lifecycle():
    # 1. Initially empty or list
    res = client.get("/api/calendar/events")
    assert res.status_code == 200
    initial_events = res.json()
    assert isinstance(initial_events, list)

    # 2. Create a subject to test linking
    sub_res = client.post("/api/subjects", json={"name": "Subject For Calendar Test"})
    assert sub_res.status_code in (200, 201)
    subject_id = sub_res.json()["id"]

    # 3. Create an event linked to that subject
    payload = {
        "title": "Product Strategy Final Exam",
        "description": "Comprehensive evaluation covering topics 1 to 5.",
        "event_date": "2026-11-20",
        "event_time": "14:30",
        "category": "exam",
        "priority": "urgent",
        "subject_id": subject_id
    }
    create_res = client.post("/api/calendar/events", json=payload)
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["id"] > 0
    assert created["title"] == payload["title"]
    assert created["category"] == "exam"
    assert created["priority"] == "urgent"
    assert created["event_date"] == "2026-11-20"
    assert created["is_completed"] is False
    assert created["subject_id"] == subject_id
    assert created["subject_name"] == "Subject For Calendar Test"
    event_id = created["id"]

    # 4. Retrieve event by ID
    get_res = client.get(f"/api/calendar/events/{event_id}")
    assert get_res.status_code == 200
    assert get_res.json()["title"] == payload["title"]
    assert get_res.json()["subject_id"] == subject_id
    assert get_res.json()["subject_name"] == "Subject For Calendar Test"

    # 5. Filter by subject_id
    sub_filter_res = client.get(f"/api/calendar/events?subject_id={subject_id}")
    assert sub_filter_res.status_code == 200
    sub_events = sub_filter_res.json()
    assert len(sub_events) >= 1
    assert any(e["id"] == event_id for e in sub_events)

    # 6. Filter by category
    filter_res = client.get("/api/calendar/events?category=exam")
    assert filter_res.status_code == 200
    matching = [e for e in filter_res.json() if e["id"] == event_id]
    assert len(matching) == 1

    # 7. Update event (mark completed, unassign subject)
    update_res = client.put(f"/api/calendar/events/{event_id}", json={
        "title": "Product Strategy Final Exam - Passed",
        "is_completed": True,
        "subject_id": None
    })
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["title"] == "Product Strategy Final Exam - Passed"
    assert updated["is_completed"] is True
    assert updated["subject_id"] is None

    # 8. Delete event
    del_res = client.delete(f"/api/calendar/events/{event_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # Verify deleted
    get_after_del = client.get(f"/api/calendar/events/{event_id}")
    assert get_after_del.status_code == 404

    # Cleanup test subject
    client.request("DELETE", f"/api/subjects/{subject_id}", json={"action": "delete"})


def test_calendar_frontend_elements():
    with open("frontend/index.html", "r", encoding="utf-8") as f:
        html = f.read()

    # Desktop sidebar nav contains calendar tab with title and nav-label
    assert 'data-nav-view="calendar"' in html
    assert 'title="Calendar"' in html
    assert '<span class="nav-label">Calendar</span>' in html

    # Section view exists
    assert 'id="view-calendar"' in html
    assert 'id="calendar-grid-cells"' in html
    assert 'id="calendar-event-modal"' in html
    assert 'id="cal-search-subject-input"' in html
    assert 'id="cal-selected-subject-id"' in html
    assert 'id="cal-search-topic-input"' in html
    assert 'id="cal-selected-topic-id"' in html

    # Scripts included
    assert 'src="/js/calendar.js?v=' in html
