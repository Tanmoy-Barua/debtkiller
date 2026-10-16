import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const previewUrl = "http://127.0.0.1:4176/";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const cleanEnv = () => {
  const env = { ...process.env };
  delete env.VITE_SUPABASE_URL;
  delete env.VITE_SUPABASE_ANON_KEY;
  delete env.VITE_SUPABASE_PUBLISHABLE_KEY;
  delete env.VITE_OWNER_EMAIL;
  return env;
};

const run = (label, command, args, options = {}) =>
  new Promise((resolve, reject) => {
    console.log(`\n==> ${label}`);
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
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

async function runAudit() {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await run(`npm audit (${attempt}/${maxAttempts})`, npm, ["audit", "--audit-level=moderate"]);
      return;
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      console.warn(`npm audit attempt ${attempt} failed; retrying in 5s...`);
      await delay(5000);
    }
  }
}

async function ensureChromium() {
  console.log("\n==> Checking Playwright Chromium");
  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    console.log("ok - Playwright Chromium is installed");
  } catch (error) {
    console.warn(`Chromium launch failed: ${error.message}`);
    await run("Installing Playwright Chromium", npx, ["playwright", "install", "--with-deps", "chromium"]);
  }
}

async function waitForPreview() {
  const deadline = Date.now() + 30000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(previewUrl);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`Preview did not become ready: ${lastError?.message || "timed out"}`);
}

function startPreview() {
  console.log("\n==> Starting Vite preview");
  return spawn(npm, ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4176", "--strictPort"], {
    env: cleanEnv(),
    stdio: "inherit",
    detached: process.platform !== "win32",
    shell: false,
  });
}

function stopPreview(child) {
  if (!child || child.killed) return;
  stoppingPreview = true;
  if (process.platform === "win32") {
    child.kill("SIGTERM");
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

let preview;
let stoppingPreview = false;

try {
  await runAudit();
  await run("Theme unit tests", npm, ["run", "test:theme"]);
  await run("Production build", npm, ["run", "build"], { env: cleanEnv() });
  await ensureChromium();

  preview = startPreview();
  preview.on("exit", (code, signal) => {
    if (stoppingPreview) return;
    if (code !== null && code !== 0) {
      console.error(`Vite preview exited early with code ${code}`);
    } else if (signal) {
      console.error(`Vite preview exited with signal ${signal}`);
    }
  });

  await waitForPreview();
  await run("Theme browser smoke", npm, ["run", "test:e2e-theme"], {
    env: { ...cleanEnv(), E2E_BASE: previewUrl },
  });

  console.log("\nHealth check passed.");
} finally {
  stopPreview(preview);
}
