import { spawn } from "node:child_process";

const PREVIEW_URL = "http://127.0.0.1:4176/";
const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_PORT = "4176";
const LOCAL_ONLY_ENV_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_OWNER_EMAIL",
];

function localOnlyEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const key of LOCAL_ONLY_ENV_KEYS) delete env[key];
  return env;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${[command, ...args].join(" ")}`);
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: options.env ?? process.env,
      detached: options.detached ?? false,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve(child);
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with ${signal ?? `exit code ${code}`}`));
    });
  });
}

function startPreview() {
  console.log(`\n$ npm run preview -- --host ${PREVIEW_HOST} --port ${PREVIEW_PORT} --strictPort`);
  const child = spawn(
    "npm",
    ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT, "--strictPort"],
    {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: localOnlyEnv(),
      detached: process.platform !== "win32",
    },
  );
  child.unref();
  return child;
}

async function waitForPreview(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(PREVIEW_URL, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
      lastError = new Error(`Preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${PREVIEW_URL}: ${lastError?.message ?? "no response"}`);
}

function stopPreview(child) {
  if (!child?.pid) return;

  try {
    if (process.platform === "win32") {
      child.kill();
    } else {
      process.kill(-child.pid, "SIGTERM");
    }
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

async function ensureChromium() {
  const { chromium } = await import("playwright");
  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
  } catch (error) {
    console.warn(`Chromium smoke launch failed, installing Playwright Chromium: ${error.message}`);
    await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
  }
}

let preview;

try {
  await run("npm", ["audit", "--audit-level=moderate"]);
  await run("npm", ["run", "test:theme"]);
  await run("npm", ["run", "build"], { env: localOnlyEnv() });
  await ensureChromium();

  preview = startPreview();
  await waitForPreview();
  await run("npm", ["run", "test:e2e-theme"], { env: localOnlyEnv({ E2E_BASE: PREVIEW_URL }) });

  console.log("\nApplication health check passed.");
} finally {
  stopPreview(preview);
}
