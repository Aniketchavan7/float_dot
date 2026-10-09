/**
 * @fileoverview AnswerView component for Float Dot (M01 Minimal Overlay UI).
 * Manages rendering the structured answer card, RAF streaming, syntax highlighting,
 * follow-up questioning, and expandable evidence.
 */

export class AnswerView {
  constructor({ onFollowUp, onCopy, onExport, onClear }) {
    this.onFollowUp = onFollowUp;
    this.onCopy = onCopy;
    this.onExport = onExport;
    this.onClear = onClear;

    this.$section = document.getElementById('answer-section');
    this.$answer = document.getElementById('answer');
    this.$answerState = document.getElementById('answer-state');
    this.$answerMeta = document.getElementById('answer-meta');
    this.$sessionBadge = document.getElementById('session-badge');
    this.$copyBtn = document.getElementById('copy');
    this.$exportBtn = document.getElementById('export');
    this.$clearBtn = document.getElementById('clear');
    this.$speakBtn = document.getElementById('speak');
    this.$followUpInput = document.getElementById('follow-up-input');
    this.$followUpSend = document.getElementById('follow-up-send');
    this.$followUpBtn = document.getElementById('follow-up');
    this.$reuseCapture = document.getElementById('reuse-capture');

    this.currentText = '';
    this.renderRaf = null;

    this.init();
  }

  init() {
    if (this.$copyBtn) {
      this.$copyBtn.addEventListener('click', () => {
        if (this.onCopy) this.onCopy(this.currentText);
      });
    }

    if (this.$exportBtn) {
      this.$exportBtn.addEventListener('click', () => {
        if (this.onExport) this.onExport(this.currentText);
      });
    }

    if (this.$clearBtn) {
      this.$clearBtn.addEventListener('click', () => {
        this.clear();
        if (this.onClear) this.onClear();
      });
    }

    // Follow-up send
    const submitFollowUp = () => {
      const q = this.$followUpInput?.value.trim();
      if (!q) return;
      if (this.onFollowUp) this.onFollowUp(q, this.$reuseCapture?.checked ?? true);
      if (this.$followUpInput) this.$followUpInput.value = '';
    };

    if (this.$followUpSend) {
      this.$followUpSend.addEventListener('click', submitFollowUp);
    }

    if (this.$followUpInput) {
      this.$followUpInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitFollowUp();
        }
      });
    }

    if (this.$followUpBtn) {
      this.$followUpBtn.addEventListener('click', () => {
        if (this.$followUpInput) {
          this.$followUpInput.focus();
        }
      });
    }
  }

  show(metadata = '') {
    if (this.$section) this.$section.hidden = false;
    if (this.$answerMeta) this.$answerMeta.textContent = metadata;
  }

  hide() {
    if (this.$section) this.$section.hidden = true;
  }

  clear() {
    this.currentText = '';
    if (this.$answer) this.$answer.innerHTML = '';
    if (this.$sessionBadge) this.$sessionBadge.hidden = true;
    if (this.$answerState) {
      this.$answerState.textContent = '';
      this.$answerState.dataset.complete = 'false';
    }
    this.hide();
  }

  setSessionBadge(turn) {
    if (!this.$sessionBadge) return;
    if (turn > 1) {
      this.$sessionBadge.textContent = `Turn ${turn} · Memory Active`;
      this.$sessionBadge.hidden = false;
    } else {
      this.$sessionBadge.textContent = 'Session Memory';
      this.$sessionBadge.hidden = false;
    }
  }

  setState(label, complete = false) {
    if (this.$answerState) {
      this.$answerState.textContent = label;
      this.$answerState.dataset.complete = String(complete);
    }
    if (this.$copyBtn) this.$copyBtn.disabled = !complete;
    if (this.$exportBtn) this.$exportBtn.disabled = !complete;
    if (this.$speakBtn) this.$speakBtn.disabled = !complete;
  }

  render(text, isFinal = false) {
    this.currentText = text;
    if (isFinal) {
      if (this.renderRaf) {
        cancelAnimationFrame(this.renderRaf);
        this.renderRaf = null;
      }
      this.doRender(true);
      return;
    }

    if (this.renderRaf) return;
    this.renderRaf = requestAnimationFrame(() => {
      this.renderRaf = null;
      this.doRender(false);
    });
  }

  doRender(isFinal = false) {
    if (!this.$answer) return;
    if (!this.currentText) {
      this.$answer.innerHTML = '';
      return;
    }

    const html = window.marked ? window.marked.parse(this.currentText, { breaks: true }) : this.currentText;
    const previousScroll = this.$answer.scrollTop;
    const atBottom = this.$answer.scrollHeight - previousScroll - this.$answer.clientHeight < 40;

    const sanitized = window.DOMPurify ? window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
      ALLOWED_ATTR: ['class']
    }) : html;

    this.$answer.innerHTML = sanitized;
    this.$answer.scrollTop = atBottom ? this.$answer.scrollHeight : previousScroll;

    if (isFinal && window.Prism) {
      window.Prism.highlightAllUnder(this.$answer);
    }
  }
}
