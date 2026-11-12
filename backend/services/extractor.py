"""
Document text extraction service.
Extracts clean text and structured sections from PDF, DOCX, PPTX, TXT, MD, and XLSX files.
"""
from pathlib import Path
from typing import List, Dict, Any
import logging

logger = logging.getLogger("studyspace.extractor")

def extract_content(file_path: Path, source_type: str) -> List[Dict[str, Any]]:
    """
    Extracts structured sections from a document file.
    Returns a list of dicts: [{'title': str, 'content': str, 'page_or_slide': str, 'section_index': int}]
    """
    ext = file_path.suffix.lower()
    source_type = source_type.lower()

    if ext == ".pdf" or source_type == "pdf":
        return _extract_pdf(file_path)
    elif ext in (".docx", ".doc") or source_type == "docx":
        return _extract_docx(file_path)
    elif ext in (".pptx", ".ppt") or source_type == "pptx":
        return _extract_pptx(file_path)
    elif ext == ".xlsx" or source_type == "xlsx":
        return _extract_xlsx(file_path)
    elif ext in (".md", ".markdown") or source_type == "md":
        return _extract_markdown(file_path)
    elif ext == ".txt" or source_type == "txt":
        return _extract_txt(file_path)
    else:
        # Generic fallback
        return _extract_txt(file_path)

def _extract_pdf(file_path: Path) -> List[Dict[str, Any]]:
    import pypdf
    sections = []
    try:
        reader = pypdf.PdfReader(str(file_path))
        num_pages = len(reader.pages)
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            clean_text = text.strip()
            if not clean_text:
                continue
            # Pick first non-empty line as potential title
            first_line = clean_text.splitlines()[0][:80].strip()
            sections.append({
                "section_index": len(sections) + 1,
                "title": first_line if first_line else f"Page {i + 1}",
                "content": clean_text,
                "page_or_slide": f"Page {i + 1} of {num_pages}"
            })
    except Exception as e:
        logger.error(f"Error reading PDF {file_path}: {e}")
        raise ValueError(f"Could not read PDF file: {str(e)}")

    if not sections:
        sections.append({
            "section_index": 1,
            "title": "Document Content",
            "content": "No extractable text found in this PDF (it might contain scanned images).",
            "page_or_slide": "Page 1"
        })
    return sections

def _extract_docx(file_path: Path) -> List[Dict[str, Any]]:
    import docx
    sections = []
    try:
        doc = docx.Document(str(file_path))
        current_title = "Introduction"
        current_paragraphs = []
        section_idx = 1

        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                continue
            if para.style and para.style.name and para.style.name.startswith("Heading"):
                if current_paragraphs:
                    sections.append({
                        "section_index": section_idx,
                        "title": current_title,
                        "content": "\n\n".join(current_paragraphs),
                        "page_or_slide": f"Section {section_idx}"
                    })
                    section_idx += 1
                    current_paragraphs = []
                current_title = text[:100]
            else:
                current_paragraphs.append(text)

        if current_paragraphs:
            sections.append({
                "section_index": section_idx,
                "title": current_title,
                "content": "\n\n".join(current_paragraphs),
                "page_or_slide": f"Section {section_idx}"
            })
    except Exception as e:
        logger.error(f"Error reading DOCX {file_path}: {e}")
        raise ValueError(f"Could not read Word document: {str(e)}")

    if not sections:
        sections.append({
            "section_index": 1,
            "title": "Document Content",
            "content": "No readable text paragraphs found in Word document.",
            "page_or_slide": "Section 1"
        })
    return sections

def _extract_pptx(file_path: Path) -> List[Dict[str, Any]]:
    from pptx import Presentation
    sections = []
    try:
        prs = Presentation(str(file_path))
        total_slides = len(prs.slides)
        for i, slide in enumerate(prs.slides):
            slide_title = ""
            slide_texts = []
            for shape in slide.shapes:
                if shape.has_text_frame:
                    for paragraph in shape.text_frame.paragraphs:
                        txt = paragraph.text.strip()
                        if txt:
                            if not slide_title and shape == slide.shapes[0]:
                                slide_title = txt
                            else:
                                slide_texts.append(txt)
            if not slide_title:
                slide_title = f"Slide {i + 1}"

            full_content = "\n".join(slide_texts) if slide_texts else slide_title
            sections.append({
                "section_index": len(sections) + 1,
                "title": slide_title[:100],
                "content": full_content,
                "page_or_slide": f"Slide {i + 1} of {total_slides}"
            })
    except Exception as e:
        logger.error(f"Error reading PPTX {file_path}: {e}")
        raise ValueError(f"Could not read PowerPoint presentation: {str(e)}")

    if not sections:
        sections.append({
            "section_index": 1,
            "title": "Presentation Content",
            "content": "No text content found in slides.",
            "page_or_slide": "Slide 1"
        })
    return sections

def _extract_markdown(file_path: Path) -> List[Dict[str, Any]]:
    try:
        raw_text = _read_file_text(file_path)
    except Exception as e:
        raise ValueError(f"Could not read Markdown file: {str(e)}")

    lines = raw_text.splitlines()
    sections = []
    current_title = "Overview"
    current_lines = []
    section_idx = 1

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#"):
            if current_lines:
                sections.append({
                    "section_index": section_idx,
                    "title": current_title,
                    "content": "\n".join(current_lines).strip(),
                    "page_or_slide": f"Section {section_idx}"
                })
                section_idx += 1
                current_lines = []
            current_title = stripped.lstrip("#").strip()[:100]
        else:
            current_lines.append(line)

    if current_lines or not sections:
        sections.append({
            "section_index": section_idx,
            "title": current_title,
            "content": "\n".join(current_lines).strip(),
            "page_or_slide": f"Section {section_idx}"
        })
    return sections

def _extract_txt(file_path: Path) -> List[Dict[str, Any]]:
    try:
        raw_text = _read_file_text(file_path)
    except Exception as e:
        raise ValueError(f"Could not read text file: {str(e)}")

    # Chunk by roughly 2000 characters or double newlines to keep study room readable
    paragraphs = raw_text.split("\n\n")
    sections = []
    current_chunk = []
    current_len = 0
    section_idx = 1

    for para in paragraphs:
        p_clean = para.strip()
        if not p_clean:
            continue
        current_chunk.append(p_clean)
        current_len += len(p_clean)

        if current_len >= 1800:
            content = "\n\n".join(current_chunk)
            first_line = content.splitlines()[0][:80].strip()
            sections.append({
                "section_index": section_idx,
                "title": first_line if first_line else f"Section {section_idx}",
                "content": content,
                "page_or_slide": f"Section {section_idx}"
            })
            section_idx += 1
            current_chunk = []
            current_len = 0

    if current_chunk or not sections:
        content = "\n\n".join(current_chunk) if current_chunk else raw_text.strip()
        sections.append({
            "section_index": section_idx,
            "title": f"Section {section_idx}",
            "content": content,
            "page_or_slide": f"Section {section_idx}"
        })
    return sections

def _extract_xlsx(file_path: Path) -> List[Dict[str, Any]]:
    import openpyxl
    sections = []
    try:
        wb = openpyxl.load_workbook(str(file_path), data_only=True)
        for i, sheet_name in enumerate(wb.sheetnames):
            ws = wb[sheet_name]
            rows_text = []
            for row in ws.iter_rows(values_only=True):
                # Filter out completely empty rows
                row_vals = [str(v) if v is not None else "" for v in row]
                if any(row_vals):
                    rows_text.append(" | ".join(row_vals))
            sheet_content = "\n".join(rows_text[:500])  # limit to first 500 rows
            sections.append({
                "section_index": i + 1,
                "title": f"Sheet: {sheet_name}",
                "content": sheet_content if sheet_content else "Empty sheet",
                "page_or_slide": f"Sheet {i + 1} of {len(wb.sheetnames)}"
            })
    except Exception as e:
        logger.error(f"Error reading XLSX {file_path}: {e}")
        raise ValueError(f"Could not read Excel file: {str(e)}")

    if not sections:
        sections.append({
            "section_index": 1,
            "title": "Spreadsheet",
            "content": "No readable worksheets found.",
            "page_or_slide": "Sheet 1"
        })
    return sections

def _read_file_text(file_path: Path) -> str:
    """Reads text file with automatic encoding detection fallback."""
    encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]
    for enc in encodings:
        try:
            with open(file_path, "r", encoding=enc) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    # Fallback ignoring errors
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()
