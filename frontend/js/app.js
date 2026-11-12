/**
 * StudySpace Main Application Controller
 * Handles SPA routing, history stack (Back & Forward navigation), global search,
 * file uploads & web imports, modals, and customizable Stopwatch/Timer.
 * Clean, professional, emoji-free, with Flashcards removed.
 */
const App = {
  activeView: "dashboard",
  searchDebounce: null,
  historyStack: [],
  historyIndex: -1,
  isNavigatingHistory: false,

  buildHash(viewName, params = {}) {
    let hash = `#${viewName}`;
    const keys = Object.keys(params || {}).filter(k => params[k] !== undefined && params[k] !== null && params[k] !== "");
    if (keys.length > 0) {
      const qs = keys.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");
      hash += `?${qs}`;
    }
    return hash;
  },

  parseHash(hashStr) {
    if (!hashStr || hashStr === "#") return { view: "dashboard", params: {} };
    const raw = hashStr.startsWith("#") ? hashStr.slice(1) : hashStr;
    let [pathPart, paramStr] = raw.split("?");
    let view = pathPart || "dashboard";
    const params = {};
    if (paramStr) {
      new URLSearchParams(paramStr).forEach((v, k) => params[k] = v);
    }
    // Support slash routing like #study-room/15 or #notes/3
    if (pathPart && pathPart.includes("/")) {
      const parts = pathPart.split("/");
      view = parts[0] || "dashboard";
      if (parts[1] && !params.id) {
        params.id = parts[1];
      }
    }
    return { view, params };
  },

  updateHistoryButtons() {
    const backBtn = document.getElementById("nav-btn-back");
    const forwardBtn = document.getElementById("nav-btn-forward");
    if (backBtn) {
      backBtn.disabled = this.historyIndex <= 0;
    }
    if (forwardBtn) {
      forwardBtn.disabled = this.historyIndex >= this.historyStack.length - 1;
    }
  },

  goBack() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const target = this.historyStack[this.historyIndex];
      this.isNavigatingHistory = true;
      this.navigateTo(target.view, target.params, false);
      const hash = this.buildHash(target.view, target.params);
      try {
        window.history.pushState({ view: target.view, params: target.params, idx: this.historyIndex }, "", hash);
      } catch (e) {
        window.location.hash = hash;
      }
      this.isNavigatingHistory = false;
      this.updateHistoryButtons();
    } else if (window.history.length > 1) {
      window.history.back();
    }
  },

  goForward() {
    if (this.historyIndex < this.historyStack.length - 1) {
      this.historyIndex++;
      const target = this.historyStack[this.historyIndex];
      this.isNavigatingHistory = true;
      this.navigateTo(target.view, target.params, false);
      const hash = this.buildHash(target.view, target.params);
      try {
        window.history.pushState({ view: target.view, params: target.params, idx: this.historyIndex }, "", hash);
      } catch (e) {
        window.location.hash = hash;
      }
      this.isNavigatingHistory = false;
      this.updateHistoryButtons();
    } else if (window.history.length > 1) {
      window.history.forward();
    }
  },

  init() {
    this.setupNavigation();
    this.initSidebarState();
    this.setupGlobalSearch();
    this.setupModals();
    this.setupAddMaterialForm();
    if (window.Settings && typeof Settings.applyPreferences === "function") {
      Settings.applyPreferences();
    }
    if (window.TimerWidget) {
      TimerWidget.init();
    }

    // Handle browser native Back and Forward buttons (popstate)
    window.addEventListener("popstate", (e) => {
      const parsed = this.parseHash(window.location.hash);
      if (e.state && typeof e.state.idx === "number" && e.state.idx >= 0 && e.state.idx < this.historyStack.length) {
        this.historyIndex = e.state.idx;
        this.isNavigatingHistory = true;
        this.navigateTo(e.state.view || parsed.view, e.state.params || parsed.params, false);
        this.isNavigatingHistory = false;
      } else {
        const foundIdx = this.historyStack.findIndex(item =>
          item.view === parsed.view && JSON.stringify(item.params || {}) === JSON.stringify(parsed.params || {})
        );
        if (foundIdx !== -1) {
          this.historyIndex = foundIdx;
          this.navigateTo(parsed.view, parsed.params, false);
        } else {
          this.navigateTo(parsed.view, parsed.params, true);
        }
      }
      this.updateHistoryButtons();
    });

    // Keyboard navigation shortcuts: Alt+Left / Alt+Right
    window.addEventListener("keydown", (e) => {
      const isInput = document.activeElement && (
        document.activeElement.tagName === "INPUT" ||
        document.activeElement.tagName === "TEXTAREA" ||
        document.activeElement.isContentEditable
      );
      if (!isInput) {
        if (e.altKey && e.key === "ArrowLeft") {
          e.preventDefault();
          this.goBack();
        } else if (e.altKey && e.key === "ArrowRight") {
          e.preventDefault();
          this.goForward();
        }
      }
    });

    // Initial load from URL hash or default to dashboard
    const initial = this.parseHash(window.location.hash);
    this.navigateTo(initial.view, initial.params, true);

    // Refresh subjects cache
    API.getSubjects().then(tree => State.setSubjects(tree)).catch(console.warn);
  },

  setupNavigation() {
    document.querySelectorAll("[data-nav-view]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const view = btn.getAttribute("data-nav-view");
        this.navigateTo(view);
      });
    });
  },

  navigateTo(viewName, params = {}, addToHistory = true) {
    const validViews = [
      "dashboard", "library", "subjects", "study-room",
      "notes", "quizzes", "progress", "calendar", "settings"
    ];

    if (!validViews.includes(viewName)) {
      viewName = "dashboard";
    }

    this.activeView = viewName;
    State.currentView = viewName;

    // Track in History Stack
    if (addToHistory && !this.isNavigatingHistory) {
      const currentEntry = this.historyStack[this.historyIndex];
      const isSameAsCurrent = currentEntry &&
        currentEntry.view === viewName &&
        JSON.stringify(currentEntry.params || {}) === JSON.stringify(params || {});

      if (!isSameAsCurrent) {
        this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
        this.historyStack.push({ view: viewName, params: { ...params } });
        this.historyIndex = this.historyStack.length - 1;

        const hash = this.buildHash(viewName, params);
        try {
          window.history.pushState({ view: viewName, params, idx: this.historyIndex }, "", hash);
        } catch (e) {
          window.location.hash = hash;
        }
      }
    }

    this.updateHistoryButtons();

    // Update active nav styling with subtle Google signature accents
    const navThemes = {
      dashboard: { active: "bg-[#e8f0fe] text-[#1a73e8] border-[#4285F4]", icon: "text-[#4285F4]" },
      library: { active: "bg-[#e6f4ea] text-[#1e8e3e] border-[#34A853]", icon: "text-[#34A853]" },
      subjects: { active: "bg-[#fef7e0] text-[#b06000] border-[#FBBC05]", icon: "text-[#d97706]" },
      "study-room": { active: "bg-[#e8f0fe] text-[#1a73e8] border-[#4285F4]", icon: "text-[#4285F4]" },
      notes: { active: "bg-[#fef7e0] text-[#b06000] border-[#FBBC05]", icon: "text-[#d97706]" },
      quizzes: { active: "bg-[#e6f4ea] text-[#1e8e3e] border-[#34A853]", icon: "text-[#34A853]" },
      progress: { active: "bg-[#fce8e6] text-[#d93025] border-[#EA4335]", icon: "text-[#EA4335]" },
      calendar: { active: "bg-[#e8f0fe] text-[#1a73e8] border-[#4285F4]", icon: "text-[#4285F4]" },
      settings: { active: "bg-[#f1f3f4] text-[#202124] border-[#5f6368]", icon: "text-[#5f6368]" }
    };

    document.querySelectorAll("[data-nav-view]").forEach(btn => {
      const v = btn.getAttribute("data-nav-view");
      const theme = navThemes[v] || navThemes.dashboard;
      const icon = btn.querySelector("svg");

      if (v === viewName) {
        btn.classList.add("nav-active");
        btn.className = `w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-semibold ${theme.active} border-l-[3px] transition cursor-pointer text-left nav-active`;
        if (icon) icon.className = `w-4 h-4 ${theme.icon} shrink-0`;
      } else {
        btn.classList.remove("nav-active");
        btn.className = "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-[#44546f] hover:bg-[#f1f3f4] hover:text-[#202124] border-l-[3px] border-transparent transition cursor-pointer text-left";
        if (icon) icon.className = `w-4 h-4 ${theme.icon} opacity-80 shrink-0`;
      }
    });

    // Hide all views, display target view
    document.querySelectorAll(".view-section").forEach(sec => sec.classList.add("hidden"));
    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) {
      targetSection.classList.remove("hidden");
    }

    // Close mobile navigation drawer if open
    const mobileDrawer = document.getElementById("mobile-nav-drawer");
    if (mobileDrawer) mobileDrawer.classList.add("hidden");

    // Route-specific loader execution
    if (viewName === "dashboard") Dashboard.load();
    else if (viewName === "library") Library.load();
    else if (viewName === "subjects") Subjects.load(params);
    else if (viewName === "study-room") StudyRoom.load(params.id, params.section ? parseInt(params.section) : 1);
    else if (viewName === "notes") Notes.load(params);
    else if (viewName === "quizzes") Quizzes.load(params);
    else if (viewName === "progress") Progress.load();
    else if (viewName === "calendar") CalendarView.load(params);
    else if (viewName === "settings") Settings.load();

    window.scrollTo({ top: 0, behavior: "instant" });
  },

  toggleMobileNav() {
    const drawer = document.getElementById("mobile-nav-drawer");
    if (drawer) drawer.classList.toggle("hidden");
  },

  // ---------------- Desktop Sidebar Squeeze / Collapse ----------------
  toggleSidebar(forceState) {
    const sidebar = document.getElementById("app-sidebar");
    if (!sidebar) return;

    const isCurrentlyCollapsed = sidebar.classList.contains("sidebar-collapsed");
    const shouldCollapse = (typeof forceState === "boolean") ? forceState : !isCurrentlyCollapsed;

    if (shouldCollapse) {
      sidebar.classList.add("sidebar-collapsed");
      try { localStorage.setItem("studyspace_sidebar_collapsed", "true"); } catch (e) {}
    } else {
      sidebar.classList.remove("sidebar-collapsed");
      try { localStorage.setItem("studyspace_sidebar_collapsed", "false"); } catch (e) {}
    }

    this.updateSidebarToggleIcon(shouldCollapse);
  },

  updateSidebarToggleIcon(isCollapsed) {
    const btn = document.getElementById("sidebar-toggle-btn");
    const chevron = document.getElementById("sidebar-toggle-chevron");
    if (!btn || !chevron) return;

    if (isCollapsed) {
      btn.setAttribute("title", "Expand sidebar");
      btn.setAttribute("aria-label", "Expand sidebar");
      chevron.setAttribute("d", "M12.5 9.5l2.5 2.5-2.5 2.5");
    } else {
      btn.setAttribute("title", "Collapse sidebar");
      btn.setAttribute("aria-label", "Collapse sidebar");
      chevron.setAttribute("d", "M15 9.5L12.5 12l2.5 2.5");
    }
  },

  initSidebarState() {
    let saved = false;
    try {
      saved = localStorage.getItem("studyspace_sidebar_collapsed") === "true";
    } catch (e) {}
    if (saved) {
      this.toggleSidebar(true);
    } else {
      this.updateSidebarToggleIcon(false);
    }
  },

  // ---------------- Global Search ----------------
  setupGlobalSearch() {
    const searchInput = document.getElementById("global-search-input");
    const resultsDropdown = document.getElementById("global-search-results");
    if (!searchInput || !resultsDropdown) return;

    searchInput.addEventListener("input", (e) => {
      const q = e.target.value.trim();
      clearTimeout(this.searchDebounce);
      if (!q) {
        resultsDropdown.classList.add("hidden");
        return;
      }

      this.searchDebounce = setTimeout(async () => {
        try {
          const res = await API.search(q);
          this.renderSearchResults(res.results);
        } catch (err) {
          console.warn("Search query failed:", err);
        }
      }, 300);
    });

    // Close search dropdown on click outside
    document.addEventListener("click", (e) => {
      if (!searchInput.contains(e.target) && !resultsDropdown.contains(e.target)) {
        resultsDropdown.classList.add("hidden");
      }
    });

    // Keyboard shortcut (Ctrl+K or /)
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey && e.key === "k") || (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA" && !document.activeElement.isContentEditable)) {
        e.preventDefault();
        searchInput.focus();
      }
    });
  },

  renderSearchResults(results) {
    const dropdown = document.getElementById("global-search-results");
    if (!dropdown) return;

    if (!results || results.length === 0) {
      dropdown.innerHTML = `
        <div class="p-4 text-center text-xs text-slate-400">
          No matches found across materials, notes, or assessments.
        </div>
      `;
      dropdown.classList.remove("hidden");
      return;
    }

    const typeBadges = {
      material: "DOC",
      section: "PAGE",
      note: "NOTE",
      quiz: "QUIZ"
    };

    dropdown.innerHTML = `
      <div class="p-2.5 border-b border-[#DCDFE4] flex items-center justify-between text-xs text-[#626F86]">
        <span>${results.length} Search Result${results.length === 1 ? '' : 's'}</span>
        <span>Esc to close</span>
      </div>
      <div class="max-h-80 overflow-y-auto divide-y divide-slate-100">
        ${results.map(r => `
          <div onclick="App.handleSearchResultClick('${r.target_url}')"
            class="p-3 hover:bg-[#F1F2F4] cursor-pointer transition text-sm flex items-start gap-2.5">
            <span class="px-1.5 py-0.5 rounded text-xs font-semibold uppercase bg-slate-100 text-[#44546F] shrink-0 border border-slate-200">
              ${typeBadges[r.entity_type] || 'ITEM'}
            </span>
            <div class="min-w-0 flex-1">
              <span class="font-semibold text-[#172B4D] block truncate">${State.escapeHTML(r.title)}</span>
              <p class="text-xs text-[#44546F] line-clamp-1 mt-0.5">${State.escapeHTML(r.excerpt)}</p>
              ${r.subject_name ? `<span class="text-xs text-[#626F86] mt-0.5 block">${State.escapeHTML(r.subject_name)}</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    dropdown.classList.remove("hidden");
  },

  handleSearchResultClick(targetUrl) {
    document.getElementById("global-search-results")?.classList.add("hidden");
    const searchInput = document.getElementById("global-search-input");
    if (searchInput) searchInput.value = "";

    if (targetUrl.startsWith("#study-room/")) {
      const [path, query] = targetUrl.replace("#study-room/", "").split("?");
      const matId = parseInt(path);
      let sec = 1;
      if (query) {
        const p = new URLSearchParams(query);
        if (p.has("section")) sec = parseInt(p.get("section"));
      }
      this.navigateTo("study-room", { id: matId, section: sec });
    } else if (targetUrl.startsWith("#notes?id=")) {
      const noteId = targetUrl.replace("#notes?id=", "");
      this.navigateTo("notes", { id: parseInt(noteId) });
    } else if (targetUrl.startsWith("#quizzes?id=")) {
      const qId = targetUrl.replace("#quizzes?id=", "");
      this.navigateTo("quizzes", { id: parseInt(qId) });
    }
  },

  // ---------------- Add Study Material Modal ----------------
  openAddMaterialModal(defaultParams = {}) {
    const modal = document.getElementById("add-material-modal");
    if (!modal) return;
    modal.classList.remove("hidden");
    this.switchAddMaterialTab("upload");

    const contextBanner = document.getElementById("add-material-context-banner");
    let targetSubjectId = defaultParams.subjectId || null;
    let targetTopicId = defaultParams.topicId || null;

    if (defaultParams.topicId) {
      const topicInfo = State.getTopicDetails(defaultParams.topicId);
      if (topicInfo) {
        targetSubjectId = topicInfo.subjectId;
        targetTopicId = topicInfo.topicId;
        if (contextBanner) {
          contextBanner.innerHTML = `
            <span>Assigning to: <strong>${State.escapeHTML(topicInfo.subjectName)}</strong> › ${State.escapeHTML(topicInfo.chapterName)} › <strong>${State.escapeHTML(topicInfo.topicName)}</strong></span>
            <span class="text-[11px] bg-white px-2 py-0.5 rounded border border-[#B3D4FF] font-semibold text-[#0c66e4]">Topic Level</span>
          `;
          contextBanner.classList.remove("hidden");
        }
      }
    } else if (defaultParams.subjectId) {
      const sub = (State.subjectsTree || []).find(s => s.id === parseInt(defaultParams.subjectId));
      if (sub && contextBanner) {
        contextBanner.innerHTML = `
          <span>Assigning to: <strong>${State.escapeHTML(sub.name)}</strong></span>
          <span class="text-[11px] bg-white px-2 py-0.5 rounded border border-[#B3D4FF] font-semibold text-[#0c66e4]">Subject Level</span>
        `;
        contextBanner.classList.remove("hidden");
      }
    } else {
      if (contextBanner) contextBanner.classList.add("hidden");
    }

    // Set Subject select values
    const uploadSub = document.getElementById("upload-file-subject");
    const importSub = document.getElementById("import-url-subject");
    if (uploadSub) uploadSub.value = targetSubjectId ? String(targetSubjectId) : "";
    if (importSub) importSub.value = targetSubjectId ? String(targetSubjectId) : "";

    // Populate and set Topic select values
    const uploadTopic = document.getElementById("upload-file-topic");
    const importTopic = document.getElementById("import-url-topic");
    State.populateTopicSelect(targetSubjectId, uploadTopic, targetTopicId);
    State.populateTopicSelect(targetSubjectId, importTopic, targetTopicId);
  },

  onSubjectChange(type) {
    if (type === "upload") {
      const subId = document.getElementById("upload-file-subject")?.value;
      const topicSelect = document.getElementById("upload-file-topic");
      State.populateTopicSelect(subId, topicSelect, null);
    } else if (type === "web") {
      const subId = document.getElementById("import-url-subject")?.value;
      const topicSelect = document.getElementById("import-url-topic");
      State.populateTopicSelect(subId, topicSelect, null);
    } else if (type === "move") {
      const subId = document.getElementById("move-material-subject")?.value;
      const topicSelect = document.getElementById("move-material-topic");
      State.populateTopicSelect(subId, topicSelect, null);
    }
  },

  switchAddMaterialTab(tab) {
    const uploadTabBtn = document.getElementById("tab-upload-btn");
    const webTabBtn = document.getElementById("tab-web-btn");
    const uploadPane = document.getElementById("pane-upload-file");
    const webPane = document.getElementById("pane-import-web");

    if (tab === "upload") {
      uploadTabBtn.className = "pb-2 border-b-2 border-indigo-600 font-bold text-indigo-600 text-xs";
      webTabBtn.className = "pb-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800 text-xs";
      uploadPane.classList.remove("hidden");
      webPane.classList.add("hidden");
    } else {
      webTabBtn.className = "pb-2 border-b-2 border-indigo-600 font-bold text-indigo-600 text-xs";
      uploadTabBtn.className = "pb-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800 text-xs";
      webPane.classList.remove("hidden");
      uploadPane.classList.add("hidden");
    }
  },

  setupAddMaterialForm() {
    const uploadForm = document.getElementById("form-upload-file");
    if (uploadForm) {
      uploadForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById("upload-file-input");
        const titleInput = document.getElementById("upload-file-title");
        const subjectSelect = document.getElementById("upload-file-subject");
        const topicSelect = document.getElementById("upload-file-topic");
        const tagsInput = document.getElementById("upload-file-tags");
        const submitBtn = document.getElementById("upload-submit-btn");

        if (!fileInput.files || fileInput.files.length === 0) {
          State.toast("Please select a file to upload.", "warning");
          return;
        }

        const subjectId = subjectSelect ? subjectSelect.value : "";
        const topicId = topicSelect ? topicSelect.value : "";
        const topicInfo = topicId ? State.getTopicDetails(topicId) : null;

        const formData = new FormData();
        formData.append("file", fileInput.files[0]);
        if (titleInput.value.trim()) formData.append("title", titleInput.value.trim());
        if (subjectId) formData.append("subject_id", subjectId);
        if (topicId) formData.append("topic_id", topicId);
        if (topicInfo && topicInfo.chapterId) formData.append("chapter_id", topicInfo.chapterId);
        if (tagsInput.value.trim()) formData.append("tags", tagsInput.value.trim());

        submitBtn.disabled = true;
        submitBtn.textContent = "Extracting & Uploading...";

        try {
          const created = await API.uploadMaterial(formData);
          State.toast(`"${created.title}" successfully added to your library!`, "success");
          document.getElementById("add-material-modal").classList.add("hidden");
          uploadForm.reset();

          // Refresh subjects tree and library view
          const tree = await API.getSubjects();
          State.setSubjects(tree);
          if (typeof Library !== "undefined") Library.applyFilters();
          if (typeof Dashboard !== "undefined") Dashboard.load();

          if (this.activeView === "subjects" && typeof Subjects !== "undefined") {
            if (created.topic_id && Subjects.selectedTopic && Subjects.selectedTopic.id === created.topic_id) {
              await Subjects.selectTopic(Subjects.selectedTopic.id, Subjects.selectedTopic.name, Subjects.selectedTopic.isCompleted, Subjects.selectedTopic.description);
            } else if (created.subject_id && Subjects.selectedSubjectId === created.subject_id) {
              await Subjects.selectSubject(created.subject_id);
            } else {
              Subjects.renderTree();
            }
          } else {
            this.navigateTo("study-room", { id: created.id });
          }
        } catch (err) {
          State.toast(err.message || "Upload failed", "error");
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = "Upload & Extract";
        }
      });
    }

    const webForm = document.getElementById("form-import-web");
    if (webForm) {
      webForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const urlInput = document.getElementById("import-url-input");
        const titleInput = document.getElementById("import-url-title");
        const subjectSelect = document.getElementById("import-url-subject");
        const topicSelect = document.getElementById("import-url-topic");
        const tagsInput = document.getElementById("import-url-tags");
        const submitBtn = document.getElementById("import-url-submit-btn");

        const url = urlInput.value.trim();
        if (!url) {
          State.toast("Please enter a valid URL.", "warning");
          return;
        }

        const subjectId = subjectSelect ? subjectSelect.value : "";
        const topicId = topicSelect ? topicSelect.value : "";
        const topicInfo = topicId ? State.getTopicDetails(topicId) : null;

        submitBtn.disabled = true;
        submitBtn.textContent = "Fetching & Cleaning Content...";

        try {
          const created = await API.importUrlMaterial({
            url: url,
            title: titleInput.value.trim() || undefined,
            subject_id: subjectId ? parseInt(subjectId) : undefined,
            chapter_id: topicInfo ? topicInfo.chapterId : undefined,
            topic_id: topicId ? parseInt(topicId) : undefined,
            tags: tagsInput.value.trim() || undefined
          });

          State.toast(`"${created.title}" imported successfully!`, "success");
          document.getElementById("add-material-modal").classList.add("hidden");
          webForm.reset();

          // Refresh subjects tree and library view
          const tree = await API.getSubjects();
          State.setSubjects(tree);
          if (typeof Library !== "undefined") Library.applyFilters();
          if (typeof Dashboard !== "undefined") Dashboard.load();

          if (this.activeView === "subjects" && typeof Subjects !== "undefined") {
            if (created.topic_id && Subjects.selectedTopic && Subjects.selectedTopic.id === created.topic_id) {
              await Subjects.selectTopic(Subjects.selectedTopic.id, Subjects.selectedTopic.name, Subjects.selectedTopic.isCompleted, Subjects.selectedTopic.description);
            } else if (created.subject_id && Subjects.selectedSubjectId === created.subject_id) {
              await Subjects.selectSubject(created.subject_id);
            } else {
              Subjects.renderTree();
            }
          } else {
            this.navigateTo("study-room", { id: created.id });
          }
        } catch (err) {
          State.toast(err.message || "Web import failed", "error");
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = "Import Content";
        }
      });
    }
  },

  setupModals() {
    document.querySelectorAll("[data-close-modal]").forEach(btn => {
      btn.addEventListener("click", () => {
        const modal = btn.closest(".modal-container");
        if (modal) modal.classList.add("hidden");
      });
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-container:not(.hidden)").forEach(m => m.classList.add("hidden"));
        document.getElementById("quiz-session-overlay")?.classList.add("hidden");
        document.getElementById("timer-settings-modal")?.classList.add("hidden");
        if (typeof Subjects !== "undefined" && Subjects.activeInlineNoteId) {
          Subjects.closeInlineNote();
        }
      }
    });
  },

  openCreateSubjectModal() {
    Subjects.openAddSubjectModal();
  },
  openNewNoteModal(params = {}) {
    if (this.activeView === "subjects") {
      if (params.topicId) {
        Subjects.createNewInlineNote(params.topicId);
        return;
      } else if (params.subjectId) {
        Subjects.createNewInlineNoteForSubject(params.subjectId);
        return;
      }
    }
    Notes.createNewNote(params.subjectId, params.topicId, params.materialId);
    this.navigateTo("notes");
  },
  openNewQuizModal(params = {}) {
    if (params.topicId) {
      Quizzes.openAIGeneratorModal({ topicId: params.topicId });
    } else {
      Quizzes.openAIGeneratorModal(params);
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
