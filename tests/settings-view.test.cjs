const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const load = async name => import(`data:text/javascript;base64,${Buffer.from(await fs.readFile(path.join(__dirname, '../src/renderer', name), 'utf8')).toString('base64')}`);

function mockElement(tag = 'div', id = '') {
  return {
    id,
    tagName: tag.toUpperCase(),
    value: '',
    textContent: '',
    className: '',
    classList: {
      classes: new Set(),
      add(c) { this.classes.add(c); },
      remove(c) { this.classes.delete(c); },
      toggle(c, v) { if (v ?? !this.classes.has(c)) this.classes.add(c); else this.classes.delete(c); },
      contains(c) { return this.classes.has(c); }
    },
    hidden: false,
    disabled: false,
    checked: false,
    children: [],
    listeners: {},
    addEventListener(event, fn) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(fn);
    },
    dispatchEvent(event) {
      const type = typeof event === 'string' ? event : event.type;
      (this.listeners[type] || []).forEach(fn => fn(event));
    },
    replaceChildren(...nodes) { this.children = nodes; },
    appendChild(node) { this.children.push(node); },
    append(...nodes) { this.children.push(...nodes); }
  };
}

function createDOM() {
  const elements = new Map();
  const getOrCreate = id => {
    if (!elements.has(id)) elements.set(id, mockElement('div', id));
    return elements.get(id);
  };

  const ids = [
    'provider', 'endpoint', 'endpoint-field', 'key-field', 'key-status', 'api-key',
    'send-image', 'save-provider', 'remove-key', 'test-connection-btn', 'connection-status',
    'capability-badges', 'provider-notice', 'model', 'model-options', 'readiness',
    'setup', 'settings-close', 'refresh-status', 'onboarding-wizard', 'onboarding-local-choice',
    'onboarding-cloud-choice', 'onboarding-complete-btn', 'onboarding-guide-btn',
    'onboarding-close', 'onboarding-path-note'
  ];
  ids.forEach(id => getOrCreate(id));

  global.document = {
    getElementById: id => getOrCreate(id),
    createElement: tag => mockElement(tag)
  };
  global.Option = function(text, value) { return { text, value }; };

  return { elements, get: id => getOrCreate(id) };
}

test('SettingsView: first-run detection shows onboarding wizard when unconfigured', async () => {
  const dom = createDOM();
  const { SettingsView } = await load('settings-view.js');

  const sv = new SettingsView({
    call: async () => {},
    state: () => {},
    error: () => {},
    resetError: () => {}
  });

  const unconfiguredStatus = {
    settings: { provider: 'ollama', model: 'qwen3:1.7b', baseURL: '', sendImage: false },
    models: [],
    keySaved: false,
    ocrReady: true,
    speechReady: true,
    capabilities: { isLocal: true, supportsVision: false, supportsReasoning: false, isEmbedding: false }
  };

  sv.init();
  const ready = sv.refresh(unconfiguredStatus);

  assert.equal(ready, false, 'Unconfigured setup should not be marked ready');
  assert.equal(dom.get('onboarding-wizard').hidden, false, 'First-run wizard should be displayed');
});

test('SettingsView: selecting local vs cloud updates provider selection and defaults', async () => {
  const dom = createDOM();
  const { SettingsView } = await load('settings-view.js');

  const sv = new SettingsView({
    call: async () => {},
    state: () => {},
    error: () => {},
    resetError: () => {}
  });
  sv.init();

  // Choose Cloud
  sv.selectOnboardingPath('openai');
  assert.equal(dom.get('provider').value, 'openai');
  assert.equal(dom.get('model').value, 'gpt-4o-mini');
  assert.ok(dom.get('onboarding-cloud-choice').classList.contains('selected'));
  assert.ok(!dom.get('onboarding-local-choice').classList.contains('selected'));

  // Choose Local
  sv.selectOnboardingPath('ollama');
  assert.equal(dom.get('provider').value, 'ollama');
  assert.equal(dom.get('model').value, 'qwen3:1.7b');
  assert.ok(dom.get('onboarding-local-choice').classList.contains('selected'));
  assert.ok(!dom.get('onboarding-cloud-choice').classList.contains('selected'));
});

test('SettingsView: saves provider settings with onBeforeSave stop hook', async () => {
  const dom = createDOM();
  const { SettingsView } = await load('settings-view.js');

  let stopped = false;
  let savedSettings = null;

  const sv = new SettingsView({
    call: async (method, payload) => {
      if (method === 'settings') {
        savedSettings = payload;
        return payload;
      }
      return {};
    },
    state: () => {},
    error: () => {},
    resetError: () => {},
    onBeforeSave: async () => { stopped = true; },
    onSave: async () => {}
  });
  sv.init();

  dom.get('provider').value = 'anthropic';
  dom.get('model').value = 'claude-3-5-sonnet';
  dom.get('save-provider').dispatchEvent('click');

  // Let event loop flush microtasks
  await new Promise(r => setImmediate(r));

  assert.equal(stopped, true, 'onBeforeSave hook must be called prior to saving');
  assert.equal(savedSettings?.provider, 'anthropic');
  assert.equal(savedSettings?.model, 'claude-3-5-sonnet');
});
