import { access } from "node:fs/promises";
import { get } from "node:http";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_PORT = "4176";
const PREVIEW_BASE = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;
const CLEAN_VITE_ENV_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_OWNER_EMAIL",
];

function cleanEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const key of CLEAN_VITE_ENV_KEYS) delete env[key];
  return env;
}

async function run(command, args, options = {}) {
  const label = [command, ...args].join(" ");
  console.log(`\n> ${label}`);

  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed with ${signal || `exit code ${code}`}`));
    });
  });
}

async function ensureChromium() {
  const executablePath = chromium.executablePath();
  try {
    await access(executablePath);
    return;
  } catch {
    console.log("\nPlaywright Chromium is missing; installing it now.");
  }

  await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
}

async function waitForPreview() {
  const startedAt = Date.now();
  const timeoutMs = 30_000;
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const request = get(PREVIEW_BASE, (response) => {
          response.resume();
          if (response.statusCode && response.statusCode < 500) {
            resolve();
            return;
          }
          reject(new Error(`Preview returned HTTP ${response.statusCode}`));
        });
        request.on("error", reject);
        request.setTimeout(2_000, () => {
          request.destroy(new Error("Preview request timed out"));
        });
      });
      return;
    } catch (error) {
      lastError = error;
      await delay(500);
    }
  }

  throw new Error(`Preview did not become ready: ${lastError?.message || "unknown error"}`);
}

function startPreview() {
  console.log(`\n> npm run preview -- --host ${PREVIEW_HOST} --port ${PREVIEW_PORT} --strictPort`);
  return spawn(
    "npm",
    ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT, "--strictPort"],
    {
      env: cleanEnv(),
      stdio: "inherit",
      detached: process.platform !== "win32",
      shell: process.platform === "win32",
    },
  );
}

function stopPreview(preview) {
  if (!preview || preview.killed) return;
  if (process.platform === "win32") {
    preview.kill();
    return;
  }

  try {
    process.kill(-preview.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

let preview;

try {
  await run("npm", ["audit", "--audit-level=moderate"]);
  await run("npm", ["run", "test:theme"]);
  await run("npm", ["run", "build"], { env: cleanEnv() });
  await ensureChromium();

  preview = startPreview();
  await waitForPreview();
  await run("npm", ["run", "test:e2e-theme"], {
    env: cleanEnv({ E2E_BASE: PREVIEW_BASE }),
  });

  console.log("\nApp health check passed.");
} finally {
  stopPreview(preview);
}
