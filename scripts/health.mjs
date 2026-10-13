import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const PREVIEW_HOST = '127.0.0.1';
const PREVIEW_PORT = '4176';
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;
const CLEAN_ENV_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_OWNER_EMAIL',
];

function withoutCloudEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const key of CLEAN_ENV_KEYS) delete env[key];
  return env;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with ${signal || `exit code ${code}`}`));
    });
  });
}

async function runAudit() {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await run('npm', ['audit', '--audit-level=moderate']);
      return;
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      console.warn(`npm audit failed on attempt ${attempt}; retrying...`);
      await delay(2000 * attempt);
    }
  }
}

async function ensureChromium() {
  try {
    await run(process.execPath, [
      '--input-type=module',
      '--eval',
      "import { chromium } from 'playwright'; const browser = await chromium.launch({ headless: true }); await browser.close();",
    ]);
  } catch {
    console.warn('Playwright Chromium is missing; installing browser dependencies...');
    await run('npx', ['playwright', 'install', '--with-deps', 'chromium']);
  }
}

async function waitForPreview() {
  const deadline = Date.now() + 30_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(PREVIEW_URL);
      if (response.ok) return;
      lastError = new Error(`Preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }

  throw new Error(`Preview did not become ready at ${PREVIEW_URL}: ${lastError?.message || 'timed out'}`);
}

function startPreview() {
  const child = spawn(
    'npm',
    ['run', 'preview', '--', '--host', PREVIEW_HOST, '--port', PREVIEW_PORT, '--strictPort'],
    {
      env: withoutCloudEnv(),
      detached: process.platform !== 'win32',
      shell: process.platform === 'win32',
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  );

  child.on('error', (error) => {
    console.error('Failed to start Vite preview:', error);
  });

  return child;
}

function stopPreview(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === 'win32') {
      child.kill();
    } else {
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

let preview;

try {
  await runAudit();
  await run('npm', ['run', 'test:theme']);
  await run('npm', ['run', 'build'], { env: withoutCloudEnv() });
  await ensureChromium();

  preview = startPreview();
  await waitForPreview();
  await run('npm', ['run', 'test:e2e-theme'], {
    env: withoutCloudEnv({ E2E_BASE: PREVIEW_URL }),
  });

  console.log('\nHealth checks passed.');
} finally {
  stopPreview(preview);
}
