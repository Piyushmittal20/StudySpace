import io
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_material_upload_extraction_and_bookmarks():
    """Tests uploading text and markdown files, section extraction, bookmarking, and deletion."""
    # 1. Upload Markdown File
    md_content = b"""# Introduction to Operating Systems
An operating system acts as an intermediary between the user of a computer and the computer hardware.

# Process Management
A process is a program in execution. It includes the program counter, stack, and data section.

# Memory Management
Main memory is a large array of words or bytes, each with its own address.
"""
    files = {"file": ("os_notes.md", io.BytesIO(md_content), "text/markdown")}
    data = {"title": "Operating Systems Core Concepts", "tags": "CS, Systems"}

    upload_res = client.post("/api/materials/upload", data=data, files=files)
    assert upload_res.status_code == 200
    mat = upload_res.json()
    mat_id = mat["id"]
    assert mat["title"] == "Operating Systems Core Concepts"
    assert mat["source_type"] == "md"

    # 2. Get Material Details and verify extracted sections
    detail_res = client.get(f"/api/materials/{mat_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert len(detail["sections"]) >= 3
    sec1 = detail["sections"][0]
    assert "Operating Systems" in sec1["title"] or "Operating Systems" in sec1["content"]

    # 3. Add Bookmark to a section
    bm_res = client.post(f"/api/materials/{mat_id}/bookmarks", json={
        "material_id": mat_id,
        "section_id": sec1["id"],
        "title": "Important Exam Concept",
        "note": "Review before finals"
    })
    assert bm_res.status_code == 200
    bm_data = bm_res.json()
    bm_id = bm_data["id"]

    # 4. Verify bookmark appears in material details
    detail_after_bm = client.get(f"/api/materials/{mat_id}").json()
    assert any(b["id"] == bm_id for b in detail_after_bm["bookmarks"])

    # 5. Delete bookmark
    del_bm_res = client.delete(f"/api/materials/bookmarks/{bm_id}")
    assert del_bm_res.status_code == 200

    # 6. Delete Material
    del_mat_res = client.delete(f"/api/materials/{mat_id}")
    assert del_mat_res.status_code == 200

    # Verify 404 after deletion
    assert client.get(f"/api/materials/{mat_id}").status_code == 404
