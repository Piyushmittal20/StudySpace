import io
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_global_search_across_entities():
    """Tests searching for words inside uploaded document content, notes, and flashcards."""
    # 1. Upload a document containing unique keyword 'Photolithography'
    content = b"""# Semiconductor Manufacturing
Photolithography is the process used in microfabrication to pattern parts on a thin film or the bulk of a substrate.
"""
    client.post("/api/materials/upload", data={"title": "Semiconductor Basics"}, files={"file": ("chips.txt", io.BytesIO(content), "text/plain")})

    # 2. Create note with keyword 'Photolithography'
    client.post("/api/notes", json={"title": "Chip Fab Notes", "content": "Modern Photolithography uses extreme ultraviolet light."})

    # 3. Search query
    search_res = client.get("/api/search?q=Photolithography")
    assert search_res.status_code == 200
    data = search_res.json()
    assert data["total_results"] >= 2
    types = [item["entity_type"] for item in data["results"]]
    assert "material" in types or "section" in types
    assert "note" in types
