/**
 * StudySpace Dedicated Stopwatch & Study Timer Controller
 * Fully standalone and attached to window.TimerWidget for guaranteed global access.
 */
(function() {
  const TimerWidget = {
    mode: "timer", // Default to 'timer' so the user can immediately set their desired time
    targetMinutes: 25,
    remainingSeconds: 25 * 60,
    stopwatchSeconds: 0,
    isRunning: false,
    intervalId: null,

    init() {
      this.updateDisplays();
      this.bindEvents();
    },

    bindEvents() {
      // Attach click handler to top stopwatch button
      const topBtn = document.getElementById("top-stopwatch-btn");
      if (topBtn) {
        topBtn.onclick = (e) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          this.toggleModal();
        };
      }

      // Backdrop click closes modal
      const modal = document.getElementById("timer-settings-modal");
      if (modal) {
        modal.onclick = (e) => {
          if (e.target === modal) {
            this.closeModal();
          }
        };
      }
    },

    toggleModal() {
      const modal = document.getElementById("timer-settings-modal");
      if (!modal) return;

      const isHidden = modal.classList.contains("hidden") || modal.style.display === "none";
      if (isHidden) {
        this.openModal();
      } else {
        this.closeModal();
      }
    },

    openModal() {
      const modal = document.getElementById("timer-settings-modal");
      if (!modal) return;
      modal.classList.remove("hidden");
      modal.style.display = "flex";
      this.renderModalUI();
    },

    closeModal() {
      const modal = document.getElementById("timer-settings-modal");
      if (!modal) return;
      modal.classList.add("hidden");
      modal.style.display = "none";
    },

    setMode(newMode) {
      this.pause();
      if (newMode === "countdown") newMode = "timer";
      this.mode = newMode;
      if (newMode === "timer") {
        this.remainingSeconds = this.targetMinutes * 60;
      } else {
        this.stopwatchSeconds = 0;
      }
      this.updateDisplays();
      this.renderModalUI();
    },

    setPresetMinutes(mins) {
      this.pause();
      this.mode = "timer";
      this.targetMinutes = mins;
      this.remainingSeconds = mins * 60;

      const input = document.getElementById("timer-custom-minutes");
      if (input) input.value = mins;

      this.updateDisplays();
      this.renderModalUI();
    },

    setCustomMinutes(val) {
      const mins = Math.max(1, Math.min(720, parseInt(val, 10) || 1));
      this.pause();
      this.mode = "timer";
      this.targetMinutes = mins;
      this.remainingSeconds = mins * 60;

      const input = document.getElementById("timer-custom-minutes");
      if (input && document.activeElement !== input) {
        input.value = mins;
      }

      this.updateDisplays();
      this.renderModalUI();
    },

    start() {
      if (this.isRunning) return;
      this.isRunning = true;

      clearInterval(this.intervalId);
      this.intervalId = setInterval(() => {
        if (this.mode === "stopwatch") {
          this.stopwatchSeconds += 1;
        } else {
          if (this.remainingSeconds > 0) {
            this.remainingSeconds -= 1;
          } else {
            this.handleTimerComplete();
          }
        }
        this.updateDisplays();
      }, 1000);

      this.renderModalUI();
      this.updateDisplays();
    },

    pause() {
      this.isRunning = false;
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.renderModalUI();
      this.updateDisplays();
    },

    togglePlay() {
      if (this.isRunning) {
        this.pause();
      } else {
        this.start();
      }
    },

    reset() {
      this.pause();
      if (this.mode === "timer") {
        this.remainingSeconds = this.targetMinutes * 60;
      } else {
        this.stopwatchSeconds = 0;
      }
      this.updateDisplays();
      this.renderModalUI();
    },

    handleTimerComplete() {
      this.pause();
      this.playChime();
      if (window.State && window.State.toast) {
        window.State.toast("Time's up! Great study session completed.", "success");
      }
    },

    playChime() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.8);
      } catch (err) {
        console.warn("Audio chime notice:", err);
      }
    },

    formatTime(totalSec) {
      const hrs = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      const pad = (n) => (n < 10 ? "0" + n : String(n));

      if (hrs > 0) {
        return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
      }
      return `${pad(mins)}:${pad(secs)}`;
    },

    updateDisplays() {
      const currentSeconds = (this.mode === "stopwatch") ? this.stopwatchSeconds : this.remainingSeconds;
      const timeStr = this.formatTime(currentSeconds);

      // Top Header Label
      const topLabel = document.getElementById("top-timer-display");
      if (topLabel) {
        const prefix = (this.mode === "stopwatch") ? "Stopwatch" : "Timer";
        topLabel.textContent = `${prefix}: ${timeStr}`;
      }

      // Modal Big Digits
      const modalDigits = document.getElementById("modal-timer-digits");
      if (modalDigits) {
        modalDigits.textContent = timeStr;
      }

      // Update Play/Pause button text & color in modal
      const playBtn = document.getElementById("modal-timer-start-btn");
      if (playBtn) {
        if (this.isRunning) {
          playBtn.textContent = "Pause";
          playBtn.className = "px-6 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs transition";
        } else {
          playBtn.textContent = "Start";
          playBtn.className = "px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition";
        }
      }
    },

    renderModalUI() {
      this.updateDisplays();

      const tabTimer = document.getElementById("timer-tab-countdown");
      const tabStopwatch = document.getElementById("timer-tab-stopwatch");
      const timerControls = document.getElementById("timer-countdown-controls");

      if (tabTimer && tabStopwatch && timerControls) {
        if (this.mode === "timer") {
          tabTimer.className = "pb-2 border-b-2 border-indigo-600 font-bold text-indigo-600 text-xs transition cursor-pointer";
          tabStopwatch.className = "pb-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800 text-xs transition cursor-pointer";
          timerControls.classList.remove("hidden");
          timerControls.style.display = "block";
        } else {
          tabStopwatch.className = "pb-2 border-b-2 border-indigo-600 font-bold text-indigo-600 text-xs transition cursor-pointer";
          tabTimer.className = "pb-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800 text-xs transition cursor-pointer";
          timerControls.classList.add("hidden");
          timerControls.style.display = "none";
        }
      }

      // Highlight active preset button if any
      [5, 15, 25, 45, 60].forEach(m => {
        const btn = document.getElementById(`timer-preset-${m}`);
        if (btn) {
          if (this.mode === "timer" && this.targetMinutes === m) {
            btn.className = "py-1.5 rounded-lg bg-indigo-50 border border-indigo-300 text-indigo-700 font-bold text-xs transition";
          } else {
            btn.className = "py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs transition";
          }
        }
      });
    }
  };

  // Expose directly on window for guaranteed global access
  window.TimerWidget = TimerWidget;

  // Initialize on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => TimerWidget.init());
  } else {
    TimerWidget.init();
  }
})();
