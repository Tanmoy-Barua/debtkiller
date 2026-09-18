import { existsSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_PORT = "4176";
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;
const clearedEnvKeys = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_OWNER_EMAIL",
];

let previewProcess;

function commandName(command) {
  if (process.platform === "win32") return `${command}.cmd`;
  return command;
}

function localEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const key of clearedEnvKeys) delete env[key];
  return env;
}

function run(command, args, options = {}) {
  const { env: extraEnv, ...spawnOptions } = options;
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${[command, ...args].join(" ")}`);
    const child = spawn(commandName(command), args, {
      stdio: "inherit",
      env: localEnv(extraEnv),
      shell: false,
      ...spawnOptions,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with ${signal || `exit code ${code}`}`));
    });
  });
}

async function runAudit() {
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await run("npm", ["audit", "--audit-level=moderate"]);
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      console.warn(`npm audit failed on attempt ${attempt}; retrying...`);
      await delay(1500 * attempt);
    }
  }
}

async function ensureChromium() {
  const executablePath = chromium.executablePath();
  if (existsSync(executablePath)) return;
  console.log(`\nPlaywright Chromium is missing at ${executablePath}; installing it now.`);
  await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
}

async function waitForPreview() {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(PREVIEW_URL);
      if (response.ok) return;
      lastError = new Error(`preview responded with HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`Vite preview did not become healthy: ${lastError?.message || "timed out"}`);
}

function startPreview() {
  console.log(`\n$ npm run preview -- --host ${PREVIEW_HOST} --port ${PREVIEW_PORT} --strictPort`);
  previewProcess = spawn(
    commandName("npm"),
    ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT, "--strictPort"],
    {
      stdio: "inherit",
      env: localEnv(),
      detached: process.platform !== "win32",
      shell: false,
    },
  );

  previewProcess.on("error", (error) => {
    console.error("Failed to start Vite preview:", error);
  });
}

function stopPreview() {
  if (!previewProcess?.pid) return;

  if (process.platform === "win32") {
    previewProcess.kill();
    return;
  }

  try {
    process.kill(-previewProcess.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

try {
  await runAudit();
  await run("npm", ["run", "test:theme"]);
  await run("npm", ["run", "build"]);
  await ensureChromium();
  startPreview();
  await waitForPreview();
  await run("npm", ["run", "test:e2e-theme"], { env: { E2E_BASE: PREVIEW_URL } });
  console.log("\nHealth check passed.");
} finally {
  stopPreview();
}
