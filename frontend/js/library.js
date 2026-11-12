/**
 * My Library View Controller
 * Search, multi-criteria filtering, grid/list toggle, rename, move, favorite, delete.
 * Clean, professional, completely emoji-free.
 */
const Library = {
  materials: [],
  currentViewMode: "grid",

  async load() {
    await this.applyFilters();
  },

  async applyFilters() {
    const searchInput = document.getElementById("library-search");
    const subjectFilter = document.getElementById("library-filter-subject");
    const typeFilter = document.getElementById("library-filter-type");
    const favFilter = document.getElementById("library-filter-fav");
    const sortFilter = document.getElementById("library-filter-sort");

    const params = {
      search: searchInput ? searchInput.value : "",
      subject_id: subjectFilter && subjectFilter.value ? subjectFilter.value : undefined,
      source_type: typeFilter && typeFilter.value ? typeFilter.value : undefined,
      is_favorite: favFilter && favFilter.checked ? true : undefined,
      sort_by: sortFilter ? sortFilter.value : "recent"
    };

    try {
      this.materials = await API.getMaterials(params);
      this.render();
    } catch (err) {
      console.error("Failed to load materials:", err);
      State.toast("Failed to load library materials.", "error");
    }
  },

  setViewMode(mode) {
    this.currentViewMode = mode;
    const gridBtn = document.getElementById("lib-view-grid-btn");
    const listBtn = document.getElementById("lib-view-list-btn");
    if (gridBtn && listBtn) {
      if (mode === "grid") {
        gridBtn.className = "p-1.5 rounded bg-slate-200 text-slate-800";
        listBtn.className = "p-1.5 rounded text-slate-500 hover:text-slate-800";
      } else {
        listBtn.className = "p-1.5 rounded bg-slate-200 text-slate-800";
        gridBtn.className = "p-1.5 rounded text-slate-500 hover:text-slate-800";
      }
    }
    this.render();
  },

  render() {
    const container = document.getElementById("library-items-container");
    const countBadge = document.getElementById("library-count-badge");
    if (!container) return;

    if (countBadge) {
      countBadge.textContent = `${this.materials.length} material${this.materials.length === 1 ? '' : 's'}`;
    }

    if (this.materials.length === 0) {
      container.className = "w-full";
      container.innerHTML = `
        <div class="py-16 text-center bg-white rounded-xl border border-slate-200/80">
          <div class="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
          </div>
          <h4 class="text-sm font-bold text-slate-700">No study materials found</h4>
          <p class="text-xs text-slate-400 mt-1">Try adjusting your filters or upload a new study document.</p>
          <button onclick="App.openAddMaterialModal()" class="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition">
            + Add Study Material
          </button>
        </div>
      `;
      return;
    }

    if (this.currentViewMode === "grid") {
      container.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4";
      container.innerHTML = this.materials.map(m => this.renderGridCard(m)).join('');
    } else {
      container.className = "bg-white rounded-xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden";
      container.innerHTML = this.materials.map(m => this.renderListRow(m)).join('');
    }
  },

  getTypeBadge(type) {
    const t = (type || "").toLowerCase();
    const colors = {
      pdf: "bg-rose-50 text-rose-700 border-rose-200",
      docx: "bg-blue-50 text-blue-700 border-blue-200",
      pptx: "bg-orange-50 text-orange-700 border-orange-200",
      txt: "bg-slate-100 text-slate-700 border-slate-200",
      md: "bg-teal-50 text-teal-700 border-teal-200",
      xlsx: "bg-emerald-50 text-emerald-700 border-emerald-200",
      web: "bg-indigo-50 text-indigo-700 border-indigo-200",
      video: "bg-red-50 text-red-700 border-red-200"
    };
    const c = colors[t] || "bg-slate-100 text-slate-700 border-slate-200";
    return `<span class="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border ${c}">${t}</span>`;
  },

  renderGridCard(m) {
    const starIcon = m.is_favorite
      ? '<svg class="w-4 h-4 text-amber-500 fill-current" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>'
      : '<svg class="w-4 h-4 text-slate-300 hover:text-amber-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>';

    return `
      <div onclick="App.navigateTo('study-room', { id: ${m.id} })"
        class="bg-white rounded-xl border border-[#dcdfe4] hover:border-[#0c66e4] hover:shadow-xs transition flex flex-col justify-between p-4 group cursor-pointer">
        <div>
          <div class="flex items-center justify-between mb-2">
            ${this.getTypeBadge(m.source_type)}
            <button onclick="event.stopPropagation(); Library.toggleFavorite(${m.id}, ${!m.is_favorite})" title="Favorite" class="p-1 cursor-pointer">
              ${starIcon}
            </button>
          </div>

          <h4 class="font-semibold text-[#172b4d] text-sm group-hover:text-[#0c66e4] line-clamp-2 leading-snug"
            title="${State.escapeHTML(m.title)}">
            ${State.escapeHTML(m.title)}
          </h4>

          <div class="mt-2 text-sm text-[#44546f] space-y-0.5">
            <p class="truncate">
              <span class="text-[#626f86] text-xs">Subject:</span> ${m.subject_name ? State.escapeHTML(m.subject_name) : 'Unassigned'}
            </p>
            ${m.topic_name ? `
              <p class="truncate"><span class="text-[#626f86] text-xs">Topic:</span> ${State.escapeHTML(m.topic_name)}</p>
            ` : ''}
            <p class="text-[#626f86] text-xs pt-1">
              ${m.sections_count} section${m.sections_count === 1 ? '' : 's'} • ${m.file_size ? State.formatFileSize(m.file_size) : 'Web'}
            </p>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-[#f1f2f4] flex items-center justify-between">
          <span class="text-xs text-[#626f86]">${State.formatDate(m.created_at)}</span>
          <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition" onclick="event.stopPropagation()">
            <button onclick="Library.openMoveModal(${m.id})" title="Move / Organize" class="p-1 text-[#626f86] hover:text-[#172b4d] rounded cursor-pointer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
            </button>
            <button onclick="Library.openRenameModal(${m.id}, '${State.escapeHTML(m.title)}')" title="Rename" class="p-1 text-[#626f86] hover:text-[#172b4d] rounded cursor-pointer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            </button>
            <button onclick="Library.confirmDelete(${m.id})" title="Delete" class="p-1 text-[#626f86] hover:text-rose-600 rounded cursor-pointer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  renderListRow(m) {
    const starIcon = m.is_favorite
      ? '<svg class="w-4 h-4 text-amber-500 fill-current" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>'
      : '<svg class="w-4 h-4 text-slate-300 hover:text-amber-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>';

    return `
      <div onclick="App.navigateTo('study-room', { id: ${m.id} })"
        class="flex items-center justify-between p-3.5 hover:bg-[#f1f2f4] transition border-b border-slate-100 cursor-pointer group">
        <div class="flex items-center gap-3 min-w-0 pr-4">
          <button onclick="event.stopPropagation(); Library.toggleFavorite(${m.id}, ${!m.is_favorite})" class="cursor-pointer">
            ${starIcon}
          </button>
          <div>${this.getTypeBadge(m.source_type)}</div>
          <div class="min-w-0">
            <h4 class="font-semibold text-[#172b4d] text-sm group-hover:text-[#0c66e4] truncate">
              ${State.escapeHTML(m.title)}
            </h4>
            <div class="flex items-center gap-2 text-xs text-[#626f86] mt-0.5 truncate">
              <span>${m.subject_name ? State.escapeHTML(m.subject_name) : 'Unassigned'}</span>
              ${m.topic_name ? `<span>• ${State.escapeHTML(m.topic_name)}</span>` : ''}
              <span>• ${m.sections_count} sections</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 shrink-0 text-xs text-[#626f86]" onclick="event.stopPropagation()">
          <span class="hidden sm:inline">${State.formatDate(m.created_at)}</span>
          <div class="flex items-center gap-1.5">
            <button onclick="App.navigateTo('study-room', { id: ${m.id} })" class="px-2.5 py-1 bg-[#e9f2ff] text-[#0c66e4] hover:bg-[#d8e6fd] rounded text-sm font-medium transition cursor-pointer">
              Read
            </button>
            <button onclick="Library.openMoveModal(${m.id})" title="Move / Organize" class="p-1 text-[#626f86] hover:text-[#172b4d] rounded cursor-pointer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
            </button>
            <button onclick="Library.openRenameModal(${m.id}, '${State.escapeHTML(m.title)}')" title="Rename" class="p-1 text-[#626f86] hover:text-[#172b4d] rounded cursor-pointer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            </button>
            <button onclick="Library.confirmDelete(${m.id})" title="Delete" class="p-1 text-[#626f86] hover:text-rose-600 rounded cursor-pointer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  async toggleFavorite(id, isFavorite) {
    try {
      await API.updateMaterial(id, { is_favorite: isFavorite });
      const mat = this.materials.find(m => m.id === id);
      if (mat) mat.is_favorite = isFavorite;
      this.render();
      State.toast(isFavorite ? "Added to favorites" : "Removed from favorites", "info");
    } catch (err) {
      State.toast("Failed to update favorite status", "error");
    }
  },

  openRenameModal(id, currentTitle) {
    const modal = document.getElementById("rename-material-modal");
    const input = document.getElementById("rename-material-input");
    const idInput = document.getElementById("rename-material-id");
    if (!modal || !input) return;

    idInput.value = id;
    input.value = currentTitle;
    modal.classList.remove("hidden");
    input.focus();
  },

  async submitRename(e) {
    e.preventDefault();
    const id = document.getElementById("rename-material-id").value;
    const title = document.getElementById("rename-material-input").value.trim();
    if (!title) return;

    try {
      await API.updateMaterial(id, { title });
      State.toast("Material renamed successfully", "success");
      document.getElementById("rename-material-modal").classList.add("hidden");
      this.applyFilters();
    } catch (err) {
      State.toast(err.message || "Failed to rename material", "error");
    }
  },

  openMoveModal(id) {
    const modal = document.getElementById("move-material-modal");
    const idInput = document.getElementById("move-material-id");
    const subjectSelect = document.getElementById("move-material-subject");
    const topicSelect = document.getElementById("move-material-topic");
    if (!modal) return;

    idInput.value = id;
    const mat = (this.materials || []).find(m => m.id === parseInt(id));
    if (mat) {
      if (subjectSelect) subjectSelect.value = mat.subject_id ? String(mat.subject_id) : "";
      State.populateTopicSelect(mat.subject_id, topicSelect, mat.topic_id);
    } else {
      State.populateTopicSelect(null, topicSelect, null);
    }
    modal.classList.remove("hidden");
  },

  async submitMove(e) {
    e.preventDefault();
    const id = document.getElementById("move-material-id").value;
    const subjectId = document.getElementById("move-material-subject").value;
    const topicId = document.getElementById("move-material-topic").value;

    try {
      const topicInfo = topicId ? State.getTopicDetails(topicId) : null;
      await API.updateMaterial(id, {
        subject_id: subjectId ? parseInt(subjectId) : null,
        chapter_id: topicInfo ? topicInfo.chapterId : null,
        topic_id: topicId ? parseInt(topicId) : null
      });
      State.toast("Material moved successfully", "success");
      document.getElementById("move-material-modal").classList.add("hidden");
      const tree = await API.getSubjects();
      State.setSubjects(tree);
      this.applyFilters();
      if (typeof Subjects !== "undefined") Subjects.load();
    } catch (err) {
      State.toast(err.message || "Failed to move material", "error");
    }
  },

  confirmDelete(id) {
    const confirmed = window.confirm("Are you sure you want to delete this study material and all its sections?");
    if (confirmed) {
      this.deleteMaterial(id);
    }
  },

  async deleteMaterial(id) {
    try {
      await API.deleteMaterial(id);
      State.toast("Material deleted", "info");
      this.applyFilters();
    } catch (err) {
      State.toast(err.message || "Failed to delete material", "error");
    }
  }
};
