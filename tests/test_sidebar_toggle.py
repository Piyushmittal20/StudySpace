import re

def test_sidebar_toggle_elements_and_structure():
    with open("frontend/index.html", "r", encoding="utf-8") as f:
        html = f.read()

    # Verify "Menu" text was removed
    assert '<span class="text-xs font-semibold uppercase tracking-wider text-[#626f86]">Menu</span>' not in html

    # Verify toggle button exists
    assert 'id="sidebar-toggle-btn"' in html
    assert 'onclick="App.toggleSidebar()"' in html
    assert 'id="sidebar-toggle-icon"' in html
    assert 'id="sidebar-toggle-chevron"' in html

    # Verify all nav buttons have title attributes and nav-label class
    views = ["dashboard", "library", "subjects", "study-room", "notes", "quizzes", "progress", "settings"]
    for view in views:
        pattern = rf'data-nav-view="{view}"[^>]*title='
        assert re.search(pattern, html), f"Nav button for {view} should have a title attribute for collapsed tooltips"

    assert 'class="nav-label"' in html


def test_sidebar_css_rules():
    with open("frontend/css/style.css", "r", encoding="utf-8") as f:
        css = f.read()

    assert "#app-sidebar.sidebar-collapsed" in css
    assert ".nav-label" in css
    assert "width: 4.25rem !important;" in css or "width: 4rem !important;" in css


def test_sidebar_js_logic():
    with open("frontend/js/app.js", "r", encoding="utf-8") as f:
        js = f.read()

    assert "toggleSidebar(" in js
    assert "updateSidebarToggleIcon(" in js
    assert "initSidebarState(" in js
    assert "studyspace_sidebar_collapsed" in js
