/**
 * Settings & System Diagnostics Controller
 * Handles study preferences, reading typography, timer defaults,
 * note exports, SQLite database backups, and health diagnostics.
 * Completely emoji-free, professional, clean layout.
 */
const Settings = {
  backups: [],

  defaultPreferences: {
    studentName: "Student",
    dailyTarget: "60",
    focusSubject: "",
    readerFontFamily: "sans",
    readerFontSize: "14",
    readerLineHeight: "1.75",
    readerAutoScroll: true,
    readerShowBadges: true,
    timerDefaultMode: "timer",
    timerDefaultMinutes: "25",
    timerSoundEnabled: true
  },

  getPreferences() {
    try {
      const stored = localStorage.getItem("studyspace_user_preferences");
      if (stored) {
        return { ...this.defaultPreferences, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn("Could not read preferences from localStorage:", e);
    }
    return { ...this.defaultPreferences };
  },

  setPreferences(newPrefs) {
    try {
      const current = this.getPreferences();
      const updated = { ...current, ...newPrefs };
      localStorage.setItem("studyspace_user_preferences", JSON.stringify(updated));
      this.applyPreferences(updated);
      return updated;
    } catch (e) {
      console.warn("Could not save preferences to localStorage:", e);
      return newPrefs;
    }
  },

  applyPreferences(prefs) {
    if (!prefs) prefs = this.getPreferences();

    // 1. Reading Typography (CSS variables on document root)
    const fontFamilies = {
      sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      serif: "Georgia, Cambria, 'Times New Roman', Times, serif",
      mono: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace"
    };

    const root = document.documentElement;
    if (root) {
      root.style.setProperty("--reader-font-family", fontFamilies[prefs.readerFontFamily] || fontFamilies.sans);
      root.style.setProperty("--reader-font-size", `${prefs.readerFontSize || 14}px`);
      root.style.setProperty("--reader-line-height", prefs.readerLineHeight || "1.75");
    }

    // 2. Timer widget defaults
    if (window.TimerWidget) {
      if (prefs.timerDefaultMinutes) {
        const mins = parseInt(prefs.timerDefaultMinutes, 10);
        if (!TimerWidget.isRunning && TimerWidget.targetMinutes !== mins) {
          TimerWidget.targetMinutes = mins;
          TimerWidget.remainingSeconds = mins * 60;
          TimerWidget.updateDisplays();
        }
      }
      TimerWidget.soundEnabled = prefs.timerSoundEnabled !== false;
    }
  },

  async load() {
    // Apply preferences immediately on load
    const prefs = this.getPreferences();
    this.applyPreferences(prefs);
    this.populatePreferenceInputs(prefs);
    this.updateReadingPreview();

    try {
      const [health, backups] = await Promise.all([
        API.getHealth(),
        API.getBackups()
      ]);

      this.backups = backups || [];
      this.renderHealthDiagnostics(health);
      this.renderBackupsList();
    } catch (err) {
      console.error("Failed to load settings data:", err);
      State.toast("Failed to load some diagnostics items.", "error");
    }
  },

  populatePreferenceInputs(prefs) {
    // 1. Profile inputs
    const nameInput = document.getElementById("pref-student-name");
    const targetSelect = document.getElementById("pref-daily-target");
    const subjectSelect = document.getElementById("pref-focus-subject");

    if (nameInput) nameInput.value = prefs.studentName || "";
    if (targetSelect) targetSelect.value = prefs.dailyTarget || "60";
    if (subjectSelect && prefs.focusSubject) subjectSelect.value = prefs.focusSubject;

    // 2. Reading inputs
    const fontSelect = document.getElementById("pref-reader-font-family");
    const sizeSelect = document.getElementById("pref-reader-font-size");
    const lineSelect = document.getElementById("pref-reader-line-height");
    const autoScrollCheck = document.getElementById("pref-reader-autoscroll");
    const showBadgesCheck = document.getElementById("pref-reader-show-badges");

    if (fontSelect) fontSelect.value = prefs.readerFontFamily || "sans";
    if (sizeSelect) sizeSelect.value = prefs.readerFontSize || "14";
    if (lineSelect) lineSelect.value = prefs.readerLineHeight || "1.75";
    if (autoScrollCheck) autoScrollCheck.checked = prefs.readerAutoScroll !== false;
    if (showBadgesCheck) showBadgesCheck.checked = prefs.readerShowBadges !== false;

    // 3. Timer inputs
    const timerModeSelect = document.getElementById("pref-timer-default-mode");
    const timerMinsSelect = document.getElementById("pref-timer-default-minutes");
    const timerSoundCheck = document.getElementById("pref-timer-sound-enabled");

    if (timerModeSelect) timerModeSelect.value = prefs.timerDefaultMode || "timer";
    if (timerMinsSelect) timerMinsSelect.value = prefs.timerDefaultMinutes || "25";
    if (timerSoundCheck) timerSoundCheck.checked = prefs.timerSoundEnabled !== false;
  },

  updateReadingPreview() {
    const preview = document.getElementById("reader-live-preview-text");
    const fontSelect = document.getElementById("pref-reader-font-family");
    const sizeSelect = document.getElementById("pref-reader-font-size");
    const lineSelect = document.getElementById("pref-reader-line-height");

    if (!preview) return;

    const fontFamilies = {
      sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      serif: "Georgia, Cambria, 'Times New Roman', Times, serif",
      mono: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace"
    };

    const font = fontSelect ? fontSelect.value : "sans";
    const size = sizeSelect ? sizeSelect.value : "14";
    const line = lineSelect ? lineSelect.value : "1.75";

    preview.style.fontFamily = fontFamilies[font] || fontFamilies.sans;
    preview.style.fontSize = `${size}px`;
    preview.style.lineHeight = line;
  },

  saveProfileSettings(e) {
    if (e) e.preventDefault();
    const name = document.getElementById("pref-student-name")?.value.trim() || "Student";
    const target = document.getElementById("pref-daily-target")?.value || "60";
    const subject = document.getElementById("pref-focus-subject")?.value || "";

    this.setPreferences({
      studentName: name,
      dailyTarget: target,
      focusSubject: subject
    });

    State.toast("Profile and daily study target saved", "success");
  },

  saveReadingSettings(e) {
    if (e) e.preventDefault();
    const font = document.getElementById("pref-reader-font-family")?.value || "sans";
    const size = document.getElementById("pref-reader-font-size")?.value || "14";
    const line = document.getElementById("pref-reader-line-height")?.value || "1.75";
    const autoScroll = document.getElementById("pref-reader-autoscroll")?.checked !== false;
    const showBadges = document.getElementById("pref-reader-show-badges")?.checked !== false;

    this.setPreferences({
      readerFontFamily: font,
      readerFontSize: size,
      readerLineHeight: line,
      readerAutoScroll: autoScroll,
      readerShowBadges: showBadges
    });

    this.updateReadingPreview();
    State.toast("Reading preferences applied to Study Room", "success");
  },

  saveTimerSettings(e) {
    if (e) e.preventDefault();
    const mode = document.getElementById("pref-timer-default-mode")?.value || "timer";
    const minutes = document.getElementById("pref-timer-default-minutes")?.value || "25";
    const sound = document.getElementById("pref-timer-sound-enabled")?.checked !== false;

    this.setPreferences({
      timerDefaultMode: mode,
      timerDefaultMinutes: minutes,
      timerSoundEnabled: sound
    });

    State.toast("Timer preferences saved", "success");
  },

  testChimeSound() {
    try {
      if (window.TimerWidget && typeof TimerWidget.playChime === "function") {
        TimerWidget.playChime();
        State.toast("Chime sound played", "info");
        return;
      }

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        State.toast("Web Audio not supported by this browser", "warning");
        return;
      }
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.9);
      State.toast("Chime sound played", "info");
    } catch (err) {
      console.warn("Could not play sound:", err);
      State.toast("Audio alert preview unavailable", "warning");
    }
  },

  async exportAllNotes() {
    State.toast("Compiling personal notes for export...", "info");
    try {
      const notes = await API.getNotes();
      if (!notes || notes.length === 0) {
        State.toast("No notes found to export", "info");
        return;
      }

      let markdown = `# StudySpace Personal Notes Export\n`;
      markdown += `Generated on: ${new Date().toLocaleString()}\n`;
      markdown += `Total Notes: ${notes.length}\n\n`;
      markdown += `---\n\n`;

      notes.forEach((n, idx) => {
        markdown += `## ${idx + 1}. ${n.title}\n`;
        markdown += `- **Subject**: ${n.subject_name || "General"}\n`;
        if (n.topic_name) markdown += `- **Topic**: ${n.topic_name}\n`;
        if (n.material_title) markdown += `- **Linked Material**: ${n.material_title}\n`;
        markdown += `- **Last Modified**: ${new Date(n.updated_at).toLocaleString()}\n\n`;
        markdown += `### Content\n\n${n.content || "*(Empty note)*"}\n\n`;
        markdown += `---\n\n`;
      });

      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `StudySpace_Notes_${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      State.toast("Notes exported successfully!", "success");
    } catch (err) {
      console.error("Export notes failed:", err);
      State.toast("Failed to export notes", "error");
    }
  },

  async exportCurriculumMetadata() {
    State.toast("Preparing curriculum summary...", "info");
    try {
      const [subjects, stats] = await Promise.all([
        API.getSubjects(),
        API.getProgressStats()
      ]);

      const payload = {
        exported_at: new Date().toISOString(),
        summary: stats,
        curriculum: subjects
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `StudySpace_Curriculum_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      State.toast("Curriculum exported successfully!", "success");
    } catch (err) {
      console.error("Export curriculum failed:", err);
      State.toast("Failed to export curriculum", "error");
    }
  },

  resetToDefaults() {
    const confirmed = window.confirm("Reset all study, reading, and timer preferences to defaults?");
    if (confirmed) {
      localStorage.removeItem("studyspace_user_preferences");
      this.populatePreferenceInputs(this.defaultPreferences);
      this.applyPreferences(this.defaultPreferences);
      this.updateReadingPreview();
      State.toast("Preferences reset to defaults", "info");
    }
  },

  renderHealthDiagnostics(health) {
    const el = document.getElementById("settings-diagnostics-container");
    if (!el) return;

    el.innerHTML = `
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div class="p-3 bg-[#F7F8F9] rounded-lg border border-[#DCDFE4]">
          <span class="text-[#626f86] block text-xs uppercase font-medium">Database</span>
          <span class="font-semibold text-sm ${health.database_connected ? 'text-emerald-700' : 'text-rose-700'}">
            ${health.database_connected ? 'Connected (SQLite)' : 'Disconnected'}
          </span>
        </div>
        <div class="p-3 bg-[#F7F8F9] rounded-lg border border-[#DCDFE4]">
          <span class="text-[#626f86] block text-xs uppercase font-medium">Storage Used</span>
          <span class="font-semibold text-sm text-[#172b4d]">${health.data_dir_size_mb} MB</span>
        </div>
        <div class="p-3 bg-[#F7F8F9] rounded-lg border border-[#DCDFE4]">
          <span class="text-[#626f86] block text-xs uppercase font-medium">Study Materials</span>
          <span class="font-semibold text-sm text-[#172b4d]">${health.total_materials} documents</span>
        </div>
        <div class="p-3 bg-[#F7F8F9] rounded-lg border border-[#DCDFE4]">
          <span class="text-[#626f86] block text-xs uppercase font-medium">App Engine</span>
          <span class="font-semibold text-sm text-[#172b4d]">v${health.version} (Active)</span>
        </div>
      </div>
    `;
  },

  renderBackupsList() {
    const listEl = document.getElementById("backups-list-container");
    if (!listEl) return;

    if (this.backups.length === 0) {
      listEl.innerHTML = `
        <p class="text-xs text-[#626f86] italic py-4">No backup archives created yet.</p>
      `;
      return;
    }

    listEl.innerHTML = this.backups.map(b => `
      <div class="flex items-center justify-between p-3 rounded-lg border border-[#DCDFE4] hover:bg-[#F1F2F4] text-xs transition">
        <div>
          <span class="font-semibold text-[#172b4d] text-sm block">${State.escapeHTML(b.filename)}</span>
          <span class="text-xs text-[#626f86]">${b.size_mb} MB • Created ${State.formatDate(b.created_at)}</span>
        </div>
        <div class="flex items-center gap-2">
          <a href="/api/system/backup/${encodeURIComponent(b.filename)}/download" download
             class="px-2.5 py-1 rounded bg-[#F1F2F4] hover:bg-slate-200 text-[#172b4d] font-medium text-xs transition cursor-pointer">
            Download
          </a>
          <button onclick="Settings.confirmRestore('${State.escapeHTML(b.filename)}')"
            class="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium text-xs transition cursor-pointer">
            Restore
          </button>
        </div>
      </div>
    `).join('');
  },

  async createBackup() {
    State.toast("Creating local backup archive...", "info");
    try {
      const res = await API.createBackup();
      State.toast(res.message, "success");
      this.load();
    } catch (err) {
      State.toast(err.message || "Failed to create backup", "error");
    }
  },

  confirmRestore(filename) {
    const warning = `CAUTION: Restoring from '${filename}' will overwrite current study materials and notes with the backup contents. (A safety snapshot of your current data will be created first).\n\nDo you wish to proceed?`;
    if (window.confirm(warning)) {
      this.executeRestore(filename);
    }
  },

  async executeRestore(filename) {
    State.toast("Restoring backup archive...", "info");
    try {
      const res = await API.restoreBackup(filename, true);
      State.toast(res.message, "success");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      State.toast(err.message || "Failed to restore backup", "error");
    }
  }
};

// Initialize settings preferences immediately on script load
try {
  Settings.applyPreferences();
} catch (e) {}
