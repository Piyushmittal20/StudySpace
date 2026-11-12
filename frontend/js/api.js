/**
 * StudySpace Central API Client
 * Wraps all backend REST endpoints with clean error handling and JSON serialization.
 */
const API = {
  baseUrl: "/api",

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = options.headers || {};

    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    try {
      const response = await fetch(url, { ...options, headers });
      
      // If 204 No Content
      if (response.status === 204) {
        return null;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.detail || data.message || `Request failed with status ${response.status}`;
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  },

  // ---------------- Health & Diagnostics ----------------
  getHealth() {
    return this.request("/health");
  },

  // ---------------- Subjects & Topics ----------------
  getSubjects() {
    return this.request("/subjects");
  },
  createSubject(data) {
    return this.request("/subjects", { method: "POST", body: JSON.stringify(data) });
  },
  updateSubject(id, data) {
    return this.request(`/subjects/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  deleteSubject(id, action = "unassign") {
    return this.request(`/subjects/${id}`, { method: "DELETE", body: JSON.stringify({ action }) });
  },

  createChapter(data) {
    return this.request("/subjects/chapters", { method: "POST", body: JSON.stringify(data) });
  },
  updateChapter(id, data) {
    return this.request(`/subjects/chapters/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  deleteChapter(id, action = "unassign") {
    return this.request(`/subjects/chapters/${id}`, { method: "DELETE", body: JSON.stringify({ action }) });
  },

  createTopic(data) {
    return this.request("/subjects/topics", { method: "POST", body: JSON.stringify(data) });
  },
  updateTopic(id, data) {
    return this.request(`/subjects/topics/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  toggleTopicComplete(id) {
    return this.request(`/subjects/topics/${id}/toggle-complete`, { method: "POST" });
  },
  deleteTopic(id, action = "unassign") {
    return this.request(`/subjects/topics/${id}`, { method: "DELETE", body: JSON.stringify({ action }) });
  },

  // ---------------- Materials ----------------
  getMaterials(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append("search", params.search);
    if (params.subject_id) query.append("subject_id", params.subject_id);
    if (params.topic_id) query.append("topic_id", params.topic_id);
    if (params.source_type) query.append("source_type", params.source_type);
    if (params.is_favorite !== undefined) query.append("is_favorite", params.is_favorite);
    if (params.sort_by) query.append("sort_by", params.sort_by);

    const queryString = query.toString();
    return this.request(`/materials${queryString ? "?" + queryString : ""}`);
  },
  getMaterial(id) {
    return this.request(`/materials/${id}`);
  },
  uploadMaterial(formData) {
    return this.request("/materials/upload", { method: "POST", body: formData });
  },
  importUrlMaterial(data) {
    return this.request("/materials/import-url", { method: "POST", body: JSON.stringify(data) });
  },
  updateMaterial(id, data) {
    return this.request(`/materials/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  deleteMaterial(id) {
    return this.request(`/materials/${id}`, { method: "DELETE" });
  },
  addBookmark(materialId, data) {
    return this.request(`/materials/${materialId}/bookmarks`, { method: "POST", body: JSON.stringify(data) });
  },
  deleteBookmark(id) {
    return this.request(`/materials/bookmarks/${id}`, { method: "DELETE" });
  },

  // ---------------- Notes ----------------
  getNotes(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append("search", params.search);
    if (params.subject_id) query.append("subject_id", params.subject_id);
    if (params.topic_id) query.append("topic_id", params.topic_id);
    if (params.material_id) query.append("material_id", params.material_id);
    if (params.is_pinned !== undefined) query.append("is_pinned", params.is_pinned);

    const queryString = query.toString();
    return this.request(`/notes${queryString ? "?" + queryString : ""}`);
  },
  getNote(id) {
    return this.request(`/notes/${id}`);
  },
  createNote(data) {
    return this.request("/notes", { method: "POST", body: JSON.stringify(data) });
  },
  updateNote(id, data) {
    return this.request(`/notes/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  deleteNote(id) {
    return this.request(`/notes/${id}`, { method: "DELETE" });
  },
  convertNoteToFlashcard(id) {
    return this.request(`/notes/${id}/to-flashcard`, { method: "POST" });
  },

  // ---------------- Flashcards ----------------
  getFlashcards(params = {}) {
    const query = new URLSearchParams();
    if (params.topic_id) query.append("topic_id", params.topic_id);
    if (params.material_id) query.append("material_id", params.material_id);
    if (params.due_only) query.append("due_only", "true");
    if (params.tag) query.append("tag", params.tag);

    const queryString = query.toString();
    return this.request(`/flashcards${queryString ? "?" + queryString : ""}`);
  },
  createFlashcard(data) {
    return this.request("/flashcards", { method: "POST", body: JSON.stringify(data) });
  },
  updateFlashcard(id, data) {
    return this.request(`/flashcards/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  deleteFlashcard(id) {
    return this.request(`/flashcards/${id}`, { method: "DELETE" });
  },
  reviewFlashcard(id, rating) {
    return this.request(`/flashcards/${id}/review`, { method: "POST", body: JSON.stringify({ rating }) });
  },

  // ---------------- Quizzes ----------------
  getQuizzes(params = {}) {
    const query = new URLSearchParams();
    if (params.topic_id) query.append("topic_id", params.topic_id);
    if (params.material_id) query.append("material_id", params.material_id);

    const queryString = query.toString();
    return this.request(`/quizzes${queryString ? "?" + queryString : ""}`);
  },
  getQuiz(id) {
    return this.request(`/quizzes/${id}`);
  },
  createQuiz(data) {
    return this.request("/quizzes", { method: "POST", body: JSON.stringify(data) });
  },
  submitQuizAttempt(id, answers) {
    return this.request(`/quizzes/${id}/attempt`, { method: "POST", body: JSON.stringify({ answers }) });
  },
  getQuizAttempts(id) {
    return this.request(`/quizzes/${id}/attempts`);
  },
  deleteQuiz(id) {
    return this.request(`/quizzes/${id}`, { method: "DELETE" });
  },

  // ---------------- Progress & Sessions ----------------
  getProgressStats() {
    return this.request("/progress/stats");
  },
  startStudySession(data) {
    return this.request("/progress/session/start", { method: "POST", body: JSON.stringify(data) });
  },
  endStudySession(sessionId) {
    return this.request("/progress/session/end", { method: "POST", body: JSON.stringify({ session_id: sessionId }) });
  },

  // ---------------- Global Search ----------------
  search(query, entityType = null, subjectId = null) {
    const params = new URLSearchParams({ q: query });
    if (entityType) params.append("entity_type", entityType);
    if (subjectId) params.append("subject_id", subjectId);
    return this.request(`/search?${params.toString()}`);
  },

  // ---------------- AI Tools ----------------
  getAIStatus() {
    return this.request("/ai/status");
  },
  aiExplain(data) {
    return this.request("/ai/explain", { method: "POST", body: JSON.stringify(data) });
  },
  aiSummary(data) {
    return this.request("/ai/summary", { method: "POST", body: JSON.stringify(data) });
  },
  aiAskQuestion(data) {
    return this.request("/ai/ask", { method: "POST", body: JSON.stringify(data) });
  },
  aiGenerateFlashcards(data) {
    return this.request("/ai/generate-flashcards", { method: "POST", body: JSON.stringify(data) });
  },
  aiGenerateQuiz(data) {
    return this.request("/ai/generate-quiz", { method: "POST", body: JSON.stringify(data) });
  },

  // ---------------- Calendar Events & Milestones ----------------
  getCalendarEvents(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/calendar/events${qs ? `?${qs}` : ""}`);
  },
  createCalendarEvent(data) {
    return this.request("/calendar/events", { method: "POST", body: JSON.stringify(data) });
  },
  getCalendarEvent(id) {
    return this.request(`/calendar/events/${id}`);
  },
  updateCalendarEvent(id, data) {
    return this.request(`/calendar/events/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  deleteCalendarEvent(id) {
    return this.request(`/calendar/events/${id}`, { method: "DELETE" });
  },

  // ---------------- System & Backups ----------------
  getBackups() {
    return this.request("/system/backups");
  },
  createBackup() {
    return this.request("/system/backup", { method: "POST" });
  },
  restoreBackup(filename, confirm = true) {
    return this.request("/system/restore", { method: "POST", body: JSON.stringify({ filename, confirm }) });
  },
  updateAISettings(data) {
    return this.request("/system/ai-config", { method: "POST", body: JSON.stringify(data) });
  }
};
