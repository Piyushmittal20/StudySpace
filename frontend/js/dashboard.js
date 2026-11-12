/**
 * Dashboard View Controller
 * Answers: What have I been studying? Where can I find my material? What should I revise next?
 * Completely emoji-free, clean professional layout without flashcards.
 */
const Dashboard = {
  async load() {
    try {
      const [stats, subjects, calendarEvents] = await Promise.all([
        API.getProgressStats(),
        API.getSubjects(),
        API.getCalendarEvents().catch(() => [])
      ]);

      State.setSubjects(subjects);
      this.renderCalendarEvents(calendarEvents);
      this.renderContinueLearning(stats.recently_studied_materials);
      this.renderRevisionAlerts(stats);
      this.renderSubjectsGrid(subjects);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
      State.toast("Failed to load some dashboard items.", "error");
    }
  },

  renderCalendarEvents(events) {
    const el = document.getElementById("dashboard-calendar-events");
    if (!el) return;

    const todayStr = new Date().toISOString().split("T")[0];
    const upcoming = (events || [])
      .filter(e => !e.is_completed && e.event_date >= todayStr)
      .slice(0, 3);

    if (upcoming.length === 0) {
      el.innerHTML = "";
      return;
    }

    const categoryBadges = {
      exam: "bg-[#fce8e6] text-[#d93025] border-[#fad2cf]",
      deadline: "bg-[#fef7e0] text-[#b06000] border-[#fde293]",
      assignment: "bg-[#fef7e0] text-[#b06000] border-[#fde293]",
      milestone: "bg-[#e8f0fe] text-[#1a73e8] border-[#aecbfa]",
      revision: "bg-[#e6f4ea] text-[#1e8e3e] border-[#ceead6]",
      event: "bg-[#f1f3f4] text-[#202124] border-[#dadce0]"
    };

    let itemsHtml = "";
    upcoming.forEach(ev => {
      const badgeCls = categoryBadges[ev.category] || categoryBadges.event;
      itemsHtml += `
        <div onclick="App.navigateTo('calendar', { date: '${ev.event_date}' })"
          class="p-3 rounded-lg border border-[#dadce0] bg-[#fafbfc] hover:bg-white hover:border-[#4285F4] transition cursor-pointer flex items-center justify-between gap-3 shadow-2xs">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badgeCls}">${ev.category}</span>
              <h4 class="text-xs font-semibold text-[#202124] truncate">${typeof CalendarView !== 'undefined' ? CalendarView.escapeHtml(ev.title) : ev.title}</h4>
            </div>
            <p class="text-[11px] text-[#5f6368] mt-1">
              Date: <span class="font-medium text-[#202124]">${ev.event_date}</span>
              ${ev.event_time ? `• ${ev.event_time}` : ''}
              ${ev.subject_name ? `• ${ev.subject_name}` : ''}
            </p>
          </div>
          <span class="text-xs text-[#1a73e8] font-semibold shrink-0">View →</span>
        </div>
      `;
    });

    el.innerHTML = `
      <div class="bg-white rounded-xl border border-[#dadce0] border-t-[3px] border-t-[#34A853] p-5 shadow-xs">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full bg-[#34A853]"></div>
            <h3 class="text-sm font-semibold text-[#202124]">Upcoming Important Dates & Milestones</h3>
          </div>
          <button onclick="App.navigateTo('calendar')" class="text-xs text-[#1a73e8] hover:text-[#1557b0] font-semibold cursor-pointer">
            Open Calendar →
          </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          ${itemsHtml}
        </div>
      </div>
    `;
  },

  renderContinueLearning(recentMaterials) {
    const el = document.getElementById("dashboard-continue-learning");
    if (!el) return;

    if (!recentMaterials || recentMaterials.length === 0) {
      el.innerHTML = `
        <div class="p-8 text-center bg-white rounded-xl border border-[#dadce0] border-t-[3px] border-t-[#4285F4]">
          <p class="text-[#3c4043] text-sm">No recent study sessions yet.</p>
          <p class="text-xs text-[#5f6368] mt-1">Upload a document or import a webpage to get started.</p>
          <button onclick="App.openAddMaterialModal()" class="mt-4 px-4 py-2 bg-[#1a73e8] text-white text-xs font-semibold rounded-lg hover:bg-[#1557b0] transition shadow-xs cursor-pointer">
            + Add First Material
          </button>
        </div>
      `;
      return;
    }

    const latest = recentMaterials[0];
    el.innerHTML = `
      <div class="text-white p-6 rounded-xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4" style="background: linear-gradient(135deg, #1a73e8 0%, #4285F4 100%);">
        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-blue-100 bg-white/20 px-2 py-0.5 rounded">Continue Learning</span>
          <h2 class="text-xl font-bold mt-1.5 text-white">${State.escapeHTML(latest.title)}</h2>
          <p class="text-xs text-blue-100 mt-1">
            ${latest.subject_name ? State.escapeHTML(latest.subject_name) : 'Unassigned'} •
            ${latest.topic_name ? State.escapeHTML(latest.topic_name) : 'General'}
          </p>
        </div>
        <button onclick="App.navigateTo('study-room', { id: ${latest.id} })"
          class="px-5 py-2.5 bg-white text-[#1a73e8] hover:bg-[#e8f0fe] text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer shrink-0">
          <span>Resume Reading</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        ${recentMaterials.slice(1, 4).map(m => `
          <div onclick="App.navigateTo('study-room', { id: ${m.id} })"
            class="bg-white p-3.5 rounded-lg border border-[#dadce0] hover:border-[#4285F4] transition cursor-pointer flex flex-col justify-between shadow-2xs">
            <div>
              <span class="text-[10px] uppercase font-bold text-[#5f6368]">${m.source_type}</span>
              <h4 class="text-xs font-semibold text-[#202124] mt-1 truncate">${State.escapeHTML(m.title)}</h4>
            </div>
            <p class="text-[11px] text-[#5f6368] mt-2 truncate">
              ${m.subject_name ? State.escapeHTML(m.subject_name) : 'Unassigned'}
            </p>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderRevisionAlerts(stats) {
    const el = document.getElementById("dashboard-revision-alerts");
    if (!el) return;

    const practiceTopics = stats.topics_needing_practice || [];

    el.innerHTML = `
      <div class="bg-white rounded-xl border border-[#dadce0] border-t-[3px] border-t-[#FBBC05] p-5 shadow-xs">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full bg-[#FBBC05]"></div>
            <h4 class="font-semibold text-[#202124] text-base">What to Revise Next</h4>
          </div>
          <span class="text-xs text-[#5f6368] font-normal">Active Recall & Practice</span>
        </div>

        ${practiceTopics.length > 0 ? `
          <div class="space-y-2">
            ${practiceTopics.slice(0, 4).map(pt => `
              <div class="flex items-center justify-between p-3 rounded-lg bg-[#fafbfc] hover:bg-[#f1f3f4] transition border border-[#dadce0]">
                <div>
                  <span class="text-sm font-semibold text-[#202124] block">${State.escapeHTML(pt.topic_name)}</span>
                  <span class="text-xs text-[#5f6368]">${State.escapeHTML(pt.subject_name || 'General')} • ${State.escapeHTML(pt.reason)}</span>
                </div>
                <button onclick="App.navigateTo('quizzes', { topicId: ${pt.topic_id} })"
                  class="px-3 py-1 bg-[#fef7e0] text-[#b06000] hover:bg-[#feefc3] rounded text-sm font-semibold transition cursor-pointer">
                  Practice Quiz
                </button>
              </div>
            `).join('')}
          </div>
        ` : `
          <p class="text-sm text-[#3c4043] bg-[#fafbfc] p-4 rounded-lg border border-[#dadce0]">
            All your topics are in good standing! Open any study material in your Library to review sections or take quizzes.
          </p>
        `}
      </div>
    `;
  },

  renderSubjectsGrid(subjects) {
    const el = document.getElementById("dashboard-subjects-grid");
    if (!el) return;

    if (!subjects || subjects.length === 0) {
      el.innerHTML = `
        <div class="col-span-full p-6 text-center bg-white rounded-xl border border-[#dadce0]">
          <p class="text-[#3c4043] text-sm">No subjects created yet.</p>
          <button onclick="App.openCreateSubjectModal()" class="mt-2 text-sm font-semibold text-[#1a73e8] hover:underline cursor-pointer">
            + Create your first subject
          </button>
        </div>
      `;
      return;
    }

    const googleColors = ['#4285F4', '#34A853', '#FBBC05', '#EA4335'];

    el.innerHTML = subjects.slice(0, 6).map((s, idx) => {
      const chaptersCount = s.chapters ? s.chapters.length : 0;
      let totalTopics = 0;
      if (s.chapters) {
        s.chapters.forEach(c => totalTopics += (c.topics ? c.topics.length : 0));
      }
      const accent = s.color || googleColors[idx % googleColors.length];

      return `
        <div onclick="App.navigateTo('subjects', { subjectId: ${s.id} })"
          class="bg-white p-4 rounded-xl border border-[#dadce0] hover:shadow-xs cursor-pointer transition flex flex-col justify-between"
          style="border-top: 3px solid ${accent};">
          <div>
            <div class="flex items-center justify-between">
              <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${accent}"></span>
              <span class="text-xs text-[#5f6368]">${s.materials_count || 0} materials</span>
            </div>
            <h4 class="font-semibold text-[#202124] mt-2 text-base">${State.escapeHTML(s.name)}</h4>
            <p class="text-sm text-[#3c4043] mt-1 line-clamp-2">${State.escapeHTML(s.description || 'No description provided')}</p>
          </div>
          <div class="mt-4 pt-3 border-t border-[#dadce0] flex items-center justify-between text-xs text-[#5f6368]">
            <span>${chaptersCount} chapters</span>
            <span>${totalTopics} topics</span>
          </div>
        </div>
      `;
    }).join('');
  }
};
