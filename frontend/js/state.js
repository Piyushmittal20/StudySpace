/**
 * StudySpace Global State Management & Shared Utilities
 */
const State = {
  currentView: "dashboard",
  subjectsTree: [],
  activeMaterial: null,
  activeSectionIndex: 1,

  // Custom User-Configurable Stopwatch & Countdown Timer
  timer: {
    mode: "stopwatch", // 'stopwatch' or 'countdown'
    seconds: 0,
    targetMinutes: 25,
    remainingSeconds: 25 * 60,
    isRunning: false,
    intervalId: null
  },

  setSubjects(tree) {
    this.subjectsTree = tree || [];
    this.populateSubjectSelects();
  },

  populateSubjectSelects() {
    const selects = document.querySelectorAll(".subject-select-picker");
    selects.forEach(sel => {
      const currentVal = sel.value;
      const isFilter = sel.id && sel.id.includes("filter");
      sel.innerHTML = isFilter
        ? '<option value="">All Subjects</option>'
        : '<option value="">-- No Subject (Unassigned) --</option>';
      this.subjectsTree.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.name;
        sel.appendChild(opt);
      });
      if (currentVal) sel.value = currentVal;
    });
  },

  populateTopicSelect(subjectId, topicSelectEl, selectedTopicId = null) {
    if (!topicSelectEl) return;
    topicSelectEl.innerHTML = '<option value="">-- No Topic (Subject Level) --</option>';
    if (!subjectId) {
      topicSelectEl.disabled = true;
      return;
    }
    topicSelectEl.disabled = false;

    const sub = (this.subjectsTree || []).find(s => s.id === parseInt(subjectId));
    if (!sub || !sub.chapters || sub.chapters.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No topics in this subject yet";
      opt.disabled = true;
      topicSelectEl.appendChild(opt);
      return;
    }

    let foundAnyTopics = false;
    sub.chapters.forEach(c => {
      if (c.topics && c.topics.length > 0) {
        foundAnyTopics = true;
        const optgroup = document.createElement("optgroup");
        optgroup.label = `Chapter: ${c.name}`;
        c.topics.forEach(t => {
          const opt = document.createElement("option");
          opt.value = t.id;
          opt.textContent = t.name;
          if (selectedTopicId && parseInt(selectedTopicId) === t.id) {
            opt.selected = true;
          }
          optgroup.appendChild(opt);
        });
        topicSelectEl.appendChild(optgroup);
      }
    });

    if (!foundAnyTopics) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No topics created in chapters yet";
      opt.disabled = true;
      topicSelectEl.appendChild(opt);
    }

    if (selectedTopicId) {
      topicSelectEl.value = String(selectedTopicId);
    }
  },

  getTopicDetails(topicId) {
    if (!topicId) return null;
    const tid = parseInt(topicId);
    for (const s of (this.subjectsTree || [])) {
      for (const c of (s.chapters || [])) {
        for (const t of (c.topics || [])) {
          if (t.id === tid) {
            return {
              subjectId: s.id,
              subjectName: s.name,
              chapterId: c.id,
              chapterName: c.name,
              topicId: t.id,
              topicName: t.name
            };
          }
        }
      }
    }
    return null;
  },

  // Helper: Format byte size into readable string
  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  },

  // Helper: Format ISO date string into human friendly format
  formatDate(isoString) {
    if (!isoString) return "Never";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return isoString;
    }
  },

  // Helper: Format seconds into mm:ss or hh:mm:ss
  formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const pad = (n) => (n < 10 ? "0" + n : n);

    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  },

  // Helper: Escape HTML to prevent XSS
  escapeHTML(str) {
    if (!str) return "";
    return str.toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  // Helper: Renders clean, humanized, safe HTML from Markdown
  renderMarkdown(md) {
    if (!md) return "";

    // Strip any emoji characters to maintain clean professional styling
    let text = md.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}]/gu, '');

    // Escape raw HTML first
    let escaped = this.escapeHTML(text);

    // Headings
    escaped = escaped.replace(/^### (.*$)/gim, '<h4 class="font-bold text-[#172b4d] text-sm mt-3.5 mb-1 pb-1 border-b border-[#DCDFE4]/70">$1</h4>');
    escaped = escaped.replace(/^## (.*$)/gim, '<h3 class="font-bold text-[#172b4d] text-base mt-4 mb-2 pb-1 border-b border-[#DCDFE4]">$1</h3>');
    escaped = escaped.replace(/^# (.*$)/gim, '<h2 class="font-bold text-[#172b4d] text-lg mt-4 mb-2">$1</h2>');

    // Bold (**text** -> <strong>text</strong>)
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-[#172b4d]">$1</strong>');
    
    // Italics (*text* -> <em>text</em>)
    escaped = escaped.replace(/\*(.*?)\*/g, '<em class="text-[#44546f]">$1</em>');

    // Inline code (`code` -> <code>code</code>)
    escaped = escaped.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-[#F1F2F4] font-mono text-[11px] text-[#172b4d] border border-[#DCDFE4]">$1</code>');

    // Group bullet points into clean list items
    const lines = escaped.split('\n');
    let inList = false;
    let htmlLines = [];

    for (let line of lines) {
      const trimmed = line.trim();
      const bulletMatch = trimmed.match(/^[*-]\s+(.*)$/);
      if (bulletMatch) {
        if (!inList) {
          inList = true;
          htmlLines.push('<ul class="space-y-1.5 my-2.5 list-disc list-inside text-xs text-[#172b4d]">');
        }
        htmlLines.push(`<li class="leading-relaxed pl-1">${bulletMatch[1]}</li>`);
      } else {
        if (inList) {
          inList = false;
          htmlLines.push('</ul>');
        }
        if (trimmed.length > 0 && !trimmed.startsWith('<h')) {
          htmlLines.push(`<p class="leading-relaxed my-2 text-xs text-[#172b4d]">${trimmed}</p>`);
        } else if (trimmed.startsWith('<h')) {
          htmlLines.push(trimmed);
        }
      }
    }
    if (inList) {
      htmlLines.push('</ul>');
    }

    return htmlLines.join('\n');
  },

  // Helper: Toast notifications (Clean SVG indicators, no emojis)
  toast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    const colors = {
      success: "bg-emerald-50 text-emerald-800 border-emerald-200",
      error: "bg-rose-50 text-rose-800 border-rose-200",
      info: "bg-indigo-50 text-indigo-800 border-indigo-200",
      warning: "bg-amber-50 text-amber-800 border-amber-200"
    };

    const icons = {
      success: '<svg class="w-4 h-4 shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
      error: '<svg class="w-4 h-4 shrink-0 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
      info: '<svg class="w-4 h-4 shrink-0 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
      warning: '<svg class="w-4 h-4 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>'
    };

    toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-lg border shadow-md text-xs font-medium transition-all duration-300 transform translate-y-2 opacity-0 ${colors[type] || colors.info}`;
    toast.innerHTML = `${icons[type] || icons.info} <span>${this.escapeHTML(message)}</span>`;

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.remove("translate-y-2", "opacity-0");
    });

    setTimeout(() => {
      toast.classList.add("opacity-0", "translate-y-2");
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
};
