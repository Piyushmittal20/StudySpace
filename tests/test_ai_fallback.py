from fastapi.testclient import TestClient
from backend.main import app
from backend.config import settings

client = TestClient(app)

def test_ai_graceful_degradation_when_unconfigured():
    """
    Verifies that when AI_API_KEY is not configured or empty:
    The API does NOT crash or hallucinate fake content,
    but cleanly returns success: False with helpful configuration guidance.
    """
    # Ensure empty key for test
    original_key = settings.AI_API_KEY
    settings.AI_API_KEY = ""

    try:
        # Check status endpoint
        status_res = client.get("/api/ai/status")
        assert status_res.status_code == 200
        assert status_res.json()["is_configured"] is False

        # Explain endpoint
        explain_res = client.post("/api/ai/explain", json={"text": "Photosynthesis is the process..."})
        assert explain_res.status_code == 200
        assert explain_res.json()["success"] is False
        assert explain_res.json()["is_configured"] is False
        assert "Settings" in explain_res.json()["message"]

        # Ask question endpoint
        ask_res = client.post("/api/ai/ask", json={"question": "What is ATP?", "material_id": 9999})
        assert ask_res.status_code == 200
        assert ask_res.json()["success"] is False
        assert ask_res.json()["is_configured"] is False
    finally:
        settings.AI_API_KEY = original_key
