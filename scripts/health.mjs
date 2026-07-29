import { spawn } from "node:child_process";
import { once } from "node:events";
import process from "node:process";

const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_PORT = "4176";
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;

function commandFor(bin) {
  return process.platform === "win32" ? `${bin}.cmd` : bin;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandFor(command), args, {
      stdio: "inherit",
      env: process.env,
      ...options,
    });

    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      reject(new Error(`${command} ${args.join(" ")} failed with ${reason}`));
    });
  });
}

async function isPreviewReachable() {
  try {
    const response = await fetch(PREVIEW_URL, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForPreview(child) {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    if (child.exitCode != null) {
      throw new Error(`vite preview exited early with code ${child.exitCode}`);
    }
    if (await isPreviewReachable()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${PREVIEW_URL}`);
}

async function ensureChromium() {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    await browser.close();
  } catch (error) {
    const message = String(error?.message || error);
    if (!message.includes("Executable doesn't exist") && !message.includes("browserType.launch")) {
      throw error;
    }
    console.log("Playwright Chromium is missing; installing browser dependencies...");
    await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
  }
}

function startPreview() {
  const child = spawn(commandFor("npm"), ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT, "--strictPort"], {
    stdio: "inherit",
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
      VITE_OWNER_EMAIL: "",
    },
  });
  child.on("error", (error) => {
    throw error;
  });
  return child;
}

async function stopPreview(child) {
  if (!child || child.exitCode != null) return;
  if (process.platform === "win32") {
    child.kill();
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
  await Promise.race([
    once(child, "close"),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
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
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
      VITE_OWNER_EMAIL: "",
    },
  });

  console.log("\nApp health check passed.");
} finally {
  await stopPreview(preview);
}
