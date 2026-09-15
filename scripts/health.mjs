import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";
const npxCmd = isWindows ? "npx.cmd" : "npx";
const previewHost = "127.0.0.1";
const previewPort = "4176";
const e2eBase = `http://${previewHost}:${previewPort}/`;

const localOnlyEnv = {
  ...process.env,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_SUPABASE_PUBLISHABLE_KEY: "",
  VITE_OWNER_EMAIL: "",
  E2E_BASE: e2eBase,
};

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

async function auditWithRetry() {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await run(npmCmd, ["audit", "--audit-level=moderate"], { env: process.env });
      return;
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      console.warn(`npm audit attempt ${attempt} failed; retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

async function ensureChromium() {
  if (existsSync(chromium.executablePath())) return;
  console.warn("Playwright Chromium is missing; installing browser dependencies.");
  await run(npxCmd, ["playwright", "install", "--with-deps", "chromium"], { env: process.env });
}

function startPreview() {
  const child = spawn(npmCmd, ["run", "preview", "--", "--host", previewHost, "--port", previewPort], {
    env: localOnlyEnv,
    stdio: "inherit",
    detached: !isWindows,
  });

  child.on("error", (error) => {
    console.error("Preview server failed to start:", error);
  });

  return child;
}

async function waitForPreview() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(e2eBase);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Preview did not become ready at ${e2eBase}`);
}

function stopPreview(child) {
  if (!child || child.killed) return;
  if (!isWindows && child.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
      return;
    } catch {
      // Fall through to killing the direct child.
    }
  }
  child.kill("SIGTERM");
}

let preview;
try {
  await auditWithRetry();
  await run(npmCmd, ["run", "test:theme"], { env: process.env });
  await run(npmCmd, ["run", "build"], { env: localOnlyEnv });
  await ensureChromium();
  preview = startPreview();
  await waitForPreview();
  await run(npmCmd, ["run", "test:e2e-theme"], { env: localOnlyEnv });
  console.log("\nApp health check passed.");
} finally {
  stopPreview(preview);
}
