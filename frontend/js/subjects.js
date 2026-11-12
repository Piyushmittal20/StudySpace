/**
 * Subjects & Topics Hierarchy Controller
 * Collapsible interactive tree: Subject -> Chapter -> Topic.
 * Shows topic details (materials, notes, quizzes) without flashcards and completely emoji-free.
 * Supports inline note editing inside the subject/topic without navigating away,
 * opening a 35% right side-panel and shifting the hierarchy/details to 65% on the left.
 */
const Subjects = {
  tree: [],
  selectedTopic: null,
  selectedSubjectId: null,
  activeInlineNoteId: null,
  inlineAutosaveTimer: null,
  currentInlineFontSize: "14px",
  currentInlineColor: "#172b4d",

  async load(options = {}) {
    try {
      this.tree = await API.getSubjects();
      State.setSubjects(this.tree);
      this.renderTree();

      if (options.topicId) {
        this.selectTopicById(options.topicId);
      } else if (this.selectedTopic) {
        this.selectTopicById(this.selectedTopic.id);
      } else if (this.selectedSubjectId) {
        this.selectSubject(this.selectedSubjectId);
      } else {
        this.renderEmptyTopicDetail();
      }
    } catch (err) {
      console.error("Failed to load subjects tree:", err);
      State.toast("Failed to load subjects and topics.", "error");
    }
  },

  renderTree() {
    const container = document.getElementById("subjects-tree-container");
    if (!container) return;

    if (this.tree.length === 0) {
      container.innerHTML = `
        <div class="p-6 text-center text-slate-400 text-xs">
          No subjects created yet. Click "+ New Subject" to begin organizing your studies.
        </div>
      `;
      return;
    }

    container.innerHTML = this.tree.map(subject => `
      <div class="mb-3 bg-white rounded-xl border border-[#dcdfe4] overflow-hidden shadow-xs">
        <!-- Subject Header -->
        <div class="flex items-center justify-between p-3 bg-slate-50/70 hover:bg-[#f1f2f4] transition group cursor-pointer border-b border-[#dcdfe4]"
             onclick="Subjects.handleSubjectClick(${subject.id})">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${subject.color || '#0c66e4'}"></span>
            <span class="font-semibold text-[#172b4d] text-sm truncate">${State.escapeHTML(subject.name)}</span>
            <span class="text-xs text-[#626f86]">(${subject.materials_count || 0})</span>
          </div>
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition" onclick="event.stopPropagation()">
            <button onclick="Subjects.createNewInlineNoteForSubject(${subject.id})" title="Add Note to Subject" class="p-1 text-[#626f86] hover:text-[#0c66e4] text-xs font-semibold cursor-pointer">
              + Note
            </button>
            <button onclick="Subjects.openAddChapterModal(${subject.id})" title="Add Chapter" class="p-1 text-[#626f86] hover:text-[#0c66e4] text-xs font-semibold cursor-pointer">
              + Chapter
            </button>
            <button onclick="Subjects.openEditSubjectModal(${subject.id}, '${State.escapeHTML(subject.name)}', '${State.escapeHTML(subject.description)}', '${subject.color}')" title="Edit" class="p-1 text-[#626f86] hover:text-[#172b4d] cursor-pointer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            </button>
            <button onclick="Subjects.confirmDeleteSubject(${subject.id})" title="Delete" class="p-1 text-[#626f86] hover:text-rose-600 cursor-pointer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>

        <!-- Chapters List -->
        <div id="sub-children-${subject.id}" class="divide-y divide-slate-100 border-t border-slate-100">
          ${(subject.chapters && subject.chapters.length > 0) ? subject.chapters.map(chapter => `
            <div class="p-2.5 pl-6 bg-white hover:bg-slate-50/40 transition">
              <div class="flex items-center justify-between group">
                <span class="text-sm font-medium text-[#172b4d] flex items-center gap-1.5 cursor-pointer"
                      onclick="Subjects.toggleCollapse('chap-topics-${chapter.id}')">
                  <svg class="w-3.5 h-3.5 text-[#626f86]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                  <span class="truncate">${State.escapeHTML(chapter.name)}</span>
                </span>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onclick="Subjects.openAddTopicModal(${chapter.id})" title="Add Topic" class="p-1 text-[#626f86] hover:text-[#0c66e4] text-xs font-semibold cursor-pointer">
                    + Topic
                  </button>
                  <button onclick="Subjects.openEditChapterModal(${chapter.id}, '${State.escapeHTML(chapter.name)}', '${State.escapeHTML(chapter.description)}')" title="Edit" class="p-1 text-[#626f86] hover:text-[#172b4d] cursor-pointer">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                  </button>
                  <button onclick="Subjects.confirmDeleteChapter(${chapter.id})" title="Delete" class="p-1 text-[#626f86] hover:text-rose-600 cursor-pointer">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>

              <!-- Topics List -->
              <div id="chap-topics-${chapter.id}" class="mt-2 space-y-1 pl-4 border-l-2 border-[#DCDFE4]">
                ${(chapter.topics && chapter.topics.length > 0) ? chapter.topics.map(topic => `
                  <div onclick="Subjects.selectTopic(${topic.id}, '${State.escapeHTML(topic.name)}', ${topic.is_completed}, '${State.escapeHTML(topic.description || '')}')"
                    class="flex items-center justify-between p-1.5 rounded hover:bg-[#F1F2F4] cursor-pointer transition text-xs ${Subjects.selectedTopic && Subjects.selectedTopic.id === topic.id ? 'bg-[#E9F2FF] font-semibold text-[#0c66e4] border-l-2 border-[#0c66e4]' : 'text-[#44546f] font-medium'}">
                    <div class="flex items-center gap-2 truncate">
                      <input type="checkbox" ${topic.is_completed ? 'checked' : ''}
                        onclick="event.stopPropagation(); Subjects.toggleTopicComplete(${topic.id})"
                        class="rounded text-[#0c66e4] focus:ring-0 cursor-pointer">
                      <span class="${topic.is_completed ? 'line-through text-[#626f86]' : ''} truncate">
                        ${State.escapeHTML(topic.name)}
                      </span>
                    </div>
                    <span class="text-xs text-[#626f86] shrink-0">
                      ${topic.materials_count || 0} mats
                    </span>
                  </div>
                `).join('') : '<p class="text-xs text-[#626f86] py-1">No topics yet</p>'}
              </div>
            </div>
          `).join('') : '<p class="text-xs text-[#626f86] p-3 pl-8">No chapters in this subject</p>'}
        </div>
      </div>
    `).join('');
  },

  handleSubjectClick(subjectId) {
    this.toggleCollapse(`sub-children-${subjectId}`);
    if (!this.selectedTopic) {
      this.selectSubject(subjectId);
    }
  },

  toggleCollapse(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      el.classList.toggle("hidden");
    }
  },

  getSubjectForTopic(topicId) {
    for (const s of (this.tree || [])) {
      for (const c of (s.chapters || [])) {
        for (const t of (c.topics || [])) {
          if (t.id === parseInt(topicId)) {
            return s;
          }
        }
      }
    }
    return null;
  },

  getChapterForTopic(topicId) {
    for (const s of (this.tree || [])) {
      for (const c of (s.chapters || [])) {
        for (const t of (c.topics || [])) {
          if (t.id === parseInt(topicId)) {
            return c;
          }
        }
      }
    }
    return null;
  },

  getTopicById(topicId) {
    for (const s of (this.tree || [])) {
      for (const c of (s.chapters || [])) {
        for (const t of (c.topics || [])) {
          if (t.id === parseInt(topicId)) {
            return t;
          }
        }
      }
    }
    return null;
  },

  getSubjectById(subjectId) {
    return (this.tree || []).find(s => s.id === parseInt(subjectId)) || null;
  },

  selectTopicById(topicId) {
    for (const s of this.tree) {
      for (const c of (s.chapters || [])) {
        for (const t of (c.topics || [])) {
          if (t.id === parseInt(topicId)) {
            this.selectTopic(t.id, t.name, t.is_completed, t.description || '');
            return;
          }
        }
      }
    }
  },

  async selectSubject(subjectId) {
    if (this.activeInlineNoteId) {
      await this.closeInlineNote();
    }
    this.selectedSubjectId = parseInt(subjectId);
    this.selectedTopic = null;

    const sub = this.getSubjectById(subjectId);
    if (!sub) return;

    const container = document.getElementById("topic-detail-container");
    if (!container) return;

    container.innerHTML = `
      <div class="p-8 text-center text-[#626f86] text-xs">
        Loading subject details...
      </div>
    `;

    try {
      const [materials, notes] = await Promise.all([
        API.getMaterials({ subject_id: subjectId }),
        API.getNotes({ subject_id: subjectId })
      ]);

      const chaptersCount = sub.chapters ? sub.chapters.length : 0;
      let topicsCount = 0;
      (sub.chapters || []).forEach(c => {
        topicsCount += (c.topics ? c.topics.length : 0);
      });

      container.innerHTML = `
        <div class="bg-white rounded-xl border border-[#DCDFE4] p-5 shadow-xs">
          <div class="flex items-center justify-between pb-4 border-b border-[#DCDFE4]">
            <div>
              <div class="flex items-center gap-2">
                <span class="w-3.5 h-3.5 rounded-full shrink-0" style="background-color: ${sub.color || '#0c66e4'}"></span>
                <h3 class="text-xl font-semibold text-[#172b4d]">${State.escapeHTML(sub.name)}</h3>
              </div>
              <p class="text-xs text-[#626f86] mt-1">${State.escapeHTML(sub.description || 'Subject Overview')}</p>
              <div class="mt-2 flex items-center gap-3 text-xs text-[#626f86]">
                <span>${chaptersCount} chapters</span>
                <span>•</span>
                <span>${topicsCount} topics</span>
                <span>•</span>
                <span>${materials.length} materials</span>
                <span>•</span>
                <span>${notes.length} notes</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="Subjects.openAddChapterModal(${sub.id})"
                class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0c66e4] text-white hover:bg-[#0055cc] transition cursor-pointer">
                + New Chapter
              </button>
            </div>
          </div>

          <div class="mt-6 space-y-6">
            <!-- Subject Notes Section -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h4 id="subject-notes-count-header" class="text-xs font-semibold uppercase tracking-wider text-[#626f86]">
                  Subject Notes (${notes.length})
                </h4>
                <button onclick="Subjects.createNewInlineNoteForSubject(${sub.id})" class="text-xs text-[#0c66e4] font-semibold hover:text-[#0055cc] cursor-pointer">
                  + Add Note
                </button>
              </div>
              <div id="subject-notes-list">
                ${this.renderTopicNotesList(notes)}
              </div>
            </div>

            <!-- Subject Materials Section -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-xs font-semibold uppercase tracking-wider text-[#626f86]">
                  Study Materials (${materials.length})
                </h4>
                <button onclick="App.openAddMaterialModal({ subjectId: ${sub.id} })" class="text-xs text-[#0c66e4] font-semibold hover:text-[#0055cc] cursor-pointer">
                  + Add Material
                </button>
              </div>
              ${materials.length > 0 ? `
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  ${materials.map(m => `
                    <div onclick="App.navigateTo('study-room', { id: ${m.id} })"
                      class="p-3 rounded-lg border border-[#DCDFE4] hover:border-[#0c66e4] hover:shadow-xs transition cursor-pointer flex items-center justify-between bg-[#F7F8F9] hover:bg-white">
                      <div class="truncate pr-2">
                        <span class="font-semibold text-[#172b4d] text-sm block truncate">${State.escapeHTML(m.title)}</span>
                        <span class="text-xs text-[#626f86]">${m.sections_count || 1} sections • ${m.source_type}</span>
                      </div>
                      <span class="text-xs text-[#0c66e4] font-medium shrink-0">Read</span>
                    </div>
                  `).join('')}
                </div>
              ` : '<p class="text-xs text-[#626f86] italic">No materials assigned to this subject yet.</p>'}
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error("Failed to load subject details:", err);
      container.innerHTML = `<p class="p-4 text-xs text-rose-500">Could not load subject details.</p>`;
    }
  },

  async selectTopic(id, name, isCompleted, description) {
    if (this.activeInlineNoteId) {
      await this.closeInlineNote();
    }
    this.selectedTopic = { id, name, isCompleted, description };
    if (typeof App !== "undefined" && App.buildHash) {
      const hash = App.buildHash("subjects", { topicId: id });
      try {
        window.history.replaceState({ view: "subjects", params: { topicId: id }, idx: App.historyIndex }, "", hash);
      } catch (e) {}
    }
    const container = document.getElementById("topic-detail-container");
    if (!container) return;

    container.innerHTML = `
      <div class="p-8 text-center text-slate-400 text-xs">
        Loading topic resources...
      </div>
    `;

    try {
      const subject = this.getSubjectForTopic(id);
      const [materials, notes, quizzes, subjectMaterials] = await Promise.all([
        API.getMaterials({ topic_id: id }),
        API.getNotes({ topic_id: id }),
        API.getQuizzes({ topic_id: id }),
        subject ? API.getMaterials({ subject_id: subject.id }) : Promise.resolve([])
      ]);

      const unassignedInSubject = (subjectMaterials || []).filter(sm => !sm.topic_id);

      container.innerHTML = `
        <div class="bg-white rounded-xl border border-[#DCDFE4] p-5 shadow-xs">
          <div class="flex items-center justify-between pb-4 border-b border-[#DCDFE4]">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-xl font-semibold text-[#172b4d]">${State.escapeHTML(name)}</h3>
                <span class="px-2 py-0.5 rounded text-xs font-semibold ${isCompleted ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-[#0c66e4]'}">
                  ${isCompleted ? 'Completed' : 'In Progress'}
                </span>
              </div>
              <p class="text-xs text-[#626f86] mt-0.5">${State.escapeHTML(description || 'Topic Overview')}</p>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="Subjects.toggleTopicComplete(${id})"
                class="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#DCDFE4] text-[#172b4d] hover:bg-[#F1F2F4] transition cursor-pointer">
                ${isCompleted ? 'Mark Incomplete' : 'Mark Complete'}
              </button>
              <button onclick="Subjects.confirmDeleteTopic(${id})"
                class="px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded border border-rose-200 transition font-medium cursor-pointer">
                Delete
              </button>
            </div>
          </div>

          <!-- Associated Resources Tabs -->
          <div class="mt-6 space-y-6">
            <!-- Materials -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-xs font-semibold uppercase tracking-wider text-[#626f86]">
                  Study Materials (${materials.length})
                </h4>
                <button onclick="App.openAddMaterialModal({ topicId: ${id} })" class="text-xs text-[#0c66e4] font-semibold hover:text-[#0055cc] cursor-pointer">
                  + Add Material
                </button>
              </div>
              ${materials.length > 0 ? `
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  ${materials.map(m => `
                    <div onclick="App.navigateTo('study-room', { id: ${m.id} })"
                      class="p-3 rounded-lg border border-[#DCDFE4] hover:border-[#0c66e4] hover:shadow-xs transition cursor-pointer flex items-center justify-between bg-[#F7F8F9] hover:bg-white">
                      <div class="truncate pr-2">
                        <span class="font-semibold text-[#172b4d] text-sm block truncate">${State.escapeHTML(m.title)}</span>
                        <span class="text-xs text-[#626f86]">${m.sections_count || 1} sections • ${m.source_type}</span>
                      </div>
                      <span class="text-xs text-[#0c66e4] font-medium shrink-0">Read</span>
                    </div>
                  `).join('')}
                </div>
              ` : '<p class="text-xs text-[#626f86] italic">No materials assigned to this topic yet.</p>'}

              ${unassignedInSubject.length > 0 && subject ? `
                <div class="mt-3 p-3 rounded-lg border border-dashed border-[#DCDFE4] bg-slate-50/70">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-semibold text-[#172b4d]">Available in ${State.escapeHTML(subject.name)} (${unassignedInSubject.length} unassigned)</span>
                    <span class="text-[11px] text-[#626f86]">Not yet assigned to a specific topic</span>
                  </div>
                  <div class="space-y-1.5">
                    ${unassignedInSubject.map(u => `
                      <div class="flex items-center justify-between p-2 rounded bg-white border border-[#DCDFE4] text-xs">
                        <div class="truncate pr-2">
                          <span class="font-medium text-[#172b4d]">${State.escapeHTML(u.title)}</span>
                          <span class="text-[#626f86] text-[11px] ml-1.5">(${u.source_type})</span>
                        </div>
                        <button onclick="Subjects.assignMaterialToTopic(${u.id}, ${id})"
                          class="px-2.5 py-1 bg-[#E9F2FF] text-[#0c66e4] hover:bg-[#d8e6fd] rounded text-xs font-semibold cursor-pointer shrink-0 transition">
                          + Link to this topic
                        </button>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>

            <!-- Notes: Saved inline and displayed then and there; opens in 35% side panel -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h4 id="topic-notes-count-header" class="text-xs font-semibold uppercase tracking-wider text-[#626f86]">
                  Personal Notes (${notes.length})
                </h4>
                <button onclick="Subjects.createNewInlineNote(${id})" class="text-xs text-[#0c66e4] font-semibold hover:text-[#0055cc] cursor-pointer">
                  + Add Note
                </button>
              </div>
              <div id="topic-notes-list">
                ${this.renderTopicNotesList(notes)}
              </div>
            </div>

            <!-- Quizzes -->
            <div class="pt-2 border-t border-[#DCDFE4]">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-xs font-semibold uppercase tracking-wider text-[#626f86]">Practice Quizzes (${quizzes.length})</h4>
                <button onclick="App.openNewQuizModal({ topicId: ${id} })" class="text-xs text-[#0c66e4] font-semibold hover:text-[#0055cc] cursor-pointer">+ New</button>
              </div>
              ${quizzes.length > 0 ? `
                <button onclick="App.navigateTo('quizzes', { topicId: ${id} })" class="w-full py-2.5 bg-blue-50 text-[#0c66e4] rounded-lg text-xs font-semibold hover:bg-blue-100 transition text-center cursor-pointer">
                  Take Practice Quiz (${quizzes.length} available)
                </button>
              ` : '<p class="text-xs text-[#626f86] italic">No quizzes created for this topic yet.</p>'}
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error("Failed to load topic details:", err);
      container.innerHTML = `<p class="p-4 text-xs text-rose-500">Could not load topic details.</p>`;
    }
  },

  renderTopicNotesList(notes) {
    if (!notes || notes.length === 0) {
      return '<p class="text-xs text-[#626f86] italic py-2">No notes here yet. Click "+ Add Note" to create one.</p>';
    }

    return `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        ${notes.map(n => {
          const isActive = this.activeInlineNoteId === n.id;
          const cleanSnippet = (n.content ? n.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '') || 'Empty note...';
          return `
            <div data-topic-note-id="${n.id}"
              onclick="Subjects.openInlineNote(${n.id})"
              class="p-3 rounded-lg border transition cursor-pointer ${isActive ? 'border-[#0c66e4] bg-[#E9F2FF] shadow-xs ring-1 ring-[#0c66e4]' : 'border-[#DCDFE4] bg-[#F7F8F9] hover:bg-white hover:border-[#0c66e4]'}">
              <div class="flex items-center justify-between">
                <h5 class="text-sm font-semibold text-[#172b4d] truncate ${isActive ? 'text-[#0c66e4]' : ''}">${State.escapeHTML(n.title)}</h5>
                <span class="text-[11px] text-[#626f86] shrink-0">${State.formatDate(n.updated_at || n.created_at)}</span>
              </div>
              <p class="text-xs text-[#44546f] mt-1 line-clamp-2">${State.escapeHTML(cleanSnippet)}</p>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  async refreshTopicNotes(topicId) {
    try {
      const notes = await API.getNotes({ topic_id: topicId });
      const listEl = document.getElementById("topic-notes-list");
      if (listEl) {
        listEl.innerHTML = this.renderTopicNotesList(notes);
      }
      const headerEl = document.getElementById("topic-notes-count-header");
      if (headerEl) {
        headerEl.textContent = `Personal Notes (${notes.length})`;
      }
    } catch (err) {
      console.warn("Failed to refresh topic notes:", err);
    }
  },

  async refreshSubjectNotes(subjectId) {
    try {
      const notes = await API.getNotes({ subject_id: subjectId });
      const listEl = document.getElementById("subject-notes-list");
      if (listEl) {
        listEl.innerHTML = this.renderTopicNotesList(notes);
      }
      const headerEl = document.getElementById("subject-notes-count-header");
      if (headerEl) {
        headerEl.textContent = `Subject Notes (${notes.length})`;
      }
    } catch (err) {
      console.warn("Failed to refresh subject notes:", err);
    }
  },

  async createNewInlineNote(topicId) {
    const subject = this.getSubjectForTopic(topicId);
    const subjectId = subject ? subject.id : null;
    try {
      const newNote = await API.createNote({
        title: "Untitled Note",
        content: "",
        topic_id: parseInt(topicId),
        subject_id: subjectId
      });
      State.toast("Created new note", "success");
      await this.refreshTopicNotes(topicId);
      await this.openInlineNote(newNote.id);
      setTimeout(() => {
        const titleInput = document.getElementById("inline-note-title");
        if (titleInput) {
          titleInput.focus();
          titleInput.select();
        }
      }, 50);
    } catch (err) {
      console.error("Failed to create inline note:", err);
      State.toast("Failed to create note", "error");
    }
  },

  async createNewInlineNoteForSubject(subjectId) {
    try {
      const newNote = await API.createNote({
        title: "Untitled Note",
        content: "",
        subject_id: parseInt(subjectId)
      });
      State.toast("Created new note", "success");
      if (this.selectedSubjectId === parseInt(subjectId)) {
        await this.refreshSubjectNotes(subjectId);
      }
      await this.openInlineNote(newNote.id);
      setTimeout(() => {
        const titleInput = document.getElementById("inline-note-title");
        if (titleInput) {
          titleInput.focus();
          titleInput.select();
        }
      }, 50);
    } catch (err) {
      console.error("Failed to create subject note:", err);
      State.toast("Failed to create note", "error");
    }
  },

  async openInlineNote(noteId) {
    if (this.activeInlineNoteId && this.activeInlineNoteId !== noteId) {
      await this.saveInlineNoteImmediately();
    }

    this.activeInlineNoteId = parseInt(noteId);

    // Shift layout: Main pane to 65%, Note sidebar to 35%
    const mainPane = document.getElementById("subjects-main-pane");
    const noteSidebar = document.getElementById("subjects-note-sidebar");
    if (mainPane && noteSidebar) {
      mainPane.classList.remove("w-full");
      mainPane.classList.add("w-full", "lg:w-[65%]", "split-active");
      noteSidebar.classList.remove("hidden");
      noteSidebar.classList.add("split-active");
    }

    // Highlight active card
    document.querySelectorAll("[data-topic-note-id]").forEach(card => {
      const cardId = parseInt(card.getAttribute("data-topic-note-id"));
      if (cardId === parseInt(noteId)) {
        card.className = "p-3 rounded-lg border transition cursor-pointer border-[#0c66e4] bg-[#E9F2FF] shadow-xs ring-1 ring-[#0c66e4]";
        const h5 = card.querySelector("h5");
        if (h5) h5.classList.add("text-[#0c66e4]");
      } else {
        card.className = "p-3 rounded-lg border border-[#DCDFE4] bg-[#F7F8F9] hover:bg-white hover:border-[#0c66e4] transition cursor-pointer";
        const h5 = card.querySelector("h5");
        if (h5) h5.classList.remove("text-[#0c66e4]");
      }
    });

    const editorContainer = document.getElementById("subjects-note-editor-container");
    if (!editorContainer) return;

    editorContainer.innerHTML = `
      <div class="p-8 text-center text-[#626f86] text-xs">
        Loading note...
      </div>
    `;

    try {
      const note = await API.getNote(noteId);
      this.renderInlineNoteEditor(note);
    } catch (err) {
      console.error("Failed to load note:", err);
      editorContainer.innerHTML = `
        <div class="p-6 text-center text-rose-500 text-xs">
          Failed to load note.
          <button onclick="Subjects.closeInlineNote()" class="block mx-auto mt-2 text-[#0c66e4] underline cursor-pointer">Close</button>
        </div>
      `;
    }
  },

  async closeInlineNote() {
    if (this.activeInlineNoteId) {
      const titleInput = document.getElementById("inline-note-title");
      const contentEditor = document.getElementById("inline-note-content");
      const title = titleInput ? titleInput.value.trim() : "";
      const rawContent = contentEditor ? contentEditor.innerHTML.replace(/<[^>]*>/g, '').trim() : "";

      // If user opened a note but left it completely blank and untitled, discard rather than saving a dummy note
      if ((!title || title === "Untitled Note") && !rawContent) {
        try {
          await API.deleteNote(this.activeInlineNoteId);
          if (this.selectedTopic) await this.refreshTopicNotes(this.selectedTopic.id);
          if (this.selectedSubjectId) await this.refreshSubjectNotes(this.selectedSubjectId);
        } catch (e) {}
      } else {
        await this.saveInlineNoteImmediately();
      }
    }

    this.activeInlineNoteId = null;

    // Restore layout: Main pane to 100%, Note sidebar hidden
    const mainPane = document.getElementById("subjects-main-pane");
    const noteSidebar = document.getElementById("subjects-note-sidebar");
    if (mainPane && noteSidebar) {
      mainPane.classList.remove("lg:w-[65%]", "split-active");
      mainPane.classList.add("w-full");
      noteSidebar.classList.add("hidden");
      noteSidebar.classList.remove("split-active");
    }

    // Reset card highlight
    document.querySelectorAll("[data-topic-note-id]").forEach(card => {
      card.className = "p-3 rounded-lg border border-[#DCDFE4] bg-[#F7F8F9] hover:bg-white hover:border-[#0c66e4] transition cursor-pointer";
      const h5 = card.querySelector("h5");
      if (h5) h5.classList.remove("text-[#0c66e4]");
    });
  },

  renderInlineNoteEditor(note) {
    const editorContainer = document.getElementById("subjects-note-editor-container");
    if (!editorContainer) return;

    // Resolve context labels
    let subjectName = note.subject_name;
    let topicName = note.topic_name;
    if (!subjectName && note.topic_id) {
      const sub = this.getSubjectForTopic(note.topic_id);
      if (sub) subjectName = sub.name;
    }
    if (!topicName && note.topic_id) {
      const top = this.getTopicById(note.topic_id);
      if (top) topicName = top.name;
    }
    if (!subjectName && note.subject_id) {
      const sub = this.getSubjectById(note.subject_id);
      if (sub) subjectName = sub.name;
    }

    editorContainer.innerHTML = `
      <!-- Top Title Bar -->
      <div class="p-3.5 border-b border-[#DCDFE4] flex items-center justify-between bg-white gap-2">
        <div class="flex-1 min-w-0">
          <input id="inline-note-title" type="text" value="${State.escapeHTML(note.title)}"
            oninput="Subjects.scheduleInlineAutosave()"
            placeholder="Note title..."
            class="text-base font-semibold text-[#172b4d] border-0 focus:ring-0 p-0 w-full focus:outline-none truncate">
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span id="inline-note-autosave-indicator" class="text-xs text-[#626f86]">Saved</span>
          <button onclick="Subjects.confirmDeleteInlineNote(${note.id})" title="Delete note"
            class="p-1 text-[#626f86] hover:text-rose-600 rounded transition cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
          <button onclick="Subjects.closeInlineNote()" title="Close note"
            class="p-1 text-[#626f86] hover:text-[#172b4d] rounded hover:bg-[#F1F2F4] transition cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <!-- Context Tag / Hierarchy Location -->
      <div class="px-3.5 py-1.5 bg-[#F7F8F9] border-b border-[#DCDFE4] flex items-center justify-between text-xs text-[#626f86]">
        <div class="flex items-center gap-1.5 truncate">
          <span class="w-2 h-2 rounded-full bg-[#0c66e4] shrink-0"></span>
          <span class="font-medium text-[#172b4d] truncate">${State.escapeHTML(subjectName || 'General')}</span>
          ${topicName ? `<span class="text-[#626f86]">›</span><span class="truncate font-medium text-[#44546f]">${State.escapeHTML(topicName)}</span>` : ''}
        </div>
        <span class="text-[11px] text-[#626f86] shrink-0">${State.formatDate(note.updated_at || note.created_at)}</span>
      </div>

      <!-- Rich Formatting Controls: Font Size & Color Options -->
      <div class="px-3.5 py-2 border-b border-[#DCDFE4] bg-[#F7F8F9] flex flex-wrap items-center gap-2.5 text-xs">
        <!-- Font Size Selector -->
        <div class="flex items-center gap-1">
          <label class="text-xs font-semibold text-[#626f86]">Size:</label>
          <select id="inline-note-font-size-select" onchange="Subjects.changeInlineFontSize(this.value)"
            class="p-1 rounded border border-[#DCDFE4] text-xs bg-white text-[#172b4d] focus:outline-[#0c66e4] cursor-pointer">
            <option value="12px">12px</option>
            <option value="14px" selected>14px</option>
            <option value="16px">16px</option>
            <option value="18px">18px</option>
            <option value="22px">22px</option>
          </select>
        </div>

        <div class="h-3.5 w-px bg-[#DCDFE4]"></div>

        <!-- Font Color Options -->
        <div class="flex items-center gap-1">
          <label class="text-xs font-semibold text-[#626f86]">Color:</label>
          <div class="flex items-center gap-1">
            <button onclick="Subjects.changeInlineColor('#172b4d')" title="Charcoal" class="w-4 h-4 rounded-full border border-slate-300 bg-[#172b4d] hover:scale-110 transition cursor-pointer"></button>
            <button onclick="Subjects.changeInlineColor('#0c66e4')" title="Blue" class="w-4 h-4 rounded-full border border-slate-300 bg-[#0c66e4] hover:scale-110 transition cursor-pointer"></button>
            <button onclick="Subjects.changeInlineColor('#059669')" title="Green" class="w-4 h-4 rounded-full border border-slate-300 bg-emerald-600 hover:scale-110 transition cursor-pointer"></button>
            <button onclick="Subjects.changeInlineColor('#7c3aed')" title="Purple" class="w-4 h-4 rounded-full border border-slate-300 bg-purple-600 hover:scale-110 transition cursor-pointer"></button>
            <button onclick="Subjects.changeInlineColor('#e11d48')" title="Red" class="w-4 h-4 rounded-full border border-slate-300 bg-rose-600 hover:scale-110 transition cursor-pointer"></button>
            <button onclick="Subjects.changeInlineColor('#d97706')" title="Amber" class="w-4 h-4 rounded-full border border-slate-300 bg-amber-600 hover:scale-110 transition cursor-pointer"></button>
            <input type="color" id="inline-note-custom-color" value="#172b4d" onchange="Subjects.changeInlineColor(this.value)" title="Custom Color"
              class="w-4 h-4 p-0 rounded-full border border-slate-300 cursor-pointer overflow-hidden">
          </div>
        </div>

        <div class="h-3.5 w-px bg-[#DCDFE4]"></div>

        <!-- Basic Styling Helpers -->
        <div class="flex items-center gap-1">
          <button onclick="Subjects.formatInlineText('bold')" title="Bold" class="px-1.5 py-0.5 rounded hover:bg-[#F1F2F4] font-bold text-[#172b4d] text-xs cursor-pointer">B</button>
          <button onclick="Subjects.formatInlineText('italic')" title="Italic" class="px-1.5 py-0.5 rounded hover:bg-[#F1F2F4] italic font-serif text-[#172b4d] text-xs cursor-pointer">I</button>
          <button onclick="Subjects.formatInlineText('underline')" title="Underline" class="px-1.5 py-0.5 rounded hover:bg-[#F1F2F4] underline text-[#172b4d] text-xs cursor-pointer">U</button>
          <button onclick="Subjects.formatInlineText('insertUnorderedList')" title="Bullet List" class="px-1.5 py-0.5 rounded hover:bg-[#F1F2F4] text-[#172b4d] text-xs cursor-pointer">• List</button>
        </div>
      </div>

      <!-- Rich Editable Note Area -->
      <div class="p-4 flex-1 flex flex-col bg-white overflow-y-auto max-h-[calc(100vh-17rem)]">
        <div id="inline-note-content" contenteditable="true"
          placeholder="Start typing your note here..."
          oninput="Subjects.scheduleInlineAutosave()"
          style="font-size: 14px; color: #172b4d;"
          class="note-rich-editor flex-1 w-full focus:outline-none leading-relaxed min-h-[300px] text-xs">${note.content || ''}</div>
      </div>

      <!-- Bottom Action Bar -->
      <div class="p-3 border-t border-[#DCDFE4] bg-[#F7F8F9] flex items-center justify-between">
        <button onclick="Subjects.closeInlineNote()"
          class="px-3 py-1.5 border border-[#DCDFE4] rounded-lg text-xs font-medium text-[#172b4d] hover:bg-[#F1F2F4] transition cursor-pointer">
          Close
        </button>
        <button onclick="Subjects.saveInlineNoteImmediately()"
          class="px-3.5 py-1.5 bg-[#0c66e4] text-white rounded-lg text-xs font-semibold hover:bg-[#0055cc] transition cursor-pointer">
          Save Note
        </button>
      </div>
    `;
  },

  scheduleInlineAutosave() {
    const indicator = document.getElementById("inline-note-autosave-indicator");
    if (indicator) indicator.textContent = "Saving...";

    clearTimeout(this.inlineAutosaveTimer);
    this.inlineAutosaveTimer = setTimeout(() => {
      this.saveInlineNoteImmediately();
    }, 1000);
  },

  async saveInlineNoteImmediately() {
    if (!this.activeInlineNoteId) return;
    const noteId = this.activeInlineNoteId;
    const title = document.getElementById("inline-note-title")?.value.trim() || "Untitled Note";
    const content = document.getElementById("inline-note-content")?.innerHTML || "";
    const indicator = document.getElementById("inline-note-autosave-indicator");

    try {
      await API.updateNote(noteId, { title, content });
      if (indicator) indicator.textContent = "Saved";

      // Live update note card in left pane
      const card = document.querySelector(`[data-topic-note-id="${noteId}"]`);
      if (card) {
        const h5 = card.querySelector("h5");
        if (h5) h5.textContent = title;
        const p = card.querySelector("p");
        if (p) {
          const cleanSnippet = (content ? content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '') || 'Empty note...';
          p.textContent = cleanSnippet;
        }
      }
    } catch (err) {
      console.warn("Inline autosave failed:", err);
      if (indicator) indicator.textContent = "Save failed";
    }
  },

  confirmDeleteInlineNote(noteId) {
    if (confirm("Are you sure you want to delete this note?")) {
      this.deleteInlineNote(noteId);
    }
  },

  async deleteInlineNote(noteId) {
    try {
      await API.deleteNote(noteId);
      State.toast("Note deleted", "info");
      this.activeInlineNoteId = null;

      // Close sidebar and restore 100% width
      const mainPane = document.getElementById("subjects-main-pane");
      const noteSidebar = document.getElementById("subjects-note-sidebar");
      if (mainPane && noteSidebar) {
        mainPane.classList.remove("lg:w-[65%]");
        mainPane.classList.add("w-full");
        noteSidebar.classList.add("hidden");
      }

      // Refresh list
      if (this.selectedTopic) {
        await this.refreshTopicNotes(this.selectedTopic.id);
      } else if (this.selectedSubjectId) {
        await this.refreshSubjectNotes(this.selectedSubjectId);
      }
    } catch (err) {
      console.error("Failed to delete inline note:", err);
      State.toast("Failed to delete note", "error");
    }
  },

  changeInlineFontSize(size) {
    this.currentInlineFontSize = size;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const span = document.createElement("span");
      span.style.fontSize = size;
      span.appendChild(range.extractContents());
      range.insertNode(span);
    } else {
      const editor = document.getElementById("inline-note-content");
      if (editor) editor.style.fontSize = size;
    }
    this.scheduleInlineAutosave();
  },

  changeInlineColor(color) {
    this.currentInlineColor = color;
    const customPicker = document.getElementById("inline-note-custom-color");
    if (customPicker) customPicker.value = color;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      document.execCommand("styleWithCSS", false, true);
      document.execCommand("foreColor", false, color);
    } else {
      const editor = document.getElementById("inline-note-content");
      if (editor) editor.style.color = color;
    }
    this.scheduleInlineAutosave();
  },

  formatInlineText(command) {
    document.execCommand(command, false, null);
    this.scheduleInlineAutosave();
  },

  renderEmptyTopicDetail() {
    const container = document.getElementById("topic-detail-container");
    if (!container) return;
    container.innerHTML = `
      <div class="p-12 text-center bg-white rounded-xl border border-[#DCDFE4]">
        <h4 class="text-base font-semibold text-[#172b4d]">Select a Subject or Topic from the hierarchy</h4>
        <p class="text-xs text-[#626f86] mt-1 max-w-sm mx-auto">
          Choose any subject or topic to view its organized study materials, personal notes, and practice quizzes.
        </p>
      </div>
    `;
  },

  async toggleTopicComplete(topicId) {
    try {
      const res = await API.toggleTopicComplete(topicId);
      State.toast(res.data.is_completed ? "Topic marked complete!" : "Topic marked incomplete", "success");
      await this.load({ topicId });
    } catch (err) {
      State.toast("Failed to update topic status", "error");
    }
  },

  async assignMaterialToTopic(materialId, topicId) {
    try {
      const topicInfo = State.getTopicDetails(topicId);
      await API.updateMaterial(materialId, {
        topic_id: parseInt(topicId),
        chapter_id: topicInfo ? topicInfo.chapterId : undefined,
        subject_id: topicInfo ? topicInfo.subjectId : undefined
      });
      State.toast("Material linked to topic successfully!", "success");
      const tree = await API.getSubjects();
      State.setSubjects(tree);
      this.tree = tree;
      this.renderTree();
      this.selectTopicById(topicId);
      if (typeof Library !== "undefined") Library.applyFilters();
    } catch (err) {
      State.toast("Failed to link material", "error");
    }
  },

  // Modal openers
  openAddSubjectModal() {
    const modal = document.getElementById("create-subject-modal");
    if (modal) modal.classList.remove("hidden");
  },
  openEditSubjectModal(id, name, desc, color) {
    const modal = document.getElementById("edit-subject-modal");
    if (!modal) return;
    document.getElementById("edit-subject-id").value = id;
    document.getElementById("edit-subject-name").value = name;
    document.getElementById("edit-subject-desc").value = desc || "";
    document.getElementById("edit-subject-color").value = color || "#3B82F6";
    modal.classList.remove("hidden");
  },
  openAddChapterModal(subjectId) {
    const modal = document.getElementById("create-chapter-modal");
    if (!modal) return;
    document.getElementById("create-chapter-subject-id").value = subjectId;
    modal.classList.remove("hidden");
  },
  openEditChapterModal(id, name, desc) {
    const modal = document.getElementById("edit-chapter-modal");
    if (!modal) return;
    document.getElementById("edit-chapter-id").value = id;
    document.getElementById("edit-chapter-name").value = name;
    document.getElementById("edit-chapter-desc").value = desc || "";
    modal.classList.remove("hidden");
  },
  openAddTopicModal(chapterId) {
    const modal = document.getElementById("create-topic-modal");
    if (!modal) return;
    document.getElementById("create-topic-chapter-id").value = chapterId;
    modal.classList.remove("hidden");
  },

  // Safe Deletions
  confirmDeleteSubject(id) {
    const modal = document.getElementById("safe-delete-modal");
    if (!modal) return;
    document.getElementById("safe-delete-entity-type").value = "subject";
    document.getElementById("safe-delete-entity-id").value = id;
    document.getElementById("safe-delete-prompt-text").textContent =
      "Are you sure you want to delete this Subject? Deleting a folder will not delete your materials unless you choose 'Delete Everything'.";
    modal.classList.remove("hidden");
  },

  confirmDeleteChapter(id) {
    const modal = document.getElementById("safe-delete-modal");
    if (!modal) return;
    document.getElementById("safe-delete-entity-type").value = "chapter";
    document.getElementById("safe-delete-entity-id").value = id;
    document.getElementById("safe-delete-prompt-text").textContent =
      "Are you sure you want to delete this Chapter? You can choose to keep its materials unassigned or delete them.";
    modal.classList.remove("hidden");
  },

  confirmDeleteTopic(id) {
    const modal = document.getElementById("safe-delete-modal");
    if (!modal) return;
    document.getElementById("safe-delete-entity-type").value = "topic";
    document.getElementById("safe-delete-entity-id").value = id;
    document.getElementById("safe-delete-prompt-text").textContent =
      "Are you sure you want to delete this Topic? Materials assigned to this topic can be safely kept in your library.";
    modal.classList.remove("hidden");
  },

  async executeSafeDelete(action) {
    const type = document.getElementById("safe-delete-entity-type").value;
    const id = document.getElementById("safe-delete-entity-id").value;
    try {
      if (type === "subject") await API.deleteSubject(id, action);
      else if (type === "chapter") await API.deleteChapter(id, action);
      else if (type === "topic") await API.deleteTopic(id, action);

      State.toast(`${type} deleted successfully`, "info");
      document.getElementById("safe-delete-modal").classList.add("hidden");
      this.selectedTopic = null;
      this.selectedSubjectId = null;
      await this.load();
    } catch (err) {
      State.toast(err.message || "Failed to delete item", "error");
    }
  }
};
