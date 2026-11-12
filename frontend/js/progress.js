/**
 * Learning Progress & Analytics Controller
 * Displays real study time, completion rates, quiz accuracies, and topic focus.
 * Clean, professional, emoji-free, without flashcards.
 */
const Progress = {
  async load() {
    try {
      const stats = await API.getProgressStats();
      this.render(stats);
    } catch (err) {
      console.error("Failed to load progress:", err);
      State.toast("Failed to load learning progress.", "error");
    }
  },

  render(stats) {
    const container = document.getElementById("progress-view-content");
    if (!container) return;

    const completionRate = stats.topics_total > 0
      ? Math.round((stats.topics_completed / stats.topics_total) * 100)
      : 0;

    container.innerHTML = `
      <!-- Primary Metric Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="bg-white p-5 rounded-xl border border-[#DCDFE4] shadow-xs">
          <p class="text-xs font-semibold uppercase text-[#626f86] tracking-wider">Curriculum Mastery</p>
          <div class="mt-2 flex items-baseline gap-2">
            <h3 class="text-2xl font-bold text-[#172b4d]">${completionRate}%</h3>
            <span class="text-xs text-[#626f86]">(${stats.topics_completed} / ${stats.topics_total} topics)</span>
          </div>
          <div class="w-full bg-[#F1F2F4] rounded-full h-1.5 mt-3 overflow-hidden">
            <div class="bg-[#0c66e4] h-1.5 rounded-full" style="width: ${completionRate}%"></div>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl border border-[#DCDFE4] shadow-xs">
          <p class="text-xs font-semibold uppercase text-[#626f86] tracking-wider">Total Study Time</p>
          <div class="mt-2 flex items-baseline gap-2">
            <h3 class="text-2xl font-bold text-[#172b4d]">${stats.total_study_time_minutes}</h3>
            <span class="text-xs text-[#626f86]">minutes recorded</span>
          </div>
          <p class="text-xs text-[#626f86] mt-3">Live timer tracks active reading & revision</p>
        </div>

        <div class="bg-white p-5 rounded-xl border border-[#DCDFE4] shadow-xs">
          <p class="text-xs font-semibold uppercase text-[#626f86] tracking-wider">Quiz Accuracy</p>
          <div class="mt-2 flex items-baseline gap-2">
            <h3 class="text-2xl font-bold text-[#172b4d]">${stats.average_quiz_score}%</h3>
            <span class="text-xs text-[#626f86]">average score</span>
          </div>
          <p class="text-xs text-[#626f86] mt-3">${stats.quiz_attempts_total} completed attempt${stats.quiz_attempts_total === 1 ? '' : 's'}</p>
        </div>

        <div class="bg-white p-5 rounded-xl border border-[#DCDFE4] shadow-xs">
          <p class="text-xs font-semibold uppercase text-[#626f86] tracking-wider">Library Total</p>
          <div class="mt-2 flex items-baseline gap-2">
            <h3 class="text-2xl font-bold text-[#172b4d]">${stats.materials_total}</h3>
            <span class="text-xs text-[#626f86]">documents & web</span>
          </div>
          <p class="text-xs text-[#626f86] mt-3">${stats.notes_total} notes taken</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Recently Studied Materials -->
        <div class="bg-white rounded-xl border border-[#DCDFE4] p-5 shadow-xs">
          <h4 class="font-semibold text-[#172b4d] text-base mb-4">Recently Studied Materials</h4>
          ${(stats.recently_studied_materials && stats.recently_studied_materials.length > 0) ? `
            <div class="divide-y divide-[#DCDFE4]">
              ${stats.recently_studied_materials.map(m => `
                <div class="py-3 flex items-center justify-between hover:bg-[#F1F2F4] px-2 rounded transition">
                  <div class="min-w-0 pr-3">
                    <h5 class="text-sm font-semibold text-[#172b4d] truncate">${State.escapeHTML(m.title)}</h5>
                    <p class="text-xs text-[#626f86] mt-0.5">
                      ${m.subject_name ? State.escapeHTML(m.subject_name) : 'General'} • Opened ${State.formatDate(m.last_opened_at)}
                    </p>
                  </div>
                  <button onclick="App.navigateTo('study-room', { id: ${m.id} })"
                    class="px-2.5 py-1 bg-[#E9F2FF] text-[#0c66e4] hover:bg-blue-100 rounded text-xs font-semibold shrink-0">
                    Resume
                  </button>
                </div>
              `).join('')}
            </div>
          ` : `
            <p class="text-xs text-[#626f86] italic py-6 text-center">No recent materials studied yet.</p>
          `}
        </div>

        <!-- Topics Needing Practice -->
        <div class="bg-white rounded-xl border border-[#DCDFE4] p-5 shadow-xs">
          <h4 class="font-semibold text-[#172b4d] text-base mb-4">Focus & Practice Checklist</h4>
          ${(stats.topics_needing_practice && stats.topics_needing_practice.length > 0) ? `
            <div class="space-y-3">
              ${stats.topics_needing_practice.map(tp => `
                <div class="p-3 bg-[#F7F8F9] rounded-lg border border-[#DCDFE4] flex items-center justify-between">
                  <div>
                    <h5 class="text-sm font-semibold text-[#172b4d]">${State.escapeHTML(tp.topic_name)}</h5>
                    <p class="text-xs text-[#44546f] mt-0.5">${State.escapeHTML(tp.subject_name || '')} • ${State.escapeHTML(tp.reason)}</p>
                  </div>
                  <button onclick="App.navigateTo('subjects', { topicId: ${tp.topic_id} })"
                    class="px-3 py-1 bg-[#0c66e4] text-white rounded text-xs font-semibold hover:bg-[#0055cc] transition">
                    Study Topic
                  </button>
                </div>
              `).join('')}
            </div>
          ` : `
            <p class="text-xs text-[#626f86] italic py-6 text-center">No weak topics detected. Great job keeping up with your studies.</p>
          `}
        </div>
      </div>
    `;
  }
};
