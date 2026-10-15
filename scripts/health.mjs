import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_PORT = "4176";
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";

function localEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const key of [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_OWNER_EMAIL",
  ]) {
    delete env[key];
  }
  return env;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${[command, ...args].join(" ")}`);
    const child = spawn(command, args, {
      stdio: "inherit",
      env: options.env ?? process.env,
      shell: false,
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

function runCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${[command, ...args].join(" ")}`);
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: options.env ?? process.env,
      shell: false,
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      output += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => resolve({ code, signal, output }));
  });
}

async function audit() {
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await runCapture(npmCmd, ["audit", "--audit-level=moderate"]);
    if (result.code === 0) return;

    const hasAuditFindings =
      /# npm audit report/i.test(result.output) ||
      /\b\d+\s+(moderate|high|critical)\b/i.test(result.output) ||
      /\bvulnerabilit(?:y|ies)\b/i.test(result.output);
    if (hasAuditFindings || attempt === attempts) {
      throw new Error(`npm audit failed with ${result.signal || `exit code ${result.code}`}`);
    }

    console.warn(`npm audit failed without advisory output; retrying (${attempt}/${attempts})...`);
    await delay(2000 * attempt);
  }
}

async function ensureChromium() {
  try {
    await access(chromium.executablePath());
    return;
  } catch {
    console.log("\nPlaywright Chromium is missing; installing browser dependencies.");
    await run(npxCmd, ["playwright", "install", "--with-deps", "chromium"]);
  }
}

async function waitForPreview(child) {
  const startedAt = Date.now();
  const timeoutMs = 60_000;
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Vite preview exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(PREVIEW_URL);
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for Vite preview at ${PREVIEW_URL}`);
}

function startPreview() {
  console.log(`\n$ npm run preview -- --host ${PREVIEW_HOST} --port ${PREVIEW_PORT} --strictPort`);
  const child = spawn(
    npmCmd,
    ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT, "--strictPort"],
    {
      detached: process.platform !== "win32",
      env: localEnv(),
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    },
  );
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

function stopPreview(child) {
  if (!child || child.exitCode !== null) return;
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

let preview;
try {
  await audit();
  await run(npmCmd, ["run", "test:theme"], { env: localEnv() });
  await run(npmCmd, ["run", "build"], { env: localEnv() });
  await ensureChromium();

  preview = startPreview();
  await waitForPreview(preview);
  await run(npmCmd, ["run", "test:e2e-theme"], {
    env: localEnv({ E2E_BASE: PREVIEW_URL }),
  });

  console.log("\nApp health check passed.");
} finally {
  stopPreview(preview);
}
