/**
 * Notes Controller
 * Personal notes creation, rich formatting (font size, font color, bold, italic),
 * linking to materials/topics, pinning, autosave.
 * Completely emoji-free, with flashcards conversion removed.
 */
const Notes = {
  notes: [],
  activeNote: null,
  autosaveTimer: null,
  currentFontSize: "14px",
  currentColor: "#172b4d",

  async load(options = {}) {
    await this.applyFilters();
    if (options.id) {
      const target = this.notes.find(n => n.id === parseInt(options.id));
      if (target) this.selectNote(target);
    }
  },

  async applyFilters() {
    const search = document.getElementById("notes-search")?.value;
    const subjectId = document.getElementById("notes-filter-subject")?.value;

    try {
      this.notes = await API.getNotes({
        search: search || undefined,
        subject_id: subjectId ? parseInt(subjectId) : undefined
      });
      this.renderList();
      if (!this.activeNote && this.notes.length > 0) {
        this.selectNote(this.notes[0]);
      } else if (this.notes.length === 0) {
        this.renderEmptyEditor();
      }
    } catch (err) {
      console.error("Failed to load notes:", err);
      State.toast("Failed to load notes.", "error");
    }
  },

  renderList() {
    const listEl = document.getElementById("notes-list");
    if (!listEl) return;

    if (this.notes.length === 0) {
      listEl.innerHTML = `
        <div class="p-8 text-center text-[#626f86] text-xs">
          No notes found. Click "+ New Note" to start writing.
        </div>
      `;
      return;
    }

    listEl.innerHTML = this.notes.map(n => `
      <div onclick="Notes.selectNoteById(${n.id})"
        class="p-3.5 border-b border-[#DCDFE4] hover:bg-[#F1F2F4] cursor-pointer transition ${this.activeNote && this.activeNote.id === n.id ? 'bg-[#E9F2FF] border-l-[3px] border-[#0c66e4]' : ''}">
        <div class="flex items-center justify-between">
          <h4 class="font-semibold text-[#172b4d] text-sm truncate pr-2 flex items-center gap-1.5 ${n.is_pinned ? 'text-[#0c66e4]' : ''}">
            ${n.is_pinned ? '<svg class="w-3.5 h-3.5 text-[#0c66e4] shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"/></svg>' : ''}
            <span>${State.escapeHTML(n.title)}</span>
          </h4>
          <span class="text-xs text-[#626f86] shrink-0">${State.formatDate(n.updated_at)}</span>
        </div>
        <p class="text-xs text-[#44546f] mt-1 line-clamp-2">${State.escapeHTML((n.content ? n.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '') || 'Empty note...')}</p>
        <div class="mt-2 flex items-center gap-1.5 text-xs text-[#626f86]">
          <span>${n.subject_name ? State.escapeHTML(n.subject_name) : 'General'}</span>
          ${n.material_title ? `<span class="truncate">• ${State.escapeHTML(n.material_title)}</span>` : ''}
        </div>
      </div>
    `).join('');
  },

  selectNoteById(id) {
    const note = this.notes.find(n => n.id === id);
    if (note) this.selectNote(note);
  },

  selectNote(note) {
    this.activeNote = note;
    this.renderList();
    if (note && note.id && typeof App !== "undefined" && App.buildHash) {
      const hash = App.buildHash("notes", { id: note.id });
      try {
        window.history.replaceState({ view: "notes", params: { id: note.id }, idx: App.historyIndex }, "", hash);
      } catch (e) {}
    }

    const editorEl = document.getElementById("notes-editor-pane");
    if (!editorEl) return;

    editorEl.innerHTML = `
      <!-- Top Title & Action Bar -->
      <div class="p-4 border-b border-[#DCDFE4] flex items-center justify-between bg-white">
        <div class="flex-1 min-w-0 pr-4">
          <input id="active-note-title" type="text" value="${State.escapeHTML(note.title)}"
            oninput="Notes.scheduleAutosave()"
            class="text-xl font-semibold text-[#172b4d] border-0 focus:ring-0 p-0 w-full focus:outline-none">
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span id="note-autosave-indicator" class="text-xs text-[#626f86]">Saved</span>
          <button onclick="Notes.togglePin(${note.id}, ${!note.is_pinned})"
            title="${note.is_pinned ? 'Unpin note' : 'Pin note'}"
            class="p-1.5 rounded hover:bg-[#F1F2F4] text-xs flex items-center gap-1 ${note.is_pinned ? 'text-[#0c66e4] bg-[#E9F2FF] font-semibold' : 'text-[#626f86]'}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
            <span class="text-xs">${note.is_pinned ? 'Pinned' : 'Pin'}</span>
          </button>
          <button onclick="Notes.confirmDelete(${note.id})"
            title="Delete note"
            class="p-1.5 text-[#626f86] hover:text-rose-600 rounded">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>

      <!-- Formatting Controls Toolbar: Font Size & Color Options -->
      <div class="px-4 py-2 border-b border-[#DCDFE4] bg-[#F7F8F9] flex flex-wrap items-center gap-3 text-xs">
        <!-- Font Size Selector -->
        <div class="flex items-center gap-1.5">
          <label class="text-xs font-semibold text-[#626f86]">Font Size:</label>
          <select id="note-font-size-select" onchange="Notes.changeFontSize(this.value)"
            class="p-1 rounded border border-[#DCDFE4] text-xs bg-white text-[#172b4d] focus:outline-[#0c66e4]">
            <option value="12px">12px (Small)</option>
            <option value="14px" selected>14px (Normal)</option>
            <option value="16px">16px (Medium)</option>
            <option value="18px">18px (Large)</option>
            <option value="22px">22px (Extra Large)</option>
          </select>
        </div>

        <div class="h-4 w-px bg-[#DCDFE4]"></div>

        <!-- Font Color Options -->
        <div class="flex items-center gap-1.5">
          <label class="text-xs font-semibold text-[#626f86]">Color:</label>
          <div class="flex items-center gap-1">
            <button onclick="Notes.changeColor('#172b4d')" title="Charcoal (Default)" class="w-5 h-5 rounded-full border border-slate-300 bg-[#172b4d] hover:scale-110 transition"></button>
            <button onclick="Notes.changeColor('#0c66e4')" title="Jira Blue" class="w-5 h-5 rounded-full border border-slate-300 bg-[#0c66e4] hover:scale-110 transition"></button>
            <button onclick="Notes.changeColor('#059669')" title="Emerald Green" class="w-5 h-5 rounded-full border border-slate-300 bg-emerald-600 hover:scale-110 transition"></button>
            <button onclick="Notes.changeColor('#7c3aed')" title="Purple" class="w-5 h-5 rounded-full border border-slate-300 bg-purple-600 hover:scale-110 transition"></button>
            <button onclick="Notes.changeColor('#e11d48')" title="Rose Red" class="w-5 h-5 rounded-full border border-slate-300 bg-rose-600 hover:scale-110 transition"></button>
            <button onclick="Notes.changeColor('#d97706')" title="Amber Orange" class="w-5 h-5 rounded-full border border-slate-300 bg-amber-600 hover:scale-110 transition"></button>
            <button onclick="Notes.changeColor('#626f86')" title="Slate Muted" class="w-5 h-5 rounded-full border border-slate-300 bg-[#626f86] hover:scale-110 transition"></button>
            <input type="color" id="note-custom-color" value="#172b4d" onchange="Notes.changeColor(this.value)" title="Custom Color"
              class="w-5 h-5 p-0 rounded-full border border-slate-300 cursor-pointer overflow-hidden">
          </div>
        </div>

        <div class="h-4 w-px bg-[#DCDFE4]"></div>

        <!-- Basic Styling Helpers -->
        <div class="flex items-center gap-1">
          <button onclick="Notes.formatText('bold')" title="Bold" class="px-2 py-0.5 rounded hover:bg-[#F1F2F4] font-bold text-[#172b4d]">B</button>
          <button onclick="Notes.formatText('italic')" title="Italic" class="px-2 py-0.5 rounded hover:bg-[#F1F2F4] italic font-serif text-[#172b4d]">I</button>
          <button onclick="Notes.formatText('underline')" title="Underline" class="px-2 py-0.5 rounded hover:bg-[#F1F2F4] underline text-[#172b4d]">U</button>
          <button onclick="Notes.formatText('insertUnorderedList')" title="Bullet List" class="px-2 py-0.5 rounded hover:bg-[#F1F2F4] text-[#172b4d] text-xs">• List</button>
        </div>
      </div>

      <!-- Rich Editable Note Area -->
      <div class="p-5 flex-1 flex flex-col bg-white overflow-y-auto">
        <div id="active-note-content" contenteditable="true"
          placeholder="Start typing your study note here..."
          oninput="Notes.scheduleAutosave()"
          style="font-size: 14px; color: #172b4d;"
          class="note-rich-editor flex-1 w-full focus:outline-none leading-relaxed">${note.content || ''}</div>
      </div>
    `;
  },

  changeFontSize(size) {
    this.currentFontSize = size;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      // Apply to selected text
      const range = selection.getRangeAt(0);
      const span = document.createElement("span");
      span.style.fontSize = size;
      span.appendChild(range.extractContents());
      range.insertNode(span);
    } else {
      // Apply to entire note editor container
      const editor = document.getElementById("active-note-content");
      if (editor) editor.style.fontSize = size;
    }
    this.scheduleAutosave();
  },

  changeColor(color) {
    this.currentColor = color;
    const customPicker = document.getElementById("note-custom-color");
    if (customPicker) customPicker.value = color;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      document.execCommand("styleWithCSS", false, true);
      document.execCommand("foreColor", false, color);
    } else {
      const editor = document.getElementById("active-note-content");
      if (editor) editor.style.color = color;
    }
    this.scheduleAutosave();
  },

  formatText(command) {
    document.execCommand(command, false, null);
    this.scheduleAutosave();
  },

  renderEmptyEditor() {
    const editorEl = document.getElementById("notes-editor-pane");
    if (!editorEl) return;
    editorEl.innerHTML = `
      <div class="p-16 text-center text-[#626f86] text-xs">
        <p>No note selected. Choose a note from the left or create a new one.</p>
        <button onclick="Notes.createNewNote()" class="mt-3 px-3 py-1.5 bg-[#0c66e4] hover:bg-[#0055cc] text-white rounded text-xs font-semibold transition">
          + New Note
        </button>
      </div>
    `;
  },

  async createNewNote(subjectId = null, topicId = null, materialId = null) {
    try {
      const created = await API.createNote({
        title: "Untitled Note",
        content: "",
        subject_id: subjectId,
        topic_id: topicId,
        material_id: materialId
      });
      State.toast("Created new note", "success");
      await this.applyFilters();
      this.selectNote(created);
      document.getElementById("active-note-title")?.focus();
    } catch (err) {
      State.toast("Failed to create note", "error");
    }
  },

  scheduleAutosave() {
    const indicator = document.getElementById("note-autosave-indicator");
    if (indicator) indicator.textContent = "Saving...";

    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => {
      this.saveActiveNote();
    }, 1200);
  },

  async saveActiveNote() {
    if (!this.activeNote) return;
    const title = document.getElementById("active-note-title")?.value.trim() || "Untitled Note";
    const editor = document.getElementById("active-note-content");
    const content = editor ? editor.innerHTML : "";
    const indicator = document.getElementById("note-autosave-indicator");

    try {
      await API.updateNote(this.activeNote.id, { title, content });
      this.activeNote.title = title;
      this.activeNote.content = content;
      if (indicator) indicator.textContent = "Saved";
      this.renderList();
    } catch (err) {
      if (indicator) indicator.textContent = "Save failed";
      console.warn("Autosave failed:", err);
    }
  },

  async togglePin(id, isPinned) {
    try {
      await API.updateNote(id, { is_pinned: isPinned });
      State.toast(isPinned ? "Note pinned" : "Note unpinned", "info");
      await this.applyFilters();
      const n = this.notes.find(x => x.id === id);
      if (n) this.selectNote(n);
    } catch (err) {
      State.toast("Failed to pin note", "error");
    }
  },

  confirmDelete(id) {
    if (window.confirm("Are you sure you want to delete this note?")) {
      this.deleteNote(id);
    }
  },

  async deleteNote(id) {
    try {
      await API.deleteNote(id);
      State.toast("Note deleted", "info");
      this.activeNote = null;
      await this.applyFilters();
    } catch (err) {
      State.toast("Failed to delete note", "error");
    }
  }
};
