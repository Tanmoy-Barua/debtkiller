import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const HOST = "127.0.0.1";
const PORT = process.env.HEALTH_PORT || "4176";
const BASE_URL = process.env.E2E_BASE || `http://${HOST}:${PORT}/`;
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";

const localOnlyEnv = {
  ...process.env,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_SUPABASE_PUBLISHABLE_KEY: "",
  VITE_OWNER_EMAIL: "",
};

async function run(label, command, args, options = {}) {
  console.log(`\n==> ${label}`);
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: options.env || process.env,
      shell: false,
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
  if (existsSync(executablePath)) {
    return;
  }

  await run("install Playwright Chromium", npxCmd, [
    "playwright",
    "install",
    "--with-deps",
    "chromium",
  ]);
}

function startPreview() {
  console.log(`\n==> start preview at ${BASE_URL}`);
  const child = spawn(
    npmCmd,
    ["run", "preview", "--", "--host", HOST, "--port", PORT, "--strictPort"],
    {
      env: localOnlyEnv,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    },
  );

  child.stdout.on("data", (chunk) => process.stdout.write(`[preview] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[preview] ${chunk}`));
  return child;
}

async function waitForPreview(child) {
  const deadline = Date.now() + 30_000;
  let lastError;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Preview exited before becoming ready with code ${child.exitCode}`);
    }

    try {
      const response = await fetch(BASE_URL, { cache: "no-store" });
      if (response.ok) {
        return;
      }
      lastError = new Error(`Preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(500);
  }

  throw new Error(`Preview did not become ready: ${lastError?.message || "timed out"}`);
}

function stopPreview(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

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
  await run("npm audit", npmCmd, ["audit", "--audit-level=moderate"]);
  await run("theme unit tests", npmCmd, ["run", "test:theme"]);
  await run("production build", npmCmd, ["run", "build"], { env: localOnlyEnv });
  await ensureChromium();

  preview = startPreview();
  await waitForPreview(preview);
  await run("theme browser smoke", npmCmd, ["run", "test:e2e-theme"], {
    env: { ...localOnlyEnv, E2E_BASE: BASE_URL },
  });

  console.log("\nHealth check passed.");
} finally {
  stopPreview(preview);
}
