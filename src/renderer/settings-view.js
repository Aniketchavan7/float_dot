/**
 * SettingsView — Float Dot Settings & First-Run Onboarding Controller (M07)
 * Manages provider settings, credential updates, connection testing, readiness indicators,
 * and first-run onboarding guidance.
 */
export class SettingsView {
  constructor({ call, state, error, resetError, onBeforeSave, onSave, onStatusChange }) {
    this.call = call;
    this.state = state;
    this.error = error;
    this.resetError = resetError;
    this.onBeforeSave = onBeforeSave;
    this.onSave = onSave;
    this.onStatusChange = onStatusChange;

    this.providerLabels = {
      ollama: 'Ollama · local',
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      gemini: 'Gemini',
      compatible: 'Custom API'
    };

    this.preferences = {};
    this.status = null;
    this.$ = id => document.getElementById(id);
  }

  init() {
    const $ = this.$;

    // Provider choice updates visible inputs
    $('provider')?.addEventListener('change', () => this.updateProviderFields());

    // Save provider & key
    $('save-provider')?.addEventListener('click', async () => {
      try {
        if (this.onBeforeSave) await this.onBeforeSave();
        const key = $('api-key')?.value;
        if ($('api-key')) $('api-key').value = '';
        const updated = await this.call('settings', {
          provider: $('provider').value,
          model: $('model').value.trim(),
          baseURL: $('provider').value === 'compatible' ? $('endpoint').value.trim() : '',
          sendImage: $('send-image')?.checked || false
        });
        if (key && updated.provider !== 'ollama') {
          await this.call('credentials', { key });
        }
        if (this.onSave) await this.onSave(updated);
        this.state(`Provider saved · ${this.describeProvider(updated)}`);
      } catch (err) {
        this.error(err.message);
      }
    });

    // Remove saved API key
    $('remove-key')?.addEventListener('click', async () => {
      try {
        if ($('provider').value !== this.preferences.provider) {
          throw new Error('Save the provider selection first.');
        }
        await this.call('credentials', { key: '' });
        if (this.onStatusChange) await this.onStatusChange();
      } catch (err) {
        this.error(err.message);
      }
    });

    // Explicit Test Connection button (M06 / M07)
    $('test-connection-btn')?.addEventListener('click', () => this.testConnection());

    // Model inspect on input
    $('model')?.addEventListener('input', async () => {
      const provider = $('provider')?.value;
      const model = $('model')?.value.trim();
      if (!model) return;
      try {
        const caps = await this.call('inspectModel', { provider, model });
        this.renderCapabilities(caps);
      } catch {}
    });

    // Settings drawer close button
    $('settings-close')?.addEventListener('click', () => this.hide());
    $('refresh-status')?.addEventListener('click', () => {
      if (this.onStatusChange) this.onStatusChange();
    });

    // Onboarding wizard event listeners
    $('onboarding-local-choice')?.addEventListener('click', () => this.selectOnboardingPath('ollama'));
    $('onboarding-cloud-choice')?.addEventListener('click', () => this.selectOnboardingPath('openai'));
    $('onboarding-complete-btn')?.addEventListener('click', () => this.completeOnboarding());
    $('onboarding-guide-btn')?.addEventListener('click', () => this.showWizard());
    $('onboarding-close')?.addEventListener('click', () => this.hideWizard());

    // Export sanitized diagnostics (M08)
    $('export-diagnostics-btn')?.addEventListener('click', async () => {
      try {
        const exported = await this.call('exportDiagnostics');
        if (exported) this.state('Diagnostics exported successfully');
      } catch (err) {
        this.error(`Failed to export diagnostics: ${err.message}`);
      }
    });
  }

  show() {
    const el = this.$('setup');
    if (el) el.hidden = false;
  }

  hide() {
    const el = this.$('setup');
    if (el) el.hidden = true;
  }

  toggle() {
    const el = this.$('setup');
    if (el) el.hidden = !el.hidden;
  }

  showWizard() {
    const wizard = this.$('onboarding-wizard');
    if (wizard) wizard.hidden = false;
    this.hide();
  }

  hideWizard() {
    const wizard = this.$('onboarding-wizard');
    if (wizard) wizard.hidden = true;
  }

  updateProviderFields() {
    const $ = this.$;
    const choice = $('provider')?.value;
    if ($('endpoint-field')) $('endpoint-field').hidden = choice !== 'compatible';
    if ($('key-field')) $('key-field').hidden = choice === 'ollama';
    if ($('model')) $('model').value = '';
    if ($('api-key')) $('api-key').value = '';
    if ($('key-status')) $('key-status').textContent = 'Save the provider and model to switch.';
  }

  describeProvider(prefs) {
    const label = this.providerLabels[prefs.provider] || prefs.provider;
    return `${label} · ${prefs.model || 'unconfigured'}`;
  }

  renderCapabilities(caps) {
    const container = this.$('capability-badges');
    if (!container) return;
    container.replaceChildren();
    if (!caps) return;

    if (caps.isLocal) {
      const b = document.createElement('span');
      b.className = 'cap-badge success';
      b.textContent = '🔒 Local · Private';
      container.appendChild(b);
    }
    if (caps.supportsVision) {
      const b = document.createElement('span');
      b.className = 'cap-badge active';
      b.textContent = '🖼️ Vision Supported';
      container.appendChild(b);
    }
    if (caps.supportsReasoning) {
      const b = document.createElement('span');
      b.className = 'cap-badge active';
      b.textContent = '🧠 Reasoning Model';
      container.appendChild(b);
    }
    if (caps.isEmbedding) {
      const b = document.createElement('span');
      b.className = 'cap-badge warning';
      b.textContent = '⚠️ Embedding Only (Incompatible)';
      container.appendChild(b);
    }
  }

  async testConnection() {
    const $ = this.$;
    const btn = $('test-connection-btn');
    const statusEl = $('connection-status');
    const provider = $('provider')?.value;
    const model = $('model')?.value.trim();
    const endpoint = $('endpoint')?.value.trim();
    const key = $('api-key')?.value;

    if (!model) {
      this.error('Enter a model ID first.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Testing…';
    }
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.className = 'help';
      statusEl.textContent = 'Connecting with a minimal verification request (~1 token)…';
    }

    try {
      const result = await this.call('testConnection', {
        provider,
        model,
        baseURL: endpoint,
        key: key || undefined
      });
      if (statusEl) {
        statusEl.className = 'help success';
        statusEl.textContent = `✓ Connected successfully (${result.latencyMs}ms)! Model is reachable.`;
      }
      this.renderCapabilities(result.capabilities);
    } catch (err) {
      if (statusEl) {
        statusEl.className = 'help error';
        statusEl.textContent = `✕ Connection failed: ${err.message}`;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Test connection';
      }
    }
  }

  selectOnboardingPath(choice) {
    const $ = this.$;
    const localCard = $('onboarding-local-choice');
    const cloudCard = $('onboarding-cloud-choice');

    if (choice === 'ollama') {
      localCard?.classList.add('selected');
      cloudCard?.classList.remove('selected');
      if ($('provider')) $('provider').value = 'ollama';
      this.updateProviderFields();
      if ($('model')) $('model').value = 'qwen3:1.7b';
      if ($('onboarding-path-note')) {
        $('onboarding-path-note').textContent = 'Selected: Local Ollama (100% private, stays on your PC). Make sure Ollama is running.';
      }
    } else {
      cloudCard?.classList.add('selected');
      localCard?.classList.remove('selected');
      if ($('provider')) $('provider').value = 'openai';
      this.updateProviderFields();
      if ($('model')) $('model').value = 'gpt-4o-mini';
      if ($('onboarding-path-note')) {
        $('onboarding-path-note').textContent = 'Selected: Cloud BYOK. Enter your API key in AI Settings to begin inference.';
      }
    }
  }

  async completeOnboarding() {
    this.hideWizard();
    this.show();
    this.state('AI Settings open · Save your provider to finish setup');
  }

  refresh(status) {
    this.status = status;
    this.preferences = status.settings;
    const $ = this.$;

    if ($('provider')) $('provider').value = this.preferences.provider;
    if ($('endpoint')) $('endpoint').value = this.preferences.baseURL || '';
    if ($('send-image')) $('send-image').checked = this.preferences.sendImage;
    if ($('endpoint-field')) $('endpoint-field').hidden = this.preferences.provider !== 'compatible';
    if ($('key-field')) $('key-field').hidden = this.preferences.provider === 'ollama';

    if ($('key-status')) {
      $('key-status').textContent = status.keySaved
        ? 'A key is saved with OS encryption. It is never shown here.'
        : 'No saved key. A key is optional for some custom endpoints.';
    }

    const destination = this.preferences.provider === 'ollama'
      ? 'Only the local Ollama server receives your question and capture.'
      : `Your question and ${this.preferences.sendImage ? 'screenshot image' : 'extracted screen text'} are sent to ${this.preferences.provider === 'compatible' ? this.preferences.baseURL || 'your configured endpoint' : this.providerLabels[this.preferences.provider]}. Your provider may charge for usage.`;

    if ($('provider-notice')) $('provider-notice').textContent = destination;

    // Populate model datalist
    if ($('model-options')) {
      $('model-options').replaceChildren();
      const available = [...new Set([this.preferences.model, ...status.models.map(m => m.name)])];
      for (const name of available) $('model-options').append(new Option(name, name));
    }
    if ($('model')) $('model').value = this.preferences.model;

    // Render readiness rows
    const providerReady = this.preferences.provider === 'ollama'
      ? status.models.some(m => m.name === this.preferences.model)
      : this.preferences.provider === 'compatible' ? !!this.preferences.baseURL : status.keySaved;

    const rows = [
      [this.providerLabels[this.preferences.provider] || 'AI Provider', providerReady],
      [this.preferences.sendImage ? 'Screenshot image mode' : 'Screen text (OCR)', this.preferences.sendImage || status.ocrReady],
      ['Voice recognition (optional)', status.speechReady]
    ];

    if ($('readiness')) {
      $('readiness').replaceChildren();
      for (const [label, ready] of rows) {
        const row = document.createElement('div');
        row.className = 'readiness-row' + (ready ? '' : ' missing');
        const left = document.createElement('span'), right = document.createElement('span');
        left.textContent = label;
        right.textContent = ready ? 'Ready' : 'Setup needed';
        row.append(left, right);
        $('readiness').append(row);
      }
    }

    this.renderCapabilities(status.capabilities);

    const ready = rows.slice(0, 2).every(([, value]) => value);
    if ($('setup')) $('setup').hidden = ready;

    // First run detection: if not ready and no key/model ever configured, show onboarding wizard
    if (!ready && !status.keySaved && status.models.length === 0) {
      this.showWizard();
    }

    return ready;
  }
}
