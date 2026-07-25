import { spawn } from "node:child_process";
import process from "node:process";

const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_PORT = "4176";
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;

function commandName(command) {
  return process.platform === "win32" ? `${command}.cmd` : command;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName(command), args, {
      stdio: "inherit",
      env: process.env,
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
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    await browser.close();
  } catch (error) {
    console.warn("Playwright Chromium is not ready; installing browser dependencies.");
    console.warn(error?.message || error);
    await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
  }
}

async function waitForPreview(child) {
  const deadline = Date.now() + 30_000;
  let lastError;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Preview server exited early with code ${child.exitCode}`);
    }

    try {
      const response = await fetch(PREVIEW_URL);
      if (response.ok) return;
      lastError = new Error(`Preview responded with HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for preview at ${PREVIEW_URL}: ${lastError?.message || "no response"}`);
}

function startPreview() {
  const env = { ...process.env };
  delete env.VITE_SUPABASE_URL;
  delete env.VITE_SUPABASE_ANON_KEY;
  delete env.VITE_OWNER_EMAIL;

  const child = spawn(commandName("npm"), [
    "run",
    "preview",
    "--",
    "--host",
    PREVIEW_HOST,
    "--port",
    PREVIEW_PORT,
  ], {
    detached: process.platform !== "win32",
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[preview] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[preview] ${chunk}`));
  child.on("error", (error) => {
    console.error("Preview server failed to start.", error);
  });

  return child;
}

function stopPreview(child) {
  if (!child || child.exitCode !== null) return;

  try {
    if (process.platform === "win32") {
      child.kill("SIGTERM");
    } else {
      process.kill(-child.pid, "SIGTERM");
    }
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

let preview;

try {
  await run("npm", ["audit", "--audit-level=moderate"]);
  await run("npm", ["test"]);
  await run("npm", ["run", "build"]);
  await ensureChromium();

  preview = startPreview();
  await waitForPreview(preview);
  await run("npm", ["run", "test:e2e-theme"], {
    env: {
      ...process.env,
      E2E_BASE: PREVIEW_URL,
    },
  });

  console.log("\nApp health checks passed.");
} finally {
  stopPreview(preview);
}
