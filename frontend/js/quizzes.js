/**
 * Quizzes & Assessment Controller
 * Interactive quiz taking, instant scoring, answers revealed at the last of the quiz,
 * difficulty progression ("Continue" button for 10 more questions on the same topic),
 * attempt history, and AI quiz generation (strictly 10 questions with 4 options each).
 * Clean, professional, completely emoji-free.
 */
const Quizzes = {
  quizzes: [],
  activeQuiz: null,
  userAnswers: {},

  async load(options = {}) {
    await this.applyFilters(options);
    if (options.id) {
      this.startQuiz(parseInt(options.id));
    }
  },

  async applyFilters(options = {}) {
    const topicId = options.topicId || document.getElementById("quizzes-topic-filter")?.value;
    try {
      this.quizzes = await API.getQuizzes({
        topic_id: topicId ? parseInt(topicId) : undefined
      });
      this.renderList();
    } catch (err) {
      console.error("Failed to load quizzes:", err);
      State.toast("Failed to load quizzes.", "error");
    }
  },

  renderList() {
    const container = document.getElementById("quizzes-container");
    if (!container) return;

    if (this.quizzes.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center bg-white rounded-xl border border-[#DCDFE4] p-8">
          <div class="w-12 h-12 mx-auto rounded-full bg-[#F1F2F4] text-[#626f86] flex items-center justify-center mb-3">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h4 class="font-semibold text-[#172b4d] text-base">No practice quizzes found</h4>
          <p class="text-xs text-[#626f86] mt-1">Generate a 10-question AI quiz or create one manually to test retention.</p>
          <div class="mt-4 flex items-center justify-center gap-2">
            <button onclick="Quizzes.openAIGeneratorModal()" class="px-4 py-2 bg-[#0c66e4] hover:bg-[#0055cc] text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              <span>+ Generate AI Quiz</span>
            </button>
            <button onclick="Quizzes.openCreateModal()" class="px-3.5 py-2 border border-[#DCDFE4] hover:bg-[#F1F2F4] text-[#172b4d] rounded-lg text-xs font-semibold transition cursor-pointer">
              + Manual Quiz
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.quizzes.map(q => {
      const diffColors = {
        easy: "bg-[#e6f4ea] text-[#1e8e3e] border-[#ceead6]",
        medium: "bg-[#e8f0fe] text-[#1a73e8] border-[#aecbfa]",
        hard: "bg-[#fef7e0] text-[#b06000] border-[#fde293]",
        expert: "bg-[#fce8e6] text-[#d93025] border-[#fad2cf]"
      };
      const diffClass = diffColors[(q.difficulty || "medium").toLowerCase()] || diffColors.medium;

      return `
        <div class="bg-white rounded-xl border border-[#DCDFE4] p-5 shadow-xs hover:border-[#0c66e4] transition flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${diffClass}">
                ${State.escapeHTML(q.difficulty || 'Medium')}
              </span>
              <span class="text-xs text-[#626f86] font-medium">
                ${q.questions_count} question${q.questions_count === 1 ? '' : 's'}
              </span>
            </div>
            <h4 class="font-semibold text-[#172b4d] text-base mb-1">${State.escapeHTML(q.title)}</h4>
            <p class="text-xs text-[#44546f] line-clamp-2">${State.escapeHTML(q.description || 'Practice assessment')}</p>
            <div class="mt-2 text-xs text-[#626f86]">
              ${q.topic_name ? `Topic: <strong class="text-[#172b4d]">${State.escapeHTML(q.topic_name)}</strong>` : 'General Assessment'}
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-[#DCDFE4] flex items-center justify-between">
            <button onclick="Quizzes.startQuiz(${q.id})"
              class="px-3.5 py-1.5 bg-[#0c66e4] hover:bg-[#0055cc] text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5">
              <span>Start Quiz</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
            <button onclick="Quizzes.deleteQuiz(${q.id})" title="Delete" class="p-1 text-[#626f86] hover:text-rose-600 rounded cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  // ---------------- Interactive Quiz Taking ----------------
  async startQuiz(quizId) {
    try {
      this.activeQuiz = await API.getQuiz(quizId);
      this.userAnswers = {};

      const overlay = document.getElementById("quiz-session-overlay");
      const titleEl = document.getElementById("quiz-session-title");
      const bodyEl = document.getElementById("quiz-session-body");
      if (!overlay || !bodyEl) return;

      titleEl.textContent = this.activeQuiz.title;
      overlay.classList.remove("hidden");

      const questions = this.activeQuiz.questions || [];
      if (questions.length === 0) {
        bodyEl.innerHTML = `
          <div class="p-12 text-center text-xs text-[#626f86]">
            <p>This quiz has no questions available.</p>
            <button onclick="Quizzes.closeQuizSession()" class="mt-3 px-4 py-1.5 bg-[#0c66e4] text-white rounded-lg text-xs font-semibold cursor-pointer">Close</button>
          </div>
        `;
        return;
      }

      const diffLabel = (this.activeQuiz.difficulty || "medium").toUpperCase();

      bodyEl.innerHTML = `
        <div class="space-y-5">
          <!-- Quiz Header Status Banner -->
          <div class="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2">
              <span class="font-bold text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-[#0c66e4]">
                Level: ${diffLabel}
              </span>
              <span class="text-[#172b4d] font-semibold">${questions.length} Questions (4 options each)</span>
            </div>
            <div class="flex items-center gap-3">
              <span id="quiz-answered-count" class="font-medium text-[#44546f]">0 of ${questions.length} answered</span>
              <span class="text-[#626f86] italic text-[11px] hidden sm:inline">Answers shown at completion</span>
            </div>
          </div>

          <!-- Questions List -->
          ${questions.map((q, idx) => {
            // Ensure 4 options
            const rawOpts = (q.options && q.options.length >= 2) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'];
            const opts = [...rawOpts];
            while (opts.length < 4) {
              opts.push(`Option ${['A', 'B', 'C', 'D'][opts.length]}`);
            }

            return `
              <div class="bg-white p-5 rounded-xl border border-[#DCDFE4] shadow-xs space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-[#0c66e4] uppercase tracking-wider">Question ${idx + 1} of ${questions.length}</span>
                  <span id="q-status-${q.id}" class="text-[11px] text-[#626f86] font-medium">Unanswered</span>
                </div>
                <p class="text-sm sm:text-base font-semibold text-[#172b4d] leading-relaxed">${State.escapeHTML(q.question_text)}</p>

                <!-- 4 Options (A, B, C, D) -->
                <div class="space-y-2 pt-1">
                  ${opts.slice(0, 4).map((opt, optIdx) => {
                    const letter = ['A', 'B', 'C', 'D'][optIdx] || String(optIdx + 1);
                    return `
                      <label class="flex items-center gap-3 p-3 rounded-lg border border-[#DCDFE4] hover:bg-[#F1F2F4] hover:border-[#0c66e4] cursor-pointer text-xs transition group">
                        <input type="radio" name="question_${q.id}" value="${State.escapeHTML(opt)}"
                          onchange="Quizzes.recordAnswer(${q.id}, '${State.escapeHTML(opt).replace(/'/g, "\\'")}')"
                          class="text-[#0c66e4] focus:ring-0">
                        <span class="w-6 h-6 rounded-full bg-[#f1f2f4] group-hover:bg-blue-100 text-[#44546f] group-hover:text-[#0c66e4] font-bold text-xs flex items-center justify-center shrink-0">
                          ${letter}
                        </span>
                        <span class="text-[#172b4d] font-medium leading-relaxed">${State.escapeHTML(opt)}</span>
                      </label>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}

          <!-- Submit Action Bar -->
          <div class="pt-4 border-t border-[#dcdfe4] flex items-center justify-between">
            <button onclick="Quizzes.closeQuizSession()" class="px-4 py-2 text-xs font-semibold text-[#626f86] hover:text-[#172b4d] transition cursor-pointer">
              Cancel
            </button>
            <button onclick="Quizzes.submitQuiz()" class="px-6 py-2.5 bg-[#0c66e4] text-white rounded-lg text-xs font-semibold hover:bg-[#0055cc] transition shadow-xs cursor-pointer flex items-center gap-1.5">
              <span>Submit Answers & View Score</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      `;
    } catch (err) {
      console.error(err);
      State.toast("Failed to load quiz", "error");
    }
  },

  recordAnswer(questionId, val) {
    this.userAnswers[String(questionId)] = val;
    const statusEl = document.getElementById(`q-status-${questionId}`);
    if (statusEl) {
      statusEl.innerHTML = `<span class="text-emerald-700 font-semibold text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Answered</span>`;
    }
    this.updateAnsweredCounter();
  },

  updateAnsweredCounter() {
    const counterEl = document.getElementById("quiz-answered-count");
    if (!counterEl || !this.activeQuiz) return;
    const total = (this.activeQuiz.questions || []).length;
    const answered = Object.keys(this.userAnswers).length;
    counterEl.textContent = `${answered} of ${total} answered`;
  },

  async submitQuiz() {
    if (!this.activeQuiz) return;
    const questions = this.activeQuiz.questions || [];
    const answeredCount = Object.keys(this.userAnswers).length;

    if (answeredCount < questions.length) {
      const unanswered = questions.length - answeredCount;
      if (!window.confirm(`You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. Are you sure you want to submit and view your score?`)) {
        return;
      }
    }

    try {
      const result = await API.submitQuizAttempt(this.activeQuiz.id, this.userAnswers);
      this.renderQuizResults(result);
    } catch (err) {
      State.toast(err.message || "Failed to submit attempt", "error");
    }
  },

  renderQuizResults(attempt) {
    const bodyEl = document.getElementById("quiz-session-body");
    if (!bodyEl) return;

    const currentDiff = (this.activeQuiz?.difficulty || "medium").toLowerCase();
    const diffProgression = {
      easy: { next: "medium", nextLabel: "Medium", badge: "Easy" },
      medium: { next: "hard", nextLabel: "Hard", badge: "Medium" },
      hard: { next: "expert", nextLabel: "Expert", badge: "Hard" },
      expert: { next: "expert", nextLabel: "Expert Challenge", badge: "Expert" }
    };
    const diffInfo = diffProgression[currentDiff] || { next: "hard", nextLabel: "Hard", badge: "Medium" };
    const correctCount = attempt.answers_json.filter(a => a.is_correct).length;

    bodyEl.innerHTML = `
      <div class="text-center pb-6 border-b border-[#DCDFE4]">
        <div class="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-slate-100 text-[#44546f] text-xs font-semibold">
          <span class="text-[#0c66e4] uppercase tracking-wider font-bold">${diffInfo.badge} Level</span>
          <span>•</span>
          <span>${correctCount} of ${attempt.total_questions} Correct</span>
        </div>
        <h3 class="text-4xl font-bold text-[#172b4d]">${attempt.score}%</h3>
        <p class="text-xs text-[#626f86] mt-1.5">
          ${attempt.score >= 80 ? 'Mastery demonstrated! Ready to advance to the next difficulty level.' : (attempt.score >= 60 ? 'Solid performance. Review the detailed explanations below, then level up.' : 'Practice makes perfect. Review the explanations below, then continue to the next set.')}
        </p>
      </div>

      <div class="mt-6 space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold uppercase tracking-wider text-[#626f86]">Answers & Explanations (${attempt.answers_json.length} Questions)</h4>
          <span class="text-xs text-[#626f86]">Answers revealed at quiz completion</span>
        </div>

        ${attempt.answers_json.map((a, i) => `
          <div class="p-4 rounded-xl border ${a.is_correct ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40'} text-xs space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="font-bold text-[#172b4d]">Question ${i + 1}</span>
              <span class="font-bold px-2 py-0.5 rounded text-[11px] ${a.is_correct ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                ${a.is_correct ? 'Correct' : 'Incorrect'}
              </span>
            </div>

            <p class="text-sm font-semibold text-[#172b4d] leading-relaxed">${State.escapeHTML(a.question_text)}</p>

            <div class="p-3 rounded-lg bg-white/90 border border-[#DCDFE4] space-y-1.5">
              <div class="flex items-start gap-2">
                <span class="text-[#626f86] shrink-0 font-medium">Your answer:</span>
                <span class="font-semibold ${a.is_correct ? 'text-emerald-700' : 'text-rose-700'}">${State.escapeHTML(a.user_answer || '(No answer provided)')}</span>
              </div>
              ${!a.is_correct ? `
                <div class="flex items-start gap-2 pt-1 border-t border-slate-100">
                  <span class="text-[#626f86] shrink-0 font-medium">Correct answer:</span>
                  <span class="font-bold text-emerald-800">${State.escapeHTML(a.correct_answer)}</span>
                </div>
              ` : ''}
            </div>

            ${a.explanation ? `
              <div class="bg-white/95 p-3 rounded-lg border border-[#DCDFE4]/70 text-xs text-[#44546f] leading-relaxed">
                <span class="font-semibold text-[#172b4d]">Explanation:</span> ${State.escapeHTML(a.explanation)}
              </div>
            ` : ''}
          </div>
        `).join('')}

        <!-- Bottom Action Bar with Continue Button -->
        <div class="pt-6 border-t border-[#DCDFE4] flex flex-col sm:flex-row items-center justify-between gap-3">
          <button onclick="Quizzes.closeQuizSession()"
            class="w-full sm:w-auto px-4 py-2.5 border border-[#DCDFE4] text-[#44546f] hover:text-[#172b4d] hover:bg-[#F1F2F4] rounded-lg text-xs font-semibold transition cursor-pointer">
            Done & Close
          </button>

          <button onclick="Quizzes.continueToNextLevel()"
            class="w-full sm:w-auto px-6 py-2.5 bg-[#0c66e4] hover:bg-[#0055cc] text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer">
            <span>Continue to ${diffInfo.nextLabel} Level (10 Questions)</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </button>
        </div>
      </div>
    `;
  },

  async continueToNextLevel() {
    if (!this.activeQuiz) return;

    const currentDiff = (this.activeQuiz.difficulty || "medium").toLowerCase();
    const diffProgression = {
      easy: { next: "medium", nextLabel: "Medium" },
      medium: { next: "hard", nextLabel: "Hard" },
      hard: { next: "expert", nextLabel: "Expert" },
      expert: { next: "expert", nextLabel: "Expert Challenge" }
    };
    const nextDiff = diffProgression[currentDiff]?.next || "hard";
    const nextLabel = diffProgression[currentDiff]?.nextLabel || "Hard";

    const topicName = this.activeQuiz.topic_name || this.activeQuiz.material_title || "this topic";
    const topicId = this.activeQuiz.topic_id;
    const materialId = this.activeQuiz.material_id;

    const bodyEl = document.getElementById("quiz-session-body");
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div class="py-20 text-center space-y-4">
          <div class="inline-block animate-spin w-8 h-8 border-3 border-[#0c66e4] border-t-transparent rounded-full"></div>
          <div>
            <h4 class="font-bold text-[#172b4d] text-base">Increasing Difficulty to ${nextLabel}...</h4>
            <p class="text-xs text-[#626f86] mt-1">Generating 10 new questions on "${State.escapeHTML(topicName)}" at ${nextLabel} level.</p>
          </div>
        </div>
      `;
    }

    try {
      const res = await API.aiGenerateQuiz({
        question_count: 10,
        difficulty: nextDiff,
        topic_id: topicId || undefined,
        material_id: materialId || undefined,
        custom_text: (!topicId && !materialId) ? `Generate practice questions for: ${this.activeQuiz.title}` : undefined
      });

      if (!res.success || !res.data || res.data.length === 0) {
        throw new Error(res.message || "Could not generate questions at this difficulty.");
      }

      const cleanTitle = (this.activeQuiz.title || "Practice Quiz")
        .replace(/\s*\((Easy|Medium|Hard|Expert|Level\s*\d+)\)/gi, "")
        .replace(/\s*-\s*(Easy|Medium|Hard|Expert)/gi, "")
        .trim();

      const newQuiz = await API.createQuiz({
        title: `${cleanTitle} (${nextLabel})`,
        description: `10-question practice assessment (${nextLabel} Level) on ${topicName}`,
        topic_id: topicId,
        material_id: materialId,
        difficulty: nextDiff,
        questions: res.data
      });

      State.toast(`Difficulty increased to ${nextLabel}! 10 new questions loaded.`, "success");
      await this.startQuiz(newQuiz.id);
    } catch (err) {
      State.toast(err.message || "Failed to generate next level quiz", "error");
      if (bodyEl) {
        bodyEl.innerHTML = `
          <div class="p-8 text-center space-y-3">
            <h4 class="font-semibold text-[#172b4d] text-sm">Failed to generate next difficulty level</h4>
            <p class="text-xs text-rose-600">${State.escapeHTML(err.message || "Please check AI settings or connection.")}</p>
            <div class="pt-3 flex justify-center gap-2">
              <button onclick="Quizzes.closeQuizSession()" class="px-4 py-2 bg-[#0c66e4] text-white rounded-lg text-xs font-semibold cursor-pointer">Done & Close</button>
            </div>
          </div>
        `;
      }
    }
  },

  closeQuizSession() {
    const overlay = document.getElementById("quiz-session-overlay");
    if (overlay) overlay.classList.add("hidden");
    this.activeQuiz = null;
    if (State.currentView === "quizzes") this.applyFilters();
  },

  // ---------------- AI Quiz Generator Modal ----------------
  openAIGeneratorModal(preselected = {}) {
    const modal = document.getElementById("ai-quiz-generate-modal");
    if (!modal) return;

    const topicSelect = document.getElementById("ai-quiz-topic-select");
    if (topicSelect) {
      topicSelect.innerHTML = '<option value="">Select Topic / Context...</option>';
      (State.subjectsTree || []).forEach(s => {
        (s.chapters || []).forEach(c => {
          (c.topics || []).forEach(t => {
            const isSel = (preselected.topicId && preselected.topicId === t.id) ? 'selected' : '';
            topicSelect.innerHTML += `<option value="${t.id}" ${isSel}>${State.escapeHTML(s.name)} → ${State.escapeHTML(t.name)}</option>`;
          });
        });
      });
    }

    if (preselected.difficulty) {
      const diffEl = document.getElementById("ai-quiz-diff-select");
      if (diffEl) diffEl.value = preselected.difficulty;
    }

    modal.classList.remove("hidden");
  },

  async submitAIGeneratorForm(event) {
    if (event) event.preventDefault();
    const topicIdVal = document.getElementById("ai-quiz-topic-select")?.value;
    const diffVal = document.getElementById("ai-quiz-diff-select")?.value || "easy";
    const customText = document.getElementById("ai-quiz-custom-topic")?.value.trim();

    if (!topicIdVal && !customText) {
      State.toast("Please select a topic or enter a topic prompt.", "warning");
      return;
    }

    const modal = document.getElementById("ai-quiz-generate-modal");
    if (modal) modal.classList.add("hidden");

    State.toast("Generating 10-question AI practice quiz...", "info");

    try {
      const topicId = topicIdVal ? parseInt(topicIdVal) : undefined;
      const res = await API.aiGenerateQuiz({
        topic_id: topicId,
        custom_text: customText || undefined,
        question_count: 10,
        difficulty: diffVal
      });

      if (!res.success || !res.data || res.data.length === 0) {
        throw new Error(res.message || "AI was unable to generate quiz questions.");
      }

      let topicName = customText || "Practice Assessment";
      if (topicId) {
        (State.subjectsTree || []).forEach(s => {
          (s.chapters || []).forEach(c => {
            (c.topics || []).forEach(t => {
              if (t.id === topicId) topicName = t.name;
            });
          });
        });
      }

      const diffLabel = diffVal.charAt(0).toUpperCase() + diffVal.slice(1);
      const savedQuiz = await API.createQuiz({
        title: `Quiz: ${topicName} (${diffLabel})`,
        description: `10-question practice test (${diffLabel}) on ${topicName}`,
        topic_id: topicId,
        difficulty: diffVal,
        questions: res.data
      });

      State.toast("10-question quiz ready! Starting now...", "success");
      await this.startQuiz(savedQuiz.id);
      if (State.currentView === "quizzes") this.applyFilters();
    } catch (err) {
      State.toast(err.message || "Failed to generate AI quiz", "error");
    }
  },

  // ---------------- AI Generated Quiz Review (Modal 9) ----------------
  openGeneratedQuizReviewModal(draftQuestions, docTitle, materialId, topicId) {
    const modal = document.getElementById("bulk-quiz-modal");
    const container = document.getElementById("bulk-quiz-list");
    if (!modal || !container) return;

    window._draftQuizQuestions = draftQuestions;
    window._draftQuizMatId = materialId;
    window._draftQuizTopicId = topicId;

    document.getElementById("bulk-quiz-title").value = `Quiz: ${docTitle}`;

    container.innerHTML = draftQuestions.map((q, i) => {
      const rawOpts = (q.options && q.options.length >= 2) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'];
      const opts = [...rawOpts];
      while (opts.length < 4) {
        opts.push(`Option ${['A', 'B', 'C', 'D'][opts.length]}`);
      }

      return `
        <div class="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
          <label class="font-bold text-slate-700 block">Question ${i + 1}:</label>
          <input type="text" id="draft-quiz-q-${i}" value="${State.escapeHTML(q.question_text)}" class="w-full font-medium p-1.5 rounded border border-slate-200">
          
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-xs text-slate-500 block">Correct Answer:</label>
              <input type="text" id="draft-quiz-ans-${i}" value="${State.escapeHTML(q.correct_answer)}" class="w-full p-1 rounded border border-slate-200 font-bold text-emerald-700">
            </div>
            <div>
              <label class="text-xs text-slate-500 block">Options (comma-separated, 4 options):</label>
              <input type="text" id="draft-quiz-opts-${i}" value="${State.escapeHTML(opts.slice(0, 4).join(', '))}" class="w-full p-1 rounded border border-slate-200">
            </div>
          </div>

          <div>
            <label class="text-xs text-slate-500 block">Explanation:</label>
            <input type="text" id="draft-quiz-exp-${i}" value="${State.escapeHTML(q.explanation || '')}" class="w-full p-1 rounded border border-slate-200 text-slate-600">
          </div>
        </div>
      `;
    }).join('');

    modal.classList.remove("hidden");
  },

  async saveGeneratedQuiz(andStart = false) {
    const drafts = window._draftQuizQuestions || [];
    const matId = window._draftQuizMatId;
    const topicId = window._draftQuizTopicId;
    const title = document.getElementById("bulk-quiz-title").value.trim() || "Practice Quiz";

    const questions = [];
    for (let i = 0; i < drafts.length; i++) {
      const qText = document.getElementById(`draft-quiz-q-${i}`)?.value.trim();
      const ans = document.getElementById(`draft-quiz-ans-${i}`)?.value.trim();
      const rawOpts = document.getElementById(`draft-quiz-opts-${i}`)?.value.trim();
      const exp = document.getElementById(`draft-quiz-exp-${i}`)?.value.trim();

      if (qText && ans) {
        let opts = rawOpts ? rawOpts.split(",").map(o => o.trim()).filter(Boolean) : [];
        if (!opts.includes(ans)) opts.push(ans);
        while (opts.length < 4) {
          opts.push(`Option ${['A', 'B', 'C', 'D'][opts.length]}`);
        }
        questions.push({
          question_type: "mcq",
          question_text: qText,
          options: opts.slice(0, 4),
          correct_answer: ans,
          explanation: exp || ""
        });
      }
    }

    try {
      const created = await API.createQuiz({
        title,
        material_id: matId,
        topic_id: topicId,
        difficulty: "easy",
        questions
      });
      State.toast("Quiz saved to your library!", "success");
      document.getElementById("bulk-quiz-modal").classList.add("hidden");
      if (State.currentView === "quizzes") this.applyFilters();
      if (andStart) {
        await this.startQuiz(created.id);
      }
    } catch (err) {
      State.toast(err.message || "Failed to save quiz", "error");
    }
  },

  openCreateModal() {
    const modal = document.getElementById("create-quiz-modal");
    if (modal) modal.classList.remove("hidden");
  },

  async deleteQuiz(id) {
    if (window.confirm("Are you sure you want to delete this quiz?")) {
      try {
        await API.deleteQuiz(id);
        State.toast("Quiz deleted", "info");
        this.applyFilters();
      } catch (err) {
        State.toast("Failed to delete quiz", "error");
      }
    }
  }
};
