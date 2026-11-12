/**
 * StudySpace Calendar & Important Dates Controller
 * Interactive monthly calendar, milestone agenda, event scheduling (exams, deadlines, revision).
 * Supports linking events to Subjects and Topics.
 * Completely emoji-free with Jira / Atlassian design system.
 */
const CalendarView = {
  currentDate: new Date(),
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(), // 0-indexed (0 = Jan, 10 = Nov)
  selectedDate: new Date().toISOString().split("T")[0], // YYYY-MM-DD
  categoryFilter: "all",
  subjectFilter: "",
  events: [],
  editingEventId: null,

  CATEGORY_CONFIG: {
    exam: { label: "Exam", bg: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
    deadline: { label: "Deadline", bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
    assignment: { label: "Assignment", bg: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },
    milestone: { label: "Milestone", bg: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
    revision: { label: "Revision", bg: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
    event: { label: "Event", bg: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-500" }
  },

  MONTH_NAMES: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ],

  async load(params = {}) {
    if (params.date) {
      this.selectedDate = params.date;
      const parsed = new Date(params.date);
      if (!isNaN(parsed.getTime())) {
        this.currentYear = parsed.getFullYear();
        this.currentMonth = parsed.getMonth();
      }
    } else {
      const todayStr = this.formatDate(new Date());
      this.selectedDate = todayStr;
    }

    if (params.category) {
      this.categoryFilter = params.category;
    }

    if (params.subjectId) {
      this.subjectFilter = String(params.subjectId);
    }

    await this.fetchSubjects();
    await this.fetchEvents();
  },

  formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },

  async fetchSubjects() {
    try {
      if (!State.subjectsTree || State.subjectsTree.length === 0) {
        const tree = await API.getSubjects();
        State.setSubjects(tree);
      }
      this.renderSubjectFilterOptions();
    } catch (err) {
      console.warn("Could not load subjects for calendar:", err);
    }
  },

  renderSubjectFilterOptions() {
    const filterEl = document.getElementById("cal-filter-subject");
    if (!filterEl) return;

    const subjects = State.subjectsTree || [];
    let html = `<option value="">All Subjects</option>`;
    subjects.forEach(s => {
      const isSel = this.subjectFilter && String(s.id) === String(this.subjectFilter) ? "selected" : "";
      html += `<option value="${s.id}" ${isSel}>${this.escapeHtml(s.name)}</option>`;
    });
    filterEl.innerHTML = html;
  },

  setSubjectFilter(subjectId) {
    this.subjectFilter = subjectId || "";
    this.fetchEvents();
  },

  async fetchEvents() {
    try {
      const params = {};
      if (this.categoryFilter && this.categoryFilter !== "all") {
        params.category = this.categoryFilter;
      }
      if (this.subjectFilter) {
        params.subject_id = parseInt(this.subjectFilter);
      }
      this.events = await API.getCalendarEvents(params);
      this.render();
    } catch (err) {
      console.error("Failed to fetch calendar events:", err);
      this.events = [];
      this.render();
    }
  },

  prevMonth() {
    this.currentMonth--;
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    }
    this.render();
  },

  nextMonth() {
    this.currentMonth++;
    if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    }
    this.render();
  },

  goToToday() {
    const today = new Date();
    this.currentYear = today.getFullYear();
    this.currentMonth = today.getMonth();
    this.selectedDate = this.formatDate(today);
    this.render();
  },

  selectDate(dateStr) {
    this.selectedDate = dateStr;
    this.renderDateSelection();
    this.renderAgenda();
  },

  setFilter(category) {
    this.categoryFilter = category;
    document.querySelectorAll(".cal-filter-btn").forEach(btn => {
      if (btn.getAttribute("data-cat") === category) {
        btn.className = "cal-filter-btn px-2.5 py-1 text-xs font-semibold rounded-md bg-[#0c66e4] text-white transition cursor-pointer";
      } else {
        btn.className = "cal-filter-btn px-2.5 py-1 text-xs font-medium rounded-md bg-transparent text-[#44546f] hover:text-[#172b4d] hover:bg-[#e9f2ff] transition cursor-pointer";
      }
    });
    this.fetchEvents();
  },

  render() {
    this.renderHeader();
    this.renderMonthGrid();
    this.renderAgenda();
    this.renderUpcoming();
  },

  renderHeader() {
    const titleEl = document.getElementById("calendar-month-title");
    if (titleEl) {
      titleEl.textContent = `${this.MONTH_NAMES[this.currentMonth]} ${this.currentYear}`;
    }
  },

  renderMonthGrid() {
    const gridEl = document.getElementById("calendar-grid-cells");
    if (!gridEl) return;

    const firstDayIndex = new Date(this.currentYear, this.currentMonth, 1).getDay(); // 0 = Sunday
    const daysInCurrentMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();

    const todayStr = this.formatDate(new Date());

    let html = "";

    // 1. Previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = this.currentMonth === 0 ? 11 : this.currentMonth - 1;
      const prevYear = this.currentMonth === 0 ? this.currentYear - 1 : this.currentYear;
      const dStr = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      html += this.buildDayCell(dStr, dayNum, false, todayStr);
    }

    // 2. Current month days
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const dStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      html += this.buildDayCell(dStr, day, true, todayStr);
    }

    // 3. Next month leading days
    const totalFilled = firstDayIndex + daysInCurrentMonth;
    const remainder = totalFilled % 7 === 0 ? 0 : 7 - (totalFilled % 7);
    for (let day = 1; day <= remainder; day++) {
      const nextMonth = this.currentMonth === 11 ? 0 : this.currentMonth + 1;
      const nextYear = this.currentMonth === 11 ? this.currentYear + 1 : this.currentYear;
      const dStr = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      html += this.buildDayCell(dStr, day, false, todayStr);
    }

    gridEl.innerHTML = html;
  },

  buildDayCell(dateStr, dayNumber, isCurrentMonth, todayStr) {
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === this.selectedDate;
    const dayEvents = this.events.filter(e => e.event_date === dateStr);

    let cellClass = "min-h-[85px] sm:min-h-[100px] p-1.5 sm:p-2 border border-[#f1f2f4] transition relative flex flex-col justify-between cursor-pointer group ";
    if (!isCurrentMonth) {
      cellClass += "bg-[#fafbfc] text-[#8993a4] opacity-60 ";
    } else {
      cellClass += "bg-white hover:bg-[#f7f8f9] text-[#172b4d] ";
    }

    if (isSelected) {
      cellClass += "ring-2 ring-[#0c66e4] ring-inset z-10 ";
    }

    let dateBadgeClass = "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ";
    if (isToday) {
      dateBadgeClass += "bg-[#0c66e4] text-white ";
    } else {
      dateBadgeClass += "text-[#44546f] group-hover:text-[#172b4d] ";
    }

    let eventsHtml = '<div class="space-y-1 mt-1 overflow-hidden">';
    dayEvents.slice(0, 2).forEach(ev => {
      const cfg = this.CATEGORY_CONFIG[ev.category] || this.CATEGORY_CONFIG.event;
      const completedStyle = ev.is_completed ? "line-through opacity-50" : "";
      eventsHtml += `
        <div class="truncate text-[11px] font-medium px-1.5 py-0.5 rounded border ${cfg.bg} ${completedStyle}" title="${this.escapeHtml(ev.title)}">
          ${ev.priority === 'urgent' ? '<span class="text-red-600 font-bold mr-0.5">!</span>' : ''}${this.escapeHtml(ev.title)}
        </div>
      `;
    });
    if (dayEvents.length > 2) {
      eventsHtml += `
        <div class="text-[10px] text-[#626f86] font-semibold pl-1">
          +${dayEvents.length - 2} more
        </div>
      `;
    }
    eventsHtml += '</div>';

    return `
      <div class="${cellClass}" onclick="CalendarView.selectDate('${dateStr}')" ondblclick="CalendarView.openEventModal('${dateStr}')">
        <div class="flex items-center justify-between">
          <span class="${dateBadgeClass}">${dayNumber}</span>
          ${dayEvents.length > 0 ? `<span class="w-1.5 h-1.5 rounded-full bg-[#0c66e4]"></span>` : ''}
        </div>
        ${eventsHtml}
      </div>
    `;
  },

  renderDateSelection() {
    this.renderMonthGrid();
  },

  renderAgenda() {
    const agendaContainer = document.getElementById("calendar-selected-agenda");
    const agendaHeader = document.getElementById("calendar-agenda-date-label");
    if (!agendaContainer) return;

    if (agendaHeader) {
      const d = new Date(this.selectedDate + "T00:00:00");
      const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
      agendaHeader.textContent = isNaN(d.getTime()) ? this.selectedDate : d.toLocaleDateString(undefined, options);
    }

    const dayEvents = this.events.filter(e => e.event_date === this.selectedDate);

    if (dayEvents.length === 0) {
      agendaContainer.innerHTML = `
        <div class="py-8 text-center text-[#626f86]">
          <svg class="w-8 h-8 mx-auto text-[#a5b4fc] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="1.5"></rect>
            <line x1="16" y1="2" x2="16" y2="6" stroke-width="1.5" stroke-linecap="round"></line>
            <line x1="8" y1="2" x2="8" y2="6" stroke-width="1.5" stroke-linecap="round"></line>
            <line x1="3" y1="10" x2="21" y2="10" stroke-width="1.5"></line>
          </svg>
          <p class="text-xs font-medium">No events or deadlines on this date.</p>
          <button onclick="CalendarView.openEventModal('${this.selectedDate}')" class="mt-2 text-xs font-semibold text-[#0c66e4] hover:underline cursor-pointer">
            + Schedule an event
          </button>
        </div>
      `;
      return;
    }

    let html = `<div class="space-y-2.5">`;
    dayEvents.forEach(ev => {
      const cfg = this.CATEGORY_CONFIG[ev.category] || this.CATEGORY_CONFIG.event;
      const isCompleted = ev.is_completed;
      const priorityBadge = ev.priority === "urgent"
        ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">Urgent</span>`
        : (ev.priority === "high" ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">High</span>` : "");

      html += `
        <div class="p-3 rounded-lg border border-[#dcdfe4] bg-white hover:border-[#85b8ff] transition shadow-2xs flex flex-col gap-2 ${isCompleted ? 'opacity-60 bg-[#fbfcfd]' : ''}">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-start gap-2.5">
              <input type="checkbox" ${isCompleted ? 'checked' : ''}
                onchange="CalendarView.toggleEventComplete(${ev.id}, ${isCompleted})"
                class="mt-1 w-4 h-4 rounded text-[#0c66e4] focus:ring-[#0c66e4] border-[#dcdfe4] cursor-pointer"
                title="Mark as done"
              />
              <div>
                <h4 class="text-sm font-semibold text-[#172b4d] ${isCompleted ? 'line-through text-[#626f86]' : ''}">${this.escapeHtml(ev.title)}</h4>
                <div class="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs">
                  <span class="px-2 py-0.5 rounded text-[11px] font-semibold border ${cfg.bg}">${cfg.label}</span>
                  ${priorityBadge}
                  ${ev.event_time ? `<span class="text-[#626f86] font-medium">${ev.event_time}</span>` : ''}
                  ${ev.subject_name ? `
                    <span onclick="App.navigateTo('subjects', { subjectId: ${ev.subject_id} })"
                      class="inline-flex items-center gap-1 text-[#0c66e4] hover:text-[#0055cc] hover:underline font-semibold text-[11px] bg-[#e9f2ff] px-2 py-0.5 rounded cursor-pointer"
                      title="Open Subject">
                      <span class="w-1.5 h-1.5 rounded-full bg-[#0c66e4]"></span>
                      ${this.escapeHtml(ev.subject_name)}${ev.topic_name ? ' • ' + this.escapeHtml(ev.topic_name) : ''}
                    </span>` : ''}
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button onclick="CalendarView.openEventModal(null, ${ev.id})" class="p-1 rounded text-[#626f86] hover:text-[#172b4d] hover:bg-[#f1f2f4] transition cursor-pointer" title="Edit event">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
              </button>
              <button onclick="CalendarView.deleteEvent(${ev.id})" class="p-1 rounded text-[#626f86] hover:text-red-600 hover:bg-red-50 transition cursor-pointer" title="Delete event">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </div>
          ${ev.description ? `<p class="text-xs text-[#44546f] mt-1 pl-6 leading-relaxed bg-[#f7f8f9] p-2 rounded">${this.escapeHtml(ev.description)}</p>` : ''}
        </div>
      `;
    });
    html += `</div>`;

    agendaContainer.innerHTML = html;
  },

  renderUpcoming() {
    const upcomingContainer = document.getElementById("calendar-upcoming-list");
    if (!upcomingContainer) return;

    const todayStr = this.formatDate(new Date());
    const upcoming = this.events
      .filter(e => !e.is_completed && e.event_date >= todayStr)
      .slice(0, 5);

    if (upcoming.length === 0) {
      upcomingContainer.innerHTML = `
        <div class="py-4 text-center text-xs text-[#626f86]">
          No upcoming events in the schedule.
        </div>
      `;
      return;
    }

    let html = `<div class="space-y-2">`;
    upcoming.forEach(ev => {
      const cfg = this.CATEGORY_CONFIG[ev.category] || this.CATEGORY_CONFIG.event;
      const countdown = this.getCountdownLabel(ev.event_date);

      html += `
        <div onclick="CalendarView.selectDate('${ev.event_date}')" class="p-2.5 rounded-lg border border-[#f1f2f4] bg-white hover:bg-[#f7f8f9] hover:border-[#dcdfe4] transition cursor-pointer flex items-center justify-between gap-3">
          <div class="min-w-0">
            <h5 class="text-xs font-semibold text-[#172b4d] truncate">${this.escapeHtml(ev.title)}</h5>
            <div class="flex items-center gap-2 mt-0.5 text-[11px] text-[#626f86]">
              <span class="inline-block w-2 h-2 rounded-full ${cfg.dot}"></span>
              <span>${ev.event_date}</span>
              ${ev.event_time ? `<span>• ${ev.event_time}</span>` : ''}
              ${ev.subject_name ? `<span class="truncate">• ${this.escapeHtml(ev.subject_name)}</span>` : ''}
            </div>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${countdown.cls}">
            ${countdown.text}
          </span>
        </div>
      `;
    });
    html += `</div>`;

    upcomingContainer.innerHTML = html;
  },

  getCountdownLabel(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + "T00:00:00");
    const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return { text: "Today", cls: "bg-red-100 text-red-700" };
    } else if (diffDays === 1) {
      return { text: "Tomorrow", cls: "bg-amber-100 text-amber-700" };
    } else if (diffDays > 1 && diffDays <= 7) {
      return { text: `In ${diffDays} days`, cls: "bg-blue-100 text-blue-700" };
    } else if (diffDays > 7) {
      return { text: `In ${Math.ceil(diffDays / 7)}w`, cls: "bg-slate-100 text-slate-600" };
    } else {
      return { text: `${Math.abs(diffDays)}d overdue`, cls: "bg-rose-100 text-rose-800" };
    }
  },

  // ---------------- Event Modal Management ----------------
  async openEventModal(dateStr = null, eventId = null) {
    this.editingEventId = eventId;
    const modal = document.getElementById("calendar-event-modal");
    const modalTitle = document.getElementById("calendar-modal-title");
    const titleInput = document.getElementById("cal-input-title");
    const dateInput = document.getElementById("cal-input-date");
    const timeInput = document.getElementById("cal-input-time");
    const catSelect = document.getElementById("cal-input-category");
    const prioritySelect = document.getElementById("cal-input-priority");
    const descInput = document.getElementById("cal-input-description");

    if (!modal) return;

    // Ensure subjects are loaded in memory for search
    if (!State.subjectsTree || State.subjectsTree.length === 0) {
      await this.fetchSubjects();
    }

    let targetSubjectId = null;
    let targetSubjectName = null;
    let targetTopicId = null;
    let targetTopicName = null;

    if (eventId) {
      const ev = this.events.find(e => e.id === eventId);
      if (ev) {
        if (modalTitle) modalTitle.textContent = "Edit Event / Important Date";
        if (titleInput) titleInput.value = ev.title;
        if (dateInput) dateInput.value = ev.event_date;
        if (timeInput) timeInput.value = ev.event_time || "";
        if (catSelect) catSelect.value = ev.category || "event";
        if (prioritySelect) prioritySelect.value = ev.priority || "normal";
        if (descInput) descInput.value = ev.description || "";
        targetSubjectId = ev.subject_id;
        targetSubjectName = ev.subject_name;
        targetTopicId = ev.topic_id;
        targetTopicName = ev.topic_name;
      }
    } else {
      if (modalTitle) modalTitle.textContent = "Mark Event / Important Date";
      if (titleInput) titleInput.value = "";
      if (dateInput) dateInput.value = dateStr || this.selectedDate || this.formatDate(new Date());
      if (timeInput) timeInput.value = "";
      if (catSelect) catSelect.value = "event";
      if (prioritySelect) prioritySelect.value = "normal";
      if (descInput) descInput.value = "";
    }

    // Initialize search pickers
    this.initLinkedPickers(targetSubjectId, targetSubjectName, targetTopicId, targetTopicName);

    modal.classList.remove("hidden");
    if (titleInput) titleInput.focus();
  },

  initLinkedPickers(subjectId, subjectName, topicId, topicName) {
    if (subjectId && subjectName) {
      this.selectSubject(subjectId, subjectName);
    } else if (subjectId) {
      // Find subject name in tree
      const s = (State.subjectsTree || []).find(sub => sub.id === parseInt(subjectId));
      this.selectSubject(subjectId, s ? s.name : `Subject #${subjectId}`);
    } else {
      this.clearSubject();
    }

    if (topicId && topicName) {
      this.selectTopic(topicId, topicName, subjectId, subjectName);
    } else if (topicId) {
      let tName = `Topic #${topicId}`;
      let pSubId = subjectId;
      let pSubName = subjectName;
      (State.subjectsTree || []).forEach(sub => {
        (sub.chapters || []).forEach(chap => {
          (chap.topics || []).forEach(t => {
            if (t.id === parseInt(topicId)) {
              tName = t.name;
              pSubId = sub.id;
              pSubName = sub.name;
            }
          });
        });
      });
      this.selectTopic(topicId, tName, pSubId, pSubName);
    } else {
      this.clearTopic();
    }
  },

  onSearchSubject(query) {
    const resultsEl = document.getElementById("cal-subject-search-results");
    if (!resultsEl) return;

    const q = (query || "").trim().toLowerCase();
    const subjects = State.subjectsTree || [];

    const matches = subjects.filter(s => !q || s.name.toLowerCase().includes(q));

    if (matches.length === 0) {
      resultsEl.innerHTML = `
        <div class="p-3 text-xs text-[#626f86] text-center">
          No subjects found matching "${this.escapeHtml(query)}"
        </div>
      `;
      resultsEl.classList.remove("hidden");
      return;
    }

    let html = `<div class="py-1">`;
    matches.forEach(s => {
      const chapCount = s.chapters ? s.chapters.length : 0;
      let topCount = 0;
      if (s.chapters) {
        s.chapters.forEach(c => topCount += (c.topics ? c.topics.length : 0));
      }
      html += `
        <div onclick="CalendarView.selectSubject(${s.id}, '${this.escapeJs(s.name)}')"
          class="px-3 py-2 text-xs text-[#172b4d] hover:bg-[#e9f2ff] hover:text-[#0c66e4] cursor-pointer flex items-center justify-between border-b border-[#f1f2f4] last:border-b-0 transition">
          <div class="flex items-center gap-2 truncate">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${s.color || '#0c66e4'}"></span>
            <span class="font-semibold truncate">${this.escapeHtml(s.name)}</span>
          </div>
          <span class="text-[10px] text-[#626f86] font-medium shrink-0 ml-2">${chapCount} ch • ${topCount} top</span>
        </div>
      `;
    });
    html += `</div>`;

    resultsEl.innerHTML = html;
    resultsEl.classList.remove("hidden");
  },

  selectSubject(id, name) {
    const hiddenInput = document.getElementById("cal-selected-subject-id");
    const searchContainer = document.getElementById("cal-subject-search-container");
    const chipContainer = document.getElementById("cal-subject-selected-chip");
    const resultsEl = document.getElementById("cal-subject-search-results");

    if (hiddenInput) hiddenInput.value = id;
    if (resultsEl) resultsEl.classList.add("hidden");

    if (chipContainer && searchContainer) {
      chipContainer.innerHTML = `
        <div class="flex items-center justify-between p-2 rounded-lg bg-[#e9f2ff] border border-[#85b8ff] text-xs font-semibold text-[#0c66e4]">
          <div class="flex items-center gap-2 truncate">
            <span class="w-2 h-2 rounded-full bg-[#0c66e4] shrink-0"></span>
            <span class="truncate">${this.escapeHtml(name)}</span>
          </div>
          <button type="button" onclick="CalendarView.clearSubject()" class="text-[#0c66e4] hover:text-red-600 font-bold ml-2 cursor-pointer p-0.5" title="Remove linked subject">✕</button>
        </div>
      `;
      chipContainer.classList.remove("hidden");
      searchContainer.classList.add("hidden");
    }
  },

  clearSubject() {
    const hiddenInput = document.getElementById("cal-selected-subject-id");
    const searchContainer = document.getElementById("cal-subject-search-container");
    const chipContainer = document.getElementById("cal-subject-selected-chip");
    const searchInput = document.getElementById("cal-search-subject-input");
    const resultsEl = document.getElementById("cal-subject-search-results");

    if (hiddenInput) hiddenInput.value = "";
    if (resultsEl) resultsEl.classList.add("hidden");
    if (chipContainer) chipContainer.classList.add("hidden");
    if (searchContainer) searchContainer.classList.remove("hidden");
    if (searchInput) searchInput.value = "";
  },

  onSearchTopic(query) {
    const resultsEl = document.getElementById("cal-topic-search-results");
    if (!resultsEl) return;

    const q = (query || "").trim().toLowerCase();
    const subjects = State.subjectsTree || [];
    const selectedSubjectId = document.getElementById("cal-selected-subject-id")?.value;

    const topicPool = [];
    subjects.forEach(s => {
      if (!selectedSubjectId || parseInt(selectedSubjectId) === s.id) {
        (s.chapters || []).forEach(chap => {
          (chap.topics || []).forEach(t => {
            topicPool.push({
              id: t.id,
              name: t.name,
              chapterName: chap.name,
              subjectId: s.id,
              subjectName: s.name
            });
          });
        });
      }
    });

    const matches = topicPool.filter(t => !q || t.name.toLowerCase().includes(q) || t.chapterName.toLowerCase().includes(q));

    if (matches.length === 0) {
      resultsEl.innerHTML = `
        <div class="p-3 text-xs text-[#626f86] text-center">
          No topics found matching "${this.escapeHtml(query)}"
        </div>
      `;
      resultsEl.classList.remove("hidden");
      return;
    }

    let html = `<div class="py-1">`;
    matches.forEach(t => {
      html += `
        <div onclick="CalendarView.selectTopic(${t.id}, '${this.escapeJs(t.name)}', ${t.subjectId}, '${this.escapeJs(t.subjectName)}')"
          class="px-3 py-2 text-xs text-[#172b4d] hover:bg-purple-50 hover:text-purple-800 cursor-pointer border-b border-[#f1f2f4] last:border-b-0 transition flex flex-col">
          <span class="font-semibold text-xs">${this.escapeHtml(t.name)}</span>
          <span class="text-[10px] text-[#626f86] mt-0.5">${this.escapeHtml(t.chapterName)} • ${this.escapeHtml(t.subjectName)}</span>
        </div>
      `;
    });
    html += `</div>`;

    resultsEl.innerHTML = html;
    resultsEl.classList.remove("hidden");
  },

  selectTopic(id, name, parentSubjectId, parentSubjectName) {
    const hiddenTopicInput = document.getElementById("cal-selected-topic-id");
    const searchContainer = document.getElementById("cal-topic-search-container");
    const chipContainer = document.getElementById("cal-topic-selected-chip");
    const resultsEl = document.getElementById("cal-topic-search-results");

    if (hiddenTopicInput) hiddenTopicInput.value = id;
    if (resultsEl) resultsEl.classList.add("hidden");

    if (chipContainer && searchContainer) {
      chipContainer.innerHTML = `
        <div class="flex items-center justify-between p-2 rounded-lg bg-purple-50 border border-purple-200 text-xs font-semibold text-purple-700">
          <div class="flex items-center gap-2 truncate">
            <span class="w-2 h-2 rounded-full bg-purple-600 shrink-0"></span>
            <span class="truncate">${this.escapeHtml(name)}</span>
          </div>
          <button type="button" onclick="CalendarView.clearTopic()" class="text-purple-700 hover:text-red-600 font-bold ml-2 cursor-pointer p-0.5" title="Remove linked topic">✕</button>
        </div>
      `;
      chipContainer.classList.remove("hidden");
      searchContainer.classList.add("hidden");
    }

    // Auto-select parent subject if not selected yet
    const subjectIdVal = document.getElementById("cal-selected-subject-id")?.value;
    if (!subjectIdVal && parentSubjectId) {
      this.selectSubject(parentSubjectId, parentSubjectName);
    }
  },

  clearTopic() {
    const hiddenInput = document.getElementById("cal-selected-topic-id");
    const searchContainer = document.getElementById("cal-topic-search-container");
    const chipContainer = document.getElementById("cal-topic-selected-chip");
    const searchInput = document.getElementById("cal-search-topic-input");
    const resultsEl = document.getElementById("cal-topic-search-results");

    if (hiddenInput) hiddenInput.value = "";
    if (resultsEl) resultsEl.classList.add("hidden");
    if (chipContainer) chipContainer.classList.add("hidden");
    if (searchContainer) searchContainer.classList.remove("hidden");
    if (searchInput) searchInput.value = "";
  },

  closeEventModal() {
    const modal = document.getElementById("calendar-event-modal");
    if (modal) modal.classList.add("hidden");
    this.editingEventId = null;
    document.getElementById("cal-subject-search-results")?.classList.add("hidden");
    document.getElementById("cal-topic-search-results")?.classList.add("hidden");
  },

  async saveEvent(e) {
    if (e && e.preventDefault) e.preventDefault();

    const titleInput = document.getElementById("cal-input-title");
    const dateInput = document.getElementById("cal-input-date");
    const timeInput = document.getElementById("cal-input-time");
    const catSelect = document.getElementById("cal-input-category");
    const prioritySelect = document.getElementById("cal-input-priority");
    const subjectIdVal = document.getElementById("cal-selected-subject-id")?.value;
    const topicIdVal = document.getElementById("cal-selected-topic-id")?.value;
    const descInput = document.getElementById("cal-input-description");

    const title = titleInput ? titleInput.value.trim() : "";
    const event_date = dateInput ? dateInput.value.trim() : "";

    if (!title) {
      alert("Please enter a title for the event or milestone.");
      return;
    }
    if (!event_date) {
      alert("Please choose a date.");
      return;
    }

    const payload = {
      title,
      event_date,
      event_time: timeInput ? timeInput.value.trim() : "",
      category: catSelect ? catSelect.value : "event",
      priority: prioritySelect ? prioritySelect.value : "normal",
      subject_id: subjectIdVal ? parseInt(subjectIdVal) : null,
      topic_id: topicIdVal ? parseInt(topicIdVal) : null,
      description: descInput ? descInput.value.trim() : ""
    };

    try {
      if (this.editingEventId) {
        await API.updateCalendarEvent(this.editingEventId, payload);
      } else {
        await API.createCalendarEvent(payload);
      }
      this.closeEventModal();
      this.selectedDate = event_date;
      await this.fetchEvents();
    } catch (err) {
      alert("Failed to save event: " + (err.message || err));
    }
  },

  async toggleEventComplete(id, currentStatus) {
    try {
      await API.updateCalendarEvent(id, { is_completed: !currentStatus });
      await this.fetchEvents();
    } catch (err) {
      console.error("Failed to toggle event complete:", err);
    }
  },

  async deleteEvent(id) {
    if (!confirm("Are you sure you want to delete this event?")) return;
    try {
      await API.deleteCalendarEvent(id);
      await this.fetchEvents();
    } catch (err) {
      alert("Failed to delete event: " + (err.message || err));
    }
  },

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  escapeJs(str) {
    if (!str) return "";
    return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }
};

// Global click listener to close search dropdowns when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest("#cal-subject-search-container")) {
    document.getElementById("cal-subject-search-results")?.classList.add("hidden");
  }
  if (!e.target.closest("#cal-topic-search-container")) {
    document.getElementById("cal-topic-search-results")?.classList.add("hidden");
  }
});
