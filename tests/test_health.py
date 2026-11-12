from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health_check():
    """Verifies application health and database connection."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app_name"] == "StudySpace"
    assert data["database_connected"] is True
    assert "data_dir_size_mb" in data
