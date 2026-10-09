/**
 * @fileoverview Overlay controller for Float Dot (M01 Minimal Overlay UI).
 * Manages toolbar capsule, working/idle states, overflow menu, opacity, and accessibility.
 */

export class OverlayController {
  constructor({ onModeChange, onSourceChange, onOpacityChange }) {
    this.onModeChange = onModeChange;
    this.onSourceChange = onSourceChange;
    this.onOpacityChange = onOpacityChange;

    this.$panel = document.getElementById('panel');
    this.$status = document.getElementById('status');
    this.$statusText = document.getElementById('status-text');
    this.$recWave = document.getElementById('rec-wave');
    this.$quickPrompt = document.getElementById('quick-prompt');
    this.$overflowMenu = document.getElementById('overflow-menu');
    this.$overflowToggle = document.getElementById('overflow-toggle');
    this.$opacitySlider = document.getElementById('opacity-slider');
    this.$opacityValue = document.getElementById('opacity-value');
    this.$opaqueToggle = document.getElementById('opaque-toggle');
    this.$error = document.getElementById('error');

    this.currentMode = 'general';
    this.init();
  }

  init() {
    // Overflow menu toggle
    if (this.$overflowToggle && this.$overflowMenu) {
      this.$overflowToggle.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = !this.$overflowMenu.hidden;
        this.$overflowMenu.hidden = isOpen;
        this.$overflowToggle.setAttribute('aria-expanded', String(!isOpen));
      });

      // Close overflow when clicking outside
      document.addEventListener('click', e => {
        if (!this.$overflowMenu.hidden && !this.$overflowMenu.contains(e.target) && e.target !== this.$overflowToggle) {
          this.$overflowMenu.hidden = true;
          this.$overflowToggle.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Mode tabs inside overflow
    const modeTabs = document.querySelectorAll('.mode-tab');
    modeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.mode;
        this.setMode(mode);
        if (this.onModeChange) this.onModeChange(mode);
      });
    });

    // Opacity slider
    if (this.$opacitySlider) {
      const savedOpacity = localStorage.getItem('floatdot_opacity') || '88';
      this.setOpacity(parseInt(savedOpacity, 10));
      this.$opacitySlider.value = savedOpacity;

      this.$opacitySlider.addEventListener('input', e => {
        const val = parseInt(e.target.value, 10);
        this.setOpacity(val);
        localStorage.setItem('floatdot_opacity', String(val));
        if (this.onOpacityChange) this.onOpacityChange(val);
      });
    }

    // Opaque accessibility toggle
    if (this.$opaqueToggle) {
      const savedOpaque = localStorage.getItem('floatdot_opaque') === 'true';
      this.$opaqueToggle.checked = savedOpaque;
      this.setOpaque(savedOpaque);

      this.$opaqueToggle.addEventListener('change', e => {
        const isOpaque = e.target.checked;
        this.setOpaque(isOpaque);
        localStorage.setItem('floatdot_opaque', String(isOpaque));
      });
    }

    // Escape key handling
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (this.$overflowMenu && !this.$overflowMenu.hidden) {
          this.$overflowMenu.hidden = true;
          this.$overflowToggle.setAttribute('aria-expanded', 'false');
          e.preventDefault();
        }
      }
    });
  }

  setMode(mode) {
    this.currentMode = mode;
    document.querySelectorAll('.mode-tab').forEach(tab => {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
  }

  setOpacity(percentage) {
    const clamped = Math.max(30, Math.min(100, percentage));
    if (this.$opacityValue) this.$opacityValue.textContent = `${clamped}%`;
    const alpha = (clamped / 100).toFixed(2);
    document.documentElement.style.setProperty('--glass-alpha', alpha);
    document.documentElement.style.setProperty('--bg-glass', `rgba(16, 19, 26, ${alpha})`);
  }

  setOpaque(isOpaque) {
    document.documentElement.classList.toggle('opaque-surface', isOpaque);
    if (isOpaque) {
      document.documentElement.style.setProperty('--bg-glass', '#10131a');
      document.documentElement.style.setProperty('--blur-amt', '0px');
    } else {
      const saved = parseInt(localStorage.getItem('floatdot_opacity') || '88', 10);
      this.setOpacity(saved);
      document.documentElement.style.setProperty('--blur-amt', '28px');
    }
  }

  setState(label, kind = 'idle') {
    document.body.dataset.state = kind;
    if (this.$statusText) this.$statusText.textContent = label;

    const isWorking = kind === 'recording' || kind === 'busy' || kind === 'capturing';
    if (this.$status) this.$status.hidden = !isWorking;
    if (this.$quickPrompt) this.$quickPrompt.hidden = isWorking;
    if (this.$recWave) this.$recWave.hidden = kind !== 'recording';
  }

  showError(message, recoveryAction = null, onRecover = null) {
    if (!this.$error) return;
    this.$error.replaceChildren();

    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    this.$error.appendChild(textSpan);

    if (recoveryAction && onRecover) {
      const btn = document.createElement('button');
      btn.className = 'error-recovery-btn';
      btn.textContent = recoveryAction;
      btn.addEventListener('click', onRecover);
      this.$error.appendChild(btn);
    }

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'error-dismiss-btn';
    dismissBtn.textContent = '✕';
    dismissBtn.title = 'Dismiss';
    dismissBtn.addEventListener('click', () => this.hideError());
    this.$error.appendChild(dismissBtn);

    this.$error.hidden = false;
    this.setState('Needs attention', 'error');
  }

  hideError() {
    if (this.$error) this.$error.hidden = true;
  }
}
