"""
Web importer service for StudySpace.
Safely extracts articles, documentation, and video references from public URLs with SSRF protection.
"""
import ipaddress
import socket
from urllib.parse import urlparse
import httpx
from bs4 import BeautifulSoup
from typing import Dict, Any, List
import logging
import re
from backend.config import settings

logger = logging.getLogger("studyspace.web_importer")

# SSRF Protection: blocked private/local networks
def is_safe_url(target_url: str) -> bool:
    """Validates that a URL does not point to localhost or private/internal networks."""
    try:
        parsed = urlparse(target_url)
        if parsed.scheme not in ("http", "https"):
            return False
        
        hostname = parsed.hostname
        if not hostname:
            return False

        # Block localhost strings explicitly
        if hostname.lower() in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
            return False

        # Resolve IP addresses to prevent DNS rebinding or private IP access
        addr_info = socket.getaddrinfo(hostname, None)
        for item in addr_info:
            ip_str = item[4][0]
            ip_obj = ipaddress.ip_address(ip_str)
            if (
                ip_obj.is_private
                or ip_obj.is_loopback
                or ip_obj.is_link_local
                or ip_obj.is_reserved
                or ip_obj.is_multicast
            ):
                return False
        return True
    except Exception as e:
        logger.warning(f"URL security check failed for {target_url}: {e}")
        return False

def is_youtube_url(url: str) -> bool:
    """Checks if a URL is a YouTube video link."""
    domain = urlparse(url).netloc.lower()
    return "youtube.com" in domain or "youtu.be" in domain

def extract_from_url(url: str) -> Dict[str, Any]:
    """
    Imports content from a public webpage or video link safely.
    Returns: {
        'title': str,
        'source_type': 'web' or 'video',
        'sections': List[Dict[str, Any]],
        'source_url': str,
        'summary': str
    }
    """
    clean_url = url.strip()
    if not clean_url.startswith(("http://", "https://")):
        clean_url = "https://" + clean_url

    if not is_safe_url(clean_url):
        raise ValueError(
            "Security restriction: Cannot import from local network, internal addresses, or invalid URLs."
        )

    if is_youtube_url(clean_url):
        return _import_youtube_resource(clean_url)

    return _import_web_article(clean_url)

def _import_youtube_resource(url: str) -> Dict[str, Any]:
    """Handles YouTube video importing via oEmbed API."""
    title = "YouTube Video Resource"
    description = ""
    
    # Try fetching title via official oEmbed API
    try:
        oembed_url = f"https://www.youtube.com/oembed?url={url}&format=json"
        with httpx.Client(timeout=8.0, follow_redirects=True) as client:
            resp = client.get(oembed_url)
            if resp.status_code == 200:
                data = resp.json()
                title = data.get("title", title)
                author = data.get("author_name", "")
                if author:
                    description = f"Channel: {author}\n"
    except Exception as e:
        logger.info(f"Could not fetch oEmbed metadata for {url}: {e}")

    content = (
        f"Saved YouTube Video: {title}\n"
        f"URL: {url}\n\n"
        f"{description}"
        "Note: Direct YouTube transcripts are not currently attached. "
        "You can open the video source at any time and take notes or create flashcards in StudySpace while watching."
    )

    return {
        "title": title,
        "source_type": "video",
        "source_url": url,
        "summary": f"Online video resource: {title}",
        "sections": [
            {
                "section_index": 1,
                "title": title,
                "content": content,
                "page_or_slide": "Video Resource"
            }
        ]
    }

def _import_web_article(url: str) -> Dict[str, Any]:
    """Fetches and cleans a public web article or documentation page."""
    headers = {
        "User-Agent": "StudySpaceLearningPlatform/1.0 (student@studyspace.org)"
    }
    
    try:
        with httpx.Client(timeout=settings.URL_REQUEST_TIMEOUT_SECONDS, follow_redirects=True, headers=headers) as client:
            resp = client.get(url)
            if resp.status_code >= 400:
                raise ValueError(f"Server returned HTTP status {resp.status_code}: {resp.reason_phrase}")
            
            # Check content length
            content_length = len(resp.content)
            if content_length > settings.MAX_URL_RESPONSE_SIZE:
                raise ValueError(f"Webpage content exceeds maximum allowed limit ({settings.MAX_URL_RESPONSE_SIZE // (1024*1024)} MB).")
            
            html_text = resp.text
    except httpx.TimeoutException:
        raise ValueError("Request timed out while connecting to the webpage.")
    except httpx.RequestError as e:
        raise ValueError(f"Network error while connecting to URL: {str(e)}")

    soup = BeautifulSoup(html_text, "html.parser")

    # Extract Page Title
    title = "Web Article"
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    elif soup.find("h1"):
        title = soup.find("h1").get_text().strip()

    # Clean clutter: remove scripts, styles, forms, headers, footers, nav, iframes, ads
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "iframe", "noscript", "svg"]):
        tag.decompose()

    # Look for main content container if available
    main_container = soup.find("article") or soup.find("main") or soup.find(id=re.compile(r"content|main|article|body", re.I)) or soup.body
    if not main_container:
        main_container = soup

    # Chunk content into logical sections by headings (h1, h2, h3)
    sections = []
    current_title = title
    current_paragraphs = []
    section_idx = 1

    for elem in main_container.find_all(["h1", "h2", "h3", "p", "ul", "ol", "blockquote", "pre"]):
        tag_name = elem.name
        text = elem.get_text().strip()
        if not text:
            continue

        if tag_name in ("h1", "h2", "h3"):
            if current_paragraphs:
                sections.append({
                    "section_index": section_idx,
                    "title": current_title[:100],
                    "content": "\n\n".join(current_paragraphs),
                    "page_or_slide": f"Section {section_idx}"
                })
                section_idx += 1
                current_paragraphs = []
            current_title = text
        else:
            current_paragraphs.append(text)

    if current_paragraphs:
        sections.append({
            "section_index": section_idx,
            "title": current_title[:100],
            "content": "\n\n".join(current_paragraphs),
            "page_or_slide": f"Section {section_idx}"
        })

    if not sections:
        # Fallback raw text
        raw_text = main_container.get_text(separator="\n", strip=True)
        if not raw_text:
            raise ValueError("No readable educational text could be extracted from this webpage.")
        sections.append({
            "section_index": 1,
            "title": title[:100],
            "content": raw_text[:5000],
            "page_or_slide": "Section 1"
        })

    return {
        "title": title[:200],
        "source_type": "web",
        "source_url": url,
        "summary": f"Imported from {url}",
        "sections": sections
    }
