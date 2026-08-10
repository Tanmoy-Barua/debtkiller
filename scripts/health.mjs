import { spawn } from "node:child_process";

const PREVIEW_URL = process.env.E2E_BASE || "http://127.0.0.1:4176/";
const PREVIEW_PORT = new URL(PREVIEW_URL).port || "4176";
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";

const localOnlyEnv = () => {
  const env = { ...process.env };
  for (const key of [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_OWNER_EMAIL",
  ]) {
    env[key] = "";
  }
  env.E2E_BASE = PREVIEW_URL;
  return env;
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${[command, ...args].join(" ")}`);
    const child = spawn(command, args, {
      stdio: "inherit",
      env: options.env || process.env,
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with ${signal || `exit code ${code}`}`));
    });
  });
}

async function ensureChromium() {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    await browser.close();
  } catch (error) {
    console.warn(`Playwright Chromium was not ready: ${error.message}`);
    await run(npxCmd, ["playwright", "install", "--with-deps", "chromium"], { env: localOnlyEnv() });
  }
}

async function waitForPreview(child) {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Preview exited before it became healthy with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(PREVIEW_URL);
      if (response.ok) return;
      lastError = new Error(`Preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Preview did not become healthy at ${PREVIEW_URL}: ${lastError?.message || "timed out"}`);
}

function startPreview() {
  console.log(`\n> ${npmCmd} run preview -- --host 127.0.0.1 --port ${PREVIEW_PORT} --strictPort`);
  return spawn(npmCmd, ["run", "preview", "--", "--host", "127.0.0.1", "--port", PREVIEW_PORT, "--strictPort"], {
    stdio: "inherit",
    env: localOnlyEnv(),
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
  });
}

function stopPreview(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    child.kill();
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

let preview;
try {
  await run(npmCmd, ["audit", "--audit-level=moderate"]);
  await run(npmCmd, ["test"], { env: localOnlyEnv() });
  await run(npmCmd, ["run", "build"], { env: localOnlyEnv() });
  await ensureChromium();
  preview = startPreview();
  await waitForPreview(preview);
  await run(npmCmd, ["run", "test:e2e-theme"], { env: localOnlyEnv() });
  console.log("\nApplication health check passed.");
} finally {
  stopPreview(preview);
}
