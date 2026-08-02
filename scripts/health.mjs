import { access } from "node:fs/promises";
import process from "node:process";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const HOST = "127.0.0.1";
const PORT = "4176";
const BASE_URL = `http://${HOST}:${PORT}/`;

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
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
      reject(new Error(`${command} ${args.join(" ")} failed with ${signal || `exit code ${code}`}`));
    });
  });
}

async function ensureChromium() {
  try {
    await access(chromium.executablePath());
  } catch {
    await run(npxCmd, ["playwright", "install", "--with-deps", "chromium"]);
  }
}

async function waitForPreview() {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < 30_000) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
      lastError = new Error(`Preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }

  throw new Error(`Preview did not become ready at ${BASE_URL}: ${lastError?.message || "unknown error"}`);
}

function startPreview() {
  const previewEnv = { ...process.env };
  delete previewEnv.VITE_SUPABASE_URL;
  delete previewEnv.VITE_SUPABASE_ANON_KEY;
  delete previewEnv.VITE_OWNER_EMAIL;

  const child = spawn(npxCmd, ["vite", "preview", "--host", HOST, "--port", PORT, "--strictPort"], {
    env: previewEnv,
    stdio: "inherit",
    detached: process.platform !== "win32",
  });

  child.on("error", (error) => {
    throw error;
  });

  return child;
}

function stopPreview(child) {
  if (!child?.pid || child.exitCode !== null) return;

  try {
    if (process.platform === "win32") {
      child.kill("SIGTERM");
    } else {
      process.kill(-child.pid, "SIGTERM");
    }
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

let preview;

try {
  await run(npmCmd, ["audit", "--audit-level=moderate"]);
  await run(npmCmd, ["run", "test:theme"]);
  await run(npmCmd, ["run", "build"]);
  await ensureChromium();

  preview = startPreview();
  await waitForPreview();
  await run(npmCmd, ["run", "test:e2e-theme"], {
    env: { ...process.env, E2E_BASE: BASE_URL },
  });

  console.log("\nApplication health check passed.");
} finally {
  stopPreview(preview);
}
