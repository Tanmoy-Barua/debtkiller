import { spawn } from "node:child_process";
import process from "node:process";

const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_PORT = "4176";
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
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
    if (!String(error?.message || error).includes("Executable doesn't exist")) {
      throw error;
    }
    console.log("\nPlaywright Chromium is missing; installing it now...");
    await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
  }
}

async function waitForPreview() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(PREVIEW_URL);
      if (response.ok) return;
    } catch {
      // Vite preview may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Preview did not become healthy at ${PREVIEW_URL}`);
}

function startPreview() {
  return spawn("npm", ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT, "--strictPort"], {
    stdio: "inherit",
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
      VITE_OWNER_EMAIL: "",
    },
  });
}

function stopPreview(child) {
  if (!child.pid) return;
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
  await run("npm", ["audit", "--audit-level=moderate"]);
  await run("npm", ["test"]);
  await run("npm", ["run", "build"]);
  await ensureChromium();

  preview = startPreview();
  await waitForPreview();
  await run("npm", ["run", "test:e2e-theme"], {
    env: {
      ...process.env,
      E2E_BASE: PREVIEW_URL,
    },
  });

  console.log("\nApplication health check passed.");
} finally {
  stopPreview(preview);
}
