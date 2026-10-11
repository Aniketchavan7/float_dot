const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const fallback = path.join(process.env.LOCALAPPDATA || '', 'Programs/DockerDesktop/resources/bin/docker.exe');
const docker = fs.existsSync(fallback) ? fallback : 'docker';
function run(args) {
  const result = spawnSync(docker, args, { stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) throw new Error('Start Docker Desktop with the Linux engine, then retry.');
}
try {
  run(['info', '--format', '{{.ServerVersion}}']);
  const directory = path.join(root, '.artifacts/searxng');
  fs.mkdirSync(directory, { recursive: true });
  const config = path.join(directory, 'settings.yml');
  if (!fs.existsSync(config)) fs.writeFileSync(config, `use_default_settings: true\nsearch:\n  formats: [html, json]\nserver:\n  secret_key: "${randomBytes(32).toString('hex')}"\n  limiter: false\n  public_instance: false\n`, { mode: 0o600 });
  const compose = path.join(directory, 'compose.json');
  fs.writeFileSync(compose, JSON.stringify({ services: { search: { image: 'docker.io/searxng/searxng:latest', ports: ['127.0.0.1:8888:8080'], volumes: [`${directory.replace(/\\/g, '/')}:/etc/searxng`], restart: 'unless-stopped' } } }, null, 2));
  run(['compose', '-p', 'float-dot-search', '-f', compose, 'up', '-d']);
  console.log('SearXNG starting at http://127.0.0.1:8888. Enable web search in Float Dot Settings.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
