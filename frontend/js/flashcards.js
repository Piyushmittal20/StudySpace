/**
 * Flashcards & Spaced Repetition Controller
 * Interactive 3D flip study mode, Again/Hard/Good/Easy SRS grading, deck filtering.
 */
const Flashcards = {
  cards: [],
  reviewQueue: [],
  currentReviewIndex: 0,
  isAnswerRevealed: false,

  async load(options = {}) {
    await this.applyFilters(options);
  },

  async applyFilters(options = {}) {
    const dueOnly = options.filter === "due" || document.getElementById("flashcards-due-filter")?.checked;
    const topicId = options.topicId || document.getElementById("flashcards-topic-filter")?.value;

    try {
      this.cards = await API.getFlashcards({
        due_only: dueOnly,
        topic_id: topicId ? parseInt(topicId) : undefined
      });
      this.renderDeck();
    } catch (err) {
      console.error("Failed to load flashcards:", err);
      State.toast("Failed to load flashcards.", "error");
    }
  },

  renderDeck() {
    const container = document.getElementById("flashcards-container");
    const countBadge = document.getElementById("flashcards-count-badge");
    if (!container) return;

    if (countBadge) {
      countBadge.textContent = `${this.cards.length} card${this.cards.length === 1 ? '' : 's'}`;
    }

    if (this.cards.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center bg-white rounded-xl border border-slate-200/80 p-8">
          <div class="text-3xl mb-2">⚡</div>
          <h4 class="font-bold text-slate-700 text-sm">No flashcards found</h4>
          <p class="text-xs text-slate-400 mt-1">Create flashcards manually or generate them using AI from your study materials.</p>
          <button onclick="Flashcards.openCreateModal()" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition">
            + New Flashcard
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.cards.map(card => `
      <div class="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:border-indigo-300 transition flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-3 text-xs">
            <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold uppercase">
              ${card.tag || 'General'}
            </span>
            <span class="text-slate-400">
              Next: ${State.formatDate(card.next_review_at)}
            </span>
          </div>

          <p class="font-bold text-slate-800 text-xs mb-2">Q: ${State.escapeHTML(card.question)}</p>
          <p class="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            A: ${State.escapeHTML(card.answer)}
          </p>
        </div>

        <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>Repetitions: ${card.repetition_count}</span>
          <div class="flex items-center gap-1">
            <button onclick="Flashcards.editCard(${card.id})" title="Edit" class="p-1 hover:text-slate-600">✎</button>
            <button onclick="Flashcards.deleteCard(${card.id})" title="Delete" class="p-1 hover:text-rose-600">🗑</button>
          </div>
        </div>
      </div>
    `).join('');
  },

  // ---------------- Interactive Study Mode ----------------
  startStudyMode() {
    if (this.cards.length === 0) {
      State.toast("No flashcards available in this deck to practice.", "warning");
      return;
    }

    this.reviewQueue = [...this.cards];
    this.currentReviewIndex = 0;
    this.isAnswerRevealed = false;

    const overlay = document.getElementById("flashcard-study-overlay");
    if (overlay) {
      overlay.classList.remove("hidden");
      this.renderCurrentReviewCard();
    }
  },

  closeStudyMode() {
    const overlay = document.getElementById("flashcard-study-overlay");
    if (overlay) overlay.classList.add("hidden");
    this.applyFilters();
  },

  renderCurrentReviewCard() {
    if (this.currentReviewIndex >= this.reviewQueue.length) {
      this.renderReviewCompleted();
      return;
    }

    const card = this.reviewQueue[this.currentReviewIndex];
    const cardInner = document.getElementById("study-card-inner");
    const questionText = document.getElementById("study-card-question");
    const answerText = document.getElementById("study-card-answer");
    const progressText = document.getElementById("study-progress-indicator");
    const ratingButtons = document.getElementById("study-rating-buttons");
    const flipButton = document.getElementById("study-flip-button");

    this.isAnswerRevealed = false;
    if (cardInner) cardInner.classList.remove("flipped");

    if (progressText) {
      progressText.textContent = `Card ${this.currentReviewIndex + 1} of ${this.reviewQueue.length}`;
    }
    if (questionText) questionText.textContent = card.question;
    if (answerText) answerText.textContent = card.answer;

    if (ratingButtons) ratingButtons.classList.add("hidden");
    if (flipButton) flipButton.classList.remove("hidden");
  },

  flipCard() {
    const cardInner = document.getElementById("study-card-inner");
    const ratingButtons = document.getElementById("study-rating-buttons");
    const flipButton = document.getElementById("study-flip-button");

    this.isAnswerRevealed = true;
    if (cardInner) cardInner.classList.add("flipped");
    if (flipButton) flipButton.classList.add("hidden");
    if (ratingButtons) ratingButtons.classList.remove("hidden");
  },

  async submitReviewRating(rating) {
    const card = this.reviewQueue[this.currentReviewIndex];
    if (!card) return;

    try {
      await API.reviewFlashcard(card.id, rating);
      this.currentReviewIndex += 1;
      this.renderCurrentReviewCard();
    } catch (err) {
      State.toast("Failed to record review", "error");
    }
  },

  renderReviewCompleted() {
    const body = document.getElementById("study-card-body");
    if (!body) return;
    body.innerHTML = `
      <div class="p-10 text-center">
        <div class="text-4xl mb-3">🎉</div>
        <h3 class="text-lg font-bold text-slate-800">Practice Session Complete!</h3>
        <p class="text-xs text-slate-500 mt-1">You reviewed ${this.reviewQueue.length} cards. The spaced repetition schedule has been updated.</p>
        <button onclick="Flashcards.closeStudyMode()" class="mt-5 px-5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition">
          Return to Deck
        </button>
      </div>
    `;
  },

  // ---------------- Modals ----------------
  openCreateModal() {
    const modal = document.getElementById("create-flashcard-modal");
    if (modal) modal.classList.remove("hidden");
  },

  async submitCreate(e) {
    e.preventDefault();
    const q = document.getElementById("new-fc-question").value.trim();
    const a = document.getElementById("new-fc-answer").value.trim();
    const tag = document.getElementById("new-fc-tag").value.trim();
    const topicId = document.getElementById("new-fc-topic")?.value;

    if (!q || !a) return;

    try {
      await API.createFlashcard({
        question: q,
        answer: a,
        tag: tag,
        topic_id: topicId ? parseInt(topicId) : undefined
      });
      State.toast("Flashcard created", "success");
      document.getElementById("create-flashcard-modal").classList.add("hidden");
      this.applyFilters();
    } catch (err) {
      State.toast(err.message || "Failed to create card", "error");
    }
  },

  openBulkReviewModal(draftCards, materialId, topicId) {
    const modal = document.getElementById("bulk-flashcards-modal");
    const container = document.getElementById("bulk-flashcards-list");
    if (!modal || !container) return;

    window._draftCards = draftCards;
    window._draftMatId = materialId;
    window._draftTopicId = topicId;

    container.innerHTML = draftCards.map((c, i) => `
      <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
        <input type="text" id="draft-q-${i}" value="${State.escapeHTML(c.question)}" class="w-full font-bold p-1.5 rounded border border-slate-200">
        <textarea id="draft-a-${i}" class="w-full p-1.5 rounded border border-slate-200 text-xs">${State.escapeHTML(c.answer)}</textarea>
        <input type="text" id="draft-t-${i}" value="${State.escapeHTML(c.tag || '')}" placeholder="Tag" class="w-full p-1 rounded border border-slate-200 text-xs">
      </div>
    `).join('');

    modal.classList.remove("hidden");
  },

  async saveBulkFlashcards() {
    const drafts = window._draftCards || [];
    const matId = window._draftMatId;
    const topicId = window._draftTopicId;

    try {
      for (let i = 0; i < drafts.length; i++) {
        const q = document.getElementById(`draft-q-${i}`)?.value.trim();
        const a = document.getElementById(`draft-a-${i}`)?.value.trim();
        const tag = document.getElementById(`draft-t-${i}`)?.value.trim();
        if (q && a) {
          await API.createFlashcard({
            question: q,
            answer: a,
            tag: tag || "AI Generated",
            material_id: matId,
            topic_id: topicId
          });
        }
      }
      State.toast(`Saved ${drafts.length} flashcards to library!`, "success");
      document.getElementById("bulk-flashcards-modal").classList.add("hidden");
      if (State.currentView === "flashcards") this.applyFilters();
    } catch (err) {
      State.toast("Failed to save draft flashcards", "error");
    }
  },

  async deleteCard(id) {
    if (window.confirm("Delete this flashcard?")) {
      try {
        await API.deleteFlashcard(id);
        State.toast("Flashcard deleted", "info");
        this.applyFilters();
      } catch (err) {
        State.toast("Failed to delete card", "error");
      }
    }
  }
};
