/**
 * Study Room Controller
 * The core reading and learning experience:
 * Section navigation, bookmarks, notes drawer, AI tutoring panel.
 * Completely emoji-free, with Flashcards removed.
 */
const StudyRoom = {
  material: null,
  allMaterials: [],
  currentSectionIndex: 1,
  activeNoteId: null,

  async load(materialId, targetSectionIndex = 1) {
    if (!materialId) {
      await this.renderMaterialSelector();
      return;
    }

    try {
      const id = parseInt(materialId, 10);
      this.material = await API.getMaterial(id);
      State.activeMaterial = this.material;
      this.currentSectionIndex = parseInt(targetSectionIndex, 10) || 1;
      localStorage.setItem("studyspace_last_material_id", String(id));

      try {
        this.allMaterials = await API.getMaterials();
      } catch (e) {
        this.allMaterials = [];
      }

      this.render();
    } catch (err) {
      console.error("Failed to load material in Study Room:", err);
      State.toast(err.message || "Could not open material", "error");
      await this.renderMaterialSelector();
    }
  },

  async renderMaterialSelector() {
    const container = document.getElementById("study-room-container");
    if (!container) return;

    container.innerHTML = `
      <div class="py-16 text-center text-xs text-[#626F86]">
        Loading study materials...
      </div>
    `;

    try {
      this.allMaterials = await API.getMaterials();
    } catch (e) {
      this.allMaterials = [];
    }

    const lastId = localStorage.getItem("studyspace_last_material_id");
    const lastMaterial = lastId ? this.allMaterials.find(m => String(m.id) === String(lastId)) : null;
    const subjects = (State.subjectsTree && State.subjectsTree.length > 0) ? State.subjectsTree : [];

    container.innerHTML = `
      <div class="space-y-6 max-w-6xl mx-auto">
        <!-- Hub Header -->
        <div class="bg-white rounded-xl border border-[#DCDFE4] p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="w-8 h-8 rounded-lg bg-[#E9F2FF] text-[#0C66E4] flex items-center justify-center font-bold text-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
              </span>
              <h2 class="text-xl font-semibold text-[#172B4D]">Study Room Hub</h2>
            </div>
            <p class="text-xs text-[#626F86] mt-1">Select any study material to start reading, navigate sections, bookmark notes, or practice with AI.</p>
          </div>

          <button onclick="App.openAddMaterialModal()" class="px-3.5 py-2 bg-[#0C66E4] text-white rounded-lg text-xs font-semibold hover:bg-[#0055CC] transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            <span>+ Import New Material</span>
          </button>
        </div>

        ${lastMaterial ? `
          <!-- Continue Studying Recent Session Banner -->
          <div onclick="App.navigateTo('study-room', { id: ${lastMaterial.id} })"
            class="bg-gradient-to-r from-[#0C66E4] to-[#0055CC] text-white p-5 rounded-xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:shadow-md transition">
            <div class="min-w-0">
              <span class="inline-block px-2 py-0.5 bg-white/20 text-white rounded text-[11px] font-bold uppercase tracking-wider mb-1.5">
                Resume Last Session
              </span>
              <h3 class="text-lg font-bold truncate">${State.escapeHTML(lastMaterial.title)}</h3>
              <p class="text-blue-100 text-xs mt-0.5 truncate">
                ${lastMaterial.subject_name ? State.escapeHTML(lastMaterial.subject_name) : 'General'}
                ${lastMaterial.topic_name ? ` › ${State.escapeHTML(lastMaterial.topic_name)}` : ''}
                • ${lastMaterial.sections_count} sections
              </p>
            </div>
            <button onclick="event.stopPropagation(); App.navigateTo('study-room', { id: ${lastMaterial.id} })"
              class="px-4 py-2 bg-white text-[#0C66E4] hover:bg-[#F1F2F4] rounded-lg text-xs font-bold transition shadow-xs whitespace-nowrap cursor-pointer shrink-0">
              Resume Studying →
            </button>
          </div>
        ` : ''}

        <!-- Filter & Search Bar -->
        <div class="bg-white rounded-xl border border-[#DCDFE4] p-3.5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div class="relative flex-1">
            <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#626F86]">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </span>
            <input id="study-hub-search-input" type="text"
              placeholder="Search materials by title, subject, or topic..."
              oninput="StudyRoom.filterHubMaterials()"
              class="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F7F8F9] border border-[#DCDFE4] rounded-lg text-[#172B4D] placeholder-[#626F86] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0C66E4]/20 focus:border-[#0C66E4]">
          </div>

          <div class="flex items-center gap-2">
            <select id="study-hub-subject-filter" onchange="StudyRoom.filterHubMaterials()"
              class="text-xs p-1.5 rounded-lg border border-[#DCDFE4] focus:outline-[#0C66E4] text-[#172B4D] bg-white cursor-pointer">
              <option value="">All Subjects (${this.allMaterials.length})</option>
              ${subjects.map(s => `<option value="${s.id}">${State.escapeHTML(s.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Materials Grid Container -->
        <div id="study-hub-materials-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <!-- Rendered by renderHubCards -->
        </div>
      </div>
    `;

    this.renderHubCards(this.allMaterials);
  },

  renderHubCards(materials) {
    const grid = document.getElementById("study-hub-materials-grid");
    if (!grid) return;

    if (!materials || materials.length === 0) {
      grid.className = "w-full";
      grid.innerHTML = `
        <div class="py-16 text-center bg-white rounded-xl border border-[#DCDFE4] p-8 max-w-lg mx-auto">
          <h3 class="text-base font-semibold text-[#172B4D]">No Materials Found</h3>
          <p class="text-xs text-[#626F86] mt-1">
            No materials matched your filter criteria or no documents have been imported yet.
          </p>
          <button onclick="App.openAddMaterialModal()" class="mt-4 px-4 py-2 bg-[#0C66E4] text-white rounded-lg text-xs font-semibold hover:bg-[#0055CC] transition cursor-pointer">
            + Add First Material
          </button>
        </div>
      `;
      return;
    }

    grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";
    const colors = {
      pdf: "bg-red-50 text-red-700 border-red-200",
      pptx: "bg-orange-50 text-orange-700 border-orange-200",
      docx: "bg-blue-50 text-blue-700 border-blue-200",
      txt: "bg-slate-50 text-slate-700 border-slate-200",
      web: "bg-emerald-50 text-emerald-700 border-emerald-200"
    };

    grid.innerHTML = materials.map(m => {
      const t = (m.source_type || "doc").toLowerCase();
      const badgeClass = colors[t] || "bg-slate-50 text-slate-700 border-slate-200";

      return `
        <div onclick="App.navigateTo('study-room', { id: ${m.id} })"
          class="bg-white rounded-xl border border-[#DCDFE4] hover:border-[#0C66E4] hover:shadow-xs p-5 flex flex-col justify-between transition cursor-pointer group">
          <div>
            <div class="flex items-center justify-between mb-2.5">
              <span class="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border ${badgeClass}">
                ${m.source_type}
              </span>
              <span class="text-xs text-[#626F86]">
                ${m.sections_count || 1} section${m.sections_count === 1 ? '' : 's'}
              </span>
            </div>

            <h4 class="font-semibold text-[#172B4D] text-base group-hover:text-[#0C66E4] transition line-clamp-2 leading-snug"
              title="${State.escapeHTML(m.title)}">
              ${State.escapeHTML(m.title)}
            </h4>

            <div class="mt-2.5 text-xs text-[#44546F] space-y-1">
              <div class="flex items-center gap-1.5 truncate">
                <span class="text-[#626F86]">Subject:</span>
                <span class="font-medium text-[#172B4D] truncate">${m.subject_name ? State.escapeHTML(m.subject_name) : 'Unassigned'}</span>
              </div>
              ${m.topic_name ? `
                <div class="flex items-center gap-1.5 truncate">
                  <span class="text-[#626F86]">Topic:</span>
                  <span class="font-medium text-[#0C66E4] truncate">${State.escapeHTML(m.topic_name)}</span>
                </div>
              ` : ''}
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-[#F1F2F4] flex items-center justify-between">
            <span class="text-xs text-[#626F86]">${m.file_size ? State.formatFileSize(m.file_size) : 'Web Article'}</span>
            <span class="text-xs font-semibold text-[#0C66E4] group-hover:translate-x-0.5 transition flex items-center gap-1">
              <span>Study Now</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </span>
          </div>
        </div>
      `;
    }).join("");
  },

  filterHubMaterials() {
    const search = (document.getElementById("study-hub-search-input")?.value || "").toLowerCase().trim();
    const subjectId = document.getElementById("study-hub-subject-filter")?.value || "";

    let filtered = this.allMaterials || [];
    if (subjectId) {
      filtered = filtered.filter(m => String(m.subject_id) === String(subjectId));
    }
    if (search) {
      filtered = filtered.filter(m => {
        const titleMatch = (m.title || "").toLowerCase().includes(search);
        const subMatch = (m.subject_name || "").toLowerCase().includes(search);
        const topMatch = (m.topic_name || "").toLowerCase().includes(search);
        const tagMatch = (m.tags || "").toLowerCase().includes(search);
        return titleMatch || subMatch || topMatch || tagMatch;
      });
    }

    this.renderHubCards(filtered);
  },

  renderEmptyState() {
    this.renderMaterialSelector();
  },

  render() {
    const container = document.getElementById("study-room-container");
    if (!container || !this.material) return;

    const sections = this.material.sections || [];
    const currentSection = sections.find(s => parseInt(s.section_index, 10) === this.currentSectionIndex) || sections[0] || {
      title: "Content",
      content: "No section text available.",
      page_or_slide: "Section 1"
    };

    const otherMaterials = (this.allMaterials || []).filter(om => om.id !== this.material.id);

    container.innerHTML = `
      <!-- Study Room Header -->
      <div class="bg-white rounded-xl border border-[#DCDFE4] p-4 shadow-xs mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <button onclick="App.goBack()" title="Go back to previous screen"
            class="px-2.5 py-1.5 rounded-lg border border-[#DCDFE4] hover:bg-[#F1F2F4] text-xs font-semibold text-[#172b4d] flex items-center gap-1.5 transition cursor-pointer shrink-0">
            <svg class="w-3.5 h-3.5 text-[#626f86]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            <span>Back</span>
          </button>

          <button onclick="StudyRoom.renderMaterialSelector()" title="Switch to another study material"
            class="px-2.5 py-1.5 rounded-lg border border-[#DCDFE4] hover:bg-[#F1F2F4] text-xs font-semibold text-[#0c66e4] flex items-center gap-1.5 transition cursor-pointer shrink-0">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
            <span>Change Material</span>
          </button>

          ${otherMaterials.length > 0 ? `
            <select onchange="App.navigateTo('study-room', { id: this.value })"
              class="hidden sm:inline-block text-xs py-1.5 px-2.5 rounded-lg border border-[#DCDFE4] bg-white text-[#172b4d] font-medium max-w-[200px] truncate cursor-pointer hover:border-[#0c66e4]"
              title="Quick Switch Material">
              <option value="${this.material.id}" selected disabled>${State.escapeHTML(this.material.title)} (Current)</option>
              ${otherMaterials.map(om => `
                <option value="${om.id}">${State.escapeHTML(om.title)}</option>
              `).join('')}
            </select>
          ` : ''}

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="px-2 py-0.5 rounded text-xs font-bold uppercase bg-[#F1F2F4] text-[#172b4d] border border-[#DCDFE4]">
                ${this.material.source_type}
              </span>
              <span class="text-xs text-[#626f86] truncate">
                ${this.material.subject_name ? State.escapeHTML(this.material.subject_name) : 'General'}
                ${this.material.topic_name ? ` › ${State.escapeHTML(this.material.topic_name)}` : ''}
              </span>
            </div>
            <h2 class="text-xl font-semibold text-[#172b4d] truncate" title="${State.escapeHTML(this.material.title)}">
              ${State.escapeHTML(this.material.title)}
            </h2>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button onclick="StudyRoom.addBookmarkOnCurrentSection()"
            title="Bookmark this section"
            class="px-3 py-1.5 rounded-lg border border-[#DCDFE4] hover:bg-[#F1F2F4] text-xs font-medium text-[#172b4d] flex items-center gap-1.5 transition cursor-pointer">
            <svg class="w-3.5 h-3.5 text-[#626f86]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
            <span>Bookmark</span>
          </button>

          ${this.material.file_path ? `
            <a href="/api/materials/${this.material.id}/download" download
               class="px-3 py-1.5 rounded-lg border border-[#DCDFE4] hover:bg-[#F1F2F4] text-xs font-medium text-[#172b4d] flex items-center gap-1.5 transition">
              <svg class="w-3.5 h-3.5 text-[#626f86]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              <span>Original File</span>
            </a>
          ` : (this.material.source_url ? `
            <a href="${this.material.source_url}" target="_blank" rel="noopener noreferrer"
               class="px-3 py-1.5 rounded-lg border border-[#DCDFE4] hover:bg-[#F1F2F4] text-xs font-medium text-[#172b4d] flex items-center gap-1.5 transition">
              <svg class="w-3.5 h-3.5 text-[#626f86]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              <span>Source URL</span>
            </a>
          ` : '')}

          <button onclick="StudyRoom.toggleNotesDrawer()"
            class="px-3 py-1.5 bg-[#E9F2FF] hover:bg-blue-100 text-[#0c66e4] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            <span>Notes</span>
          </button>
        </div>
      </div>

      <!-- Main Reading Grid (TOC Sidebar + Reader Content + AI Sidepanel) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <!-- Table of Contents Sidebar (3 cols) -->
        <div class="lg:col-span-3 bg-white rounded-xl border border-[#DCDFE4] p-4 shadow-xs sticky top-20 max-h-[calc(100vh-7rem)] overflow-y-auto">
          <div class="flex items-center justify-between pb-2 mb-3 border-b border-[#F1F2F4]">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-[#626f86]">
              Sections (${sections.length})
            </h3>
            <button onclick="StudyRoom.renderMaterialSelector()" class="text-xs text-[#0c66e4] hover:underline font-medium cursor-pointer">
              Switch
            </button>
          </div>

          <div class="space-y-1">
            ${sections.map(s => {
              const sIdx = parseInt(s.section_index, 10);
              const isActive = sIdx === this.currentSectionIndex;
              return `
                <div onclick="StudyRoom.goToSection(${sIdx})"
                  class="p-2.5 rounded-lg text-xs cursor-pointer transition flex items-center justify-between ${isActive ? 'bg-[#E9F2FF] font-semibold text-[#0c66e4] border-l-[3px] border-[#0c66e4]' : 'text-[#172b4d] hover:bg-[#F1F2F4] font-medium'}">
                  <span class="truncate pr-1">${State.escapeHTML(s.title || s.page_or_slide)}</span>
                  <span class="text-xs text-[#626f86] shrink-0">${s.page_or_slide || ''}</span>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Bookmarks on this material -->
          ${(this.material.bookmarks && this.material.bookmarks.length > 0) ? `
            <div class="mt-6 pt-4 border-t border-[#DCDFE4]">
              <h4 class="text-xs font-semibold uppercase tracking-wider text-[#626f86] mb-2">Saved Bookmarks</h4>
              <div class="space-y-1">
                ${this.material.bookmarks.map(bm => `
                  <div class="flex items-center justify-between p-1.5 text-xs text-[#172b4d] hover:bg-[#F1F2F4] rounded">
                    <span class="truncate">${State.escapeHTML(bm.title)}</span>
                    <button onclick="StudyRoom.deleteBookmark(${bm.id})" class="text-[#626f86] hover:text-rose-600 text-xs ml-1 cursor-pointer">✕</button>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Center Reader Content (6 cols) -->
        <div class="lg:col-span-6 bg-white rounded-xl border border-[#DCDFE4] p-6 sm:p-8 shadow-xs">
          <!-- Section Meta Bar -->
          <div class="flex items-center justify-between pb-4 mb-6 border-b border-[#DCDFE4]">
            <span class="text-xs font-semibold text-[#0c66e4] bg-[#E9F2FF] px-2.5 py-1 rounded">
              ${currentSection.page_or_slide || `Section ${currentSection.section_index}`}
            </span>
            <div class="flex items-center gap-2">
              <button onclick="StudyRoom.prevSection()" ${this.currentSectionIndex <= 1 ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="hover:bg-[#F1F2F4]"'}
                class="px-2.5 py-1 text-xs border border-[#DCDFE4] rounded text-[#172b4d] font-medium transition">
                ← Previous
              </button>
              <span class="text-xs text-[#626f86]">${this.currentSectionIndex} / ${sections.length}</span>
              <button onclick="StudyRoom.nextSection()" ${this.currentSectionIndex >= sections.length ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="hover:bg-[#F1F2F4]"'}
                class="px-2.5 py-1 text-xs border border-[#DCDFE4] rounded text-[#172b4d] font-medium transition">
                Next →
              </button>
            </div>
          </div>

          <!-- Section Heading -->
          <h1 class="text-xl font-semibold text-[#172b4d] mb-4">
            ${State.escapeHTML(currentSection.title || `Section ${currentSection.section_index}`)}
          </h1>

          <!-- Text Body -->
          <div id="reader-text-body" class="study-content text-[#172b4d] leading-relaxed text-sm whitespace-pre-line select-text">
            ${State.escapeHTML(currentSection.content)}
          </div>

          <!-- Bottom Section Navigation Buttons -->
          <div class="mt-8 pt-6 border-t border-[#DCDFE4] flex items-center justify-between">
            <button onclick="StudyRoom.prevSection()" ${this.currentSectionIndex <= 1 ? 'disabled class="opacity-40 cursor-not-allowed text-xs"' : 'class="text-xs text-[#0c66e4] font-semibold hover:text-[#0055cc]"'}>
              ← Previous Section
            </button>
            <button onclick="StudyRoom.nextSection()" ${this.currentSectionIndex >= sections.length ? 'disabled class="opacity-40 cursor-not-allowed text-xs"' : 'class="text-xs text-[#0c66e4] font-semibold hover:text-[#0055cc]"'}>
              Next Section →
            </button>
          </div>
        </div>

        <!-- AI Assistant & Learning Tools Sidepanel (3 cols) -->
        <div class="lg:col-span-3 space-y-4 sticky top-20">
          <div class="bg-white rounded-xl border border-[#DCDFE4] p-4 shadow-xs">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-[#626f86] mb-3 flex items-center justify-between">
              <span>AI Study Partner</span>
            </h3>

            <!-- AI Quick Action Buttons (Google Themed, Distinct & Clean) -->
            <div class="grid grid-cols-1 gap-2 mb-3">
              <button onclick="StudyRoom.triggerExplain()"
                class="p-2.5 bg-[#e8f0fe]/70 hover:bg-[#e8f0fe] border-l-[3px] border-[#4285F4] text-[#1a73e8] text-xs font-semibold rounded-lg text-left transition flex items-center justify-between shadow-2xs cursor-pointer">
                <span>Explain Simply</span>
                <span class="text-xs text-[#1a73e8] font-normal">5 styles</span>
              </button>
              <button onclick="StudyRoom.triggerSummary()"
                class="p-2.5 bg-[#fef7e0]/70 hover:bg-[#fef7e0] border-l-[3px] border-[#FBBC05] text-[#b06000] text-xs font-semibold rounded-lg text-left transition flex items-center justify-between shadow-2xs cursor-pointer">
                <span>Smart Summary</span>
                <span class="text-xs text-[#b06000] font-normal">Key points</span>
              </button>
              <button onclick="StudyRoom.triggerCreateQuiz()"
                class="p-2.5 bg-[#e6f4ea]/70 hover:bg-[#e6f4ea] border-l-[3px] border-[#34A853] text-[#1e8e3e] text-xs font-semibold rounded-lg text-left transition flex items-center justify-between shadow-2xs cursor-pointer">
                <span>Quiz Me</span>
                <span class="text-xs text-[#1e8e3e] font-normal">10 questions</span>
              </button>
            </div>

            <!-- Ask Question Chat Input -->
            <div class="mt-4 pt-3 border-t border-[#DCDFE4]">
              <label class="text-xs font-semibold text-[#44546f] block mb-1">Ask a question about this material:</label>
              <form onsubmit="StudyRoom.askQuestion(event)" class="space-y-2">
                <input id="ai-chat-question-input" type="text"
                  placeholder="e.g. What is the key mechanism?"
                  class="w-full text-xs p-2.5 rounded-lg border border-[#DCDFE4] text-[#172b4d] focus:outline-[#0c66e4]">
                <button type="submit" id="ai-ask-btn"
                  class="w-full py-2 bg-[#0c66e4] hover:bg-[#0055cc] text-white rounded-lg text-xs font-semibold transition">
                  Ask Question
                </button>
              </form>
            </div>

            <!-- AI Result Box -->
            <div id="ai-result-box" class="mt-4 p-3.5 rounded-xl bg-[#F7F8F9] border border-[#DCDFE4] text-xs text-[#172b4d] hidden max-h-96 overflow-y-auto shadow-xs">
              <div class="flex items-center justify-between pb-2 mb-2.5 border-b border-[#DCDFE4]">
                <span id="ai-result-title" class="font-bold text-[#172b4d] text-xs uppercase tracking-wide">Result</span>
                <div class="flex items-center gap-1.5">
                  <button onclick="StudyRoom.maximizeAIResult()" title="Maximize reading view" aria-label="Maximize reading view"
                    class="p-1 rounded-md text-[#626f86] hover:text-[#0c66e4] hover:bg-[#E9F2FF] transition cursor-pointer flex items-center gap-1">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
                    </svg>
                  </button>
                  <button onclick="document.getElementById('ai-result-box').classList.add('hidden')" title="Close" aria-label="Close"
                    class="p-1 rounded-md text-[#626f86] hover:text-[#172b4d] hover:bg-slate-200 transition cursor-pointer">✕</button>
                </div>
              </div>

              <!-- Quick Maximize Banner -->
              <div class="mb-2 p-1.5 rounded-md bg-blue-50/80 border border-blue-100 flex items-center justify-between text-[11px] text-[#0c66e4]">
                <span>Reading full guide?</span>
                <button onclick="StudyRoom.maximizeAIResult()" class="font-semibold underline hover:text-[#0055cc] cursor-pointer flex items-center gap-0.5">
                  <span>Maximize View</span>
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                </button>
              </div>

              <div id="ai-result-content" class="leading-relaxed text-xs text-[#172b4d]"></div>
              <div id="ai-result-citations" class="mt-2.5 pt-2 border-t border-[#DCDFE4] text-xs text-[#626f86] hidden"></div>

              <!-- Bottom Action Bar in Sidebar -->
              <div class="mt-3 pt-2.5 border-t border-[#DCDFE4] flex items-center justify-between text-[11px]">
                <button onclick="StudyRoom.maximizeAIResult()" class="font-semibold text-[#0c66e4] hover:text-[#0055cc] flex items-center gap-1 cursor-pointer">
                  <span>Open Full Screen</span>
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                </button>
                <div class="flex items-center gap-2">
                  <button onclick="StudyRoom.copyAIResult()" class="text-[#626f86] hover:text-[#172b4d] font-medium cursor-pointer">Copy</button>
                  <button onclick="StudyRoom.saveAIResultAsNote()" class="text-[#0c66e4] hover:text-[#0055cc] font-medium cursor-pointer">Save Note</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Slide-over Notes Drawer -->
      <div id="study-notes-drawer" class="fixed inset-y-0 right-0 w-80 md:w-96 bg-white shadow-2xl border-l border-[#DCDFE4] transform translate-x-full transition-transform duration-300 z-50 p-5 flex flex-col">
        <div class="flex items-center justify-between pb-3 border-b border-[#DCDFE4]">
          <h3 class="font-semibold text-[#172b4d] text-sm">Notes for this Material</h3>
          <button onclick="StudyRoom.toggleNotesDrawer()" class="text-[#626f86] hover:text-[#172b4d] text-base">✕</button>
        </div>

        <div class="my-3 flex-1 flex flex-col">
          <input id="drawer-note-title" type="text" placeholder="Note Title..."
            class="w-full text-xs font-semibold text-[#172b4d] p-2.5 mb-2 rounded border border-[#DCDFE4] focus:outline-[#0c66e4]">
          <textarea id="drawer-note-content" placeholder="Write study thoughts, formulas, or summaries..."
            class="w-full flex-1 text-xs p-2.5 text-[#172b4d] rounded border border-[#DCDFE4] focus:outline-[#0c66e4] resize-none leading-relaxed"></textarea>
        </div>

        <div class="pt-3 border-t border-[#DCDFE4] flex items-center justify-between">
          <span id="drawer-note-status" class="text-xs text-[#626f86]">Autosave ready</span>
          <button onclick="StudyRoom.saveDrawerNote()"
            class="px-4 py-1.5 bg-[#0c66e4] text-white rounded text-xs font-semibold hover:bg-[#0055cc] transition">
            Save Note
          </button>
        </div>
      </div>
    `;
  },

  goToSection(index) {
    this.currentSectionIndex = parseInt(index, 10) || 1;
    this.render();
    if (this.material && typeof App !== "undefined" && App.buildHash) {
      const hash = App.buildHash("study-room", { id: this.material.id, section: this.currentSectionIndex });
      try {
        window.history.replaceState({ view: "study-room", params: { id: this.material.id, section: this.currentSectionIndex }, idx: App.historyIndex }, "", hash);
      } catch (e) {}
    }
    const prefs = (typeof Settings !== "undefined" && Settings.getPreferences) ? Settings.getPreferences() : {};
    if (prefs.readerAutoScroll !== false) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  },

  prevSection() {
    if (this.currentSectionIndex > 1) {
      this.goToSection(this.currentSectionIndex - 1);
    }
  },

  nextSection() {
    const total = (this.material && this.material.sections) ? this.material.sections.length : 1;
    if (this.currentSectionIndex < total) {
      this.goToSection(this.currentSectionIndex + 1);
    }
  },

  async addBookmarkOnCurrentSection() {
    if (!this.material || !this.material.sections) return;
    const currentSection = this.material.sections.find(s => parseInt(s.section_index, 10) === this.currentSectionIndex);
    const title = window.prompt("Bookmark Title:", currentSection ? currentSection.title : `Section ${this.currentSectionIndex}`);
    if (!title) return;

    try {
      await API.addBookmark(this.material.id, {
        section_id: currentSection ? currentSection.id : null,
        title: title
      });
      State.toast("Bookmark saved", "success");
      this.material = await API.getMaterial(this.material.id);
      this.render();
    } catch (err) {
      State.toast("Failed to save bookmark", "error");
    }
  },

  async deleteBookmark(bookmarkId) {
    try {
      await API.deleteBookmark(bookmarkId);
      State.toast("Bookmark removed", "info");
      this.material = await API.getMaterial(this.material.id);
      this.render();
    } catch (err) {
      State.toast("Failed to delete bookmark", "error");
    }
  },

  toggleNotesDrawer() {
    const drawer = document.getElementById("study-notes-drawer");
    if (!drawer) return;
    const isOpen = !drawer.classList.contains("translate-x-full");
    if (isOpen) {
      drawer.classList.add("translate-x-full");
    } else {
      drawer.classList.remove("translate-x-full");
      this.loadExistingNoteForMaterial();
    }
  },

  async loadExistingNoteForMaterial() {
    const titleInput = document.getElementById("drawer-note-title");
    const contentInput = document.getElementById("drawer-note-content");
    const statusLabel = document.getElementById("drawer-note-status");
    if (!titleInput || !this.material) return;

    try {
      const notes = await API.getNotes({ material_id: this.material.id });
      if (notes.length > 0) {
        const note = notes[0];
        this.activeNoteId = note.id;
        titleInput.value = note.title;
        contentInput.value = note.content;
        statusLabel.textContent = `Last saved ${State.formatDate(note.updated_at)}`;
      } else {
        this.activeNoteId = null;
        titleInput.value = `${this.material.title} — Notes`;
        contentInput.value = "";
        statusLabel.textContent = "New note";
      }
    } catch (err) {
      console.warn("Could not load notes for drawer:", err);
    }
  },

  async saveDrawerNote() {
    const title = document.getElementById("drawer-note-title").value.trim();
    const content = document.getElementById("drawer-note-content").value;
    const statusLabel = document.getElementById("drawer-note-status");

    if (!title) {
      State.toast("Please enter a note title", "warning");
      return;
    }

    try {
      if (this.activeNoteId) {
        await API.updateNote(this.activeNoteId, { title, content });
      } else {
        const created = await API.createNote({
          title,
          content,
          material_id: this.material.id,
          topic_id: this.material.topic_id,
          subject_id: this.material.subject_id
        });
        this.activeNoteId = created.id;
      }
      statusLabel.textContent = "Saved just now";
      State.toast("Note saved successfully", "success");
    } catch (err) {
      State.toast("Failed to save note", "error");
    }
  },

  // ---------------- AI Learning Handlers ----------------
  lastAIResult: null,

  displayAIResult(title, text, citations = []) {
    this.lastAIResult = { title, text, citations };
    const box = document.getElementById("ai-result-box");
    const titleEl = document.getElementById("ai-result-title");
    const contentEl = document.getElementById("ai-result-content");
    const citationsEl = document.getElementById("ai-result-citations");
    if (!box) return;

    titleEl.textContent = title;
    contentEl.innerHTML = State.renderMarkdown(text);

    if (citations && citations.length > 0) {
      citationsEl.classList.remove("hidden");
      citationsEl.innerHTML = `<strong>Sources:</strong> ${citations.map(c => `${State.escapeHTML(c.reference)} (${State.escapeHTML(c.title)})`).join(", ")}`;
    } else {
      citationsEl.classList.add("hidden");
    }

    box.classList.remove("hidden");

    // Live update maximized modal if already opened
    const maxModal = document.getElementById("ai-result-max-modal");
    if (maxModal && !maxModal.classList.contains("hidden")) {
      this.populateMaxModal();
    }
  },

  populateMaxModal() {
    if (!this.lastAIResult) return;
    const maxTitle = document.getElementById("ai-result-max-title");
    const maxSubtitle = document.getElementById("ai-result-max-subtitle");
    const maxContent = document.getElementById("ai-result-max-content");
    const maxCitations = document.getElementById("ai-result-max-citations");

    if (maxTitle) maxTitle.textContent = this.lastAIResult.title || "Full Study Guide";
    if (maxSubtitle) maxSubtitle.textContent = this.material ? `Material: ${this.material.title}` : "AI Study Assistant";
    if (maxContent) maxContent.innerHTML = State.renderMarkdown(this.lastAIResult.text);

    if (maxCitations) {
      const citations = this.lastAIResult.citations || [];
      if (citations.length > 0) {
        maxCitations.classList.remove("hidden");
        maxCitations.innerHTML = `<strong>Grounded Sources:</strong> ${citations.map(c => `${State.escapeHTML(c.reference)} (${State.escapeHTML(c.title)})`).join(", ")}`;
      } else {
        maxCitations.classList.add("hidden");
      }
    }
  },

  maximizeAIResult() {
    if (!this.lastAIResult || !this.lastAIResult.text) {
      State.toast("Generate a summary or explanation first.", "info");
      return;
    }
    this.populateMaxModal();
    const maxModal = document.getElementById("ai-result-max-modal");
    if (maxModal) {
      maxModal.classList.remove("hidden");
    }
  },

  minimizeAIResult() {
    const maxModal = document.getElementById("ai-result-max-modal");
    if (maxModal) {
      maxModal.classList.add("hidden");
    }
  },

  async copyAIResult() {
    if (!this.lastAIResult || !this.lastAIResult.text) return;
    try {
      await navigator.clipboard.writeText(this.lastAIResult.text);
      State.toast("Copied to clipboard!", "success");
    } catch (err) {
      State.toast("Failed to copy text", "error");
    }
  },

  async saveAIResultAsNote() {
    if (!this.lastAIResult || !this.lastAIResult.text) return;
    try {
      const title = `${this.lastAIResult.title} - ${this.material ? this.material.title : 'Study Note'}`;
      await API.createNote({
        title,
        content: this.lastAIResult.text,
        material_id: this.material ? this.material.id : undefined,
        topic_id: this.material ? this.material.topic_id : undefined
      });
      State.toast("Saved to your Personal Notes!", "success");
    } catch (err) {
      State.toast(err.message || "Failed to save note", "error");
    }
  },

  async triggerExplain() {
    if (!this.material) return;
    const currentSection = this.material.sections.find(s => s.section_index === this.currentSectionIndex);
    const selectedText = window.getSelection().toString().trim() || (currentSection ? currentSection.content.slice(0, 1500) : "");

    if (!selectedText) {
      State.toast("No text available to explain", "warning");
      return;
    }

    this.displayAIResult("Explaining...", "Analyzing text...");
    try {
      const res = await API.aiExplain({
        text: selectedText,
        style: "simple",
        context_material_id: this.material.id
      });
      if (res.success) {
        this.displayAIResult("Simple Explanation", res.result);
      } else {
        this.displayAIResult("AI Setup Notice", res.message);
      }
    } catch (err) {
      this.displayAIResult("Error", err.message || "Failed to generate explanation");
    }
  },

  async triggerSummary() {
    if (!this.material) return;
    this.displayAIResult("Summarizing...", "Reading material sections and extracting core points...");
    try {
      const res = await API.aiSummary({ material_id: this.material.id });
      if (res.success) {
        this.displayAIResult("Smart Summary", res.result);
      } else {
        this.displayAIResult("AI Setup Notice", res.message);
      }
    } catch (err) {
      this.displayAIResult("Error", err.message || "Failed to generate summary");
    }
  },

  async askQuestion(e) {
    e.preventDefault();
    const input = document.getElementById("ai-chat-question-input");
    const question = input.value.trim();
    if (!question || !this.material) return;

    this.displayAIResult("Searching Material...", `Answering: "${question}"`);
    input.value = "";

    try {
      const res = await API.aiAskQuestion({
        material_id: this.material.id,
        question: question
      });
      if (res.success) {
        this.displayAIResult("Answer", res.result, res.citations);
      } else {
        this.displayAIResult("AI Setup Notice", res.message);
      }
    } catch (err) {
      this.displayAIResult("Error", err.message || "Could not retrieve answer");
    }
  },

  async triggerCreateQuiz() {
    if (!this.material) return;
    State.toast("Generating 10-question AI practice quiz...", "info");
    try {
      const res = await API.aiGenerateQuiz({
        material_id: this.material.id,
        topic_id: this.material.topic_id,
        question_count: 10,
        difficulty: "easy"
      });
      if (res.success && res.data && res.data.length > 0) {
        // Automatically save the 10-question quiz and launch the interactive test
        const savedQuiz = await API.createQuiz({
          title: `Quiz: ${this.material.title} (Easy)`,
          description: `10-question practice test generated from ${this.material.title}`,
          material_id: this.material.id,
          topic_id: this.material.topic_id,
          difficulty: "easy",
          questions: res.data
        });
        State.toast("10-question practice quiz ready! Starting now...", "success");
        await Quizzes.startQuiz(savedQuiz.id);
      } else {
        State.toast(res.message || "AI not configured. Add your API key in Settings.", "warning");
      }
    } catch (err) {
      State.toast(err.message || "Failed to generate quiz", "error");
    }
  }
};
