import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.web_importer import is_safe_url, is_youtube_url

client = TestClient(app)

def test_ssrf_security_filter():
    """Verifies that requests to private networks, loopback addresses, and invalid schemes are blocked."""
    assert is_safe_url("http://localhost:8000") is False
    assert is_safe_url("http://127.0.0.1:8000") is False
    assert is_safe_url("http://192.168.1.1") is False
    assert is_safe_url("http://10.0.0.1") is False
    assert is_safe_url("file:///etc/passwd") is False
    assert is_safe_url("ftp://example.com") is False

def test_youtube_url_detection():
    """Verifies YouTube link classification."""
    assert is_youtube_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ") is True
    assert is_youtube_url("https://youtu.be/dQw4w9WgXcQ") is True
    assert is_youtube_url("https://example.com/article") is False

def test_import_unsafe_url_blocked_by_api():
    """Verifies that the backend API rejects SSRF attempts with an informative 400 error."""
    res = client.post("/api/materials/import-url", json={
        "url": "http://127.0.0.1:8000/api/health"
    })
    assert res.status_code == 400
    assert "Security restriction" in res.json()["detail"]
