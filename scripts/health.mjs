import { spawn } from "node:child_process";
import process from "node:process";

const PREVIEW_PORT = process.env.HEALTH_PREVIEW_PORT || "4176";
const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;

const smokeEnv = {
  ...process.env,
  E2E_BASE: PREVIEW_URL,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_SUPABASE_PUBLISHABLE_KEY: "",
  VITE_OWNER_EMAIL: "",
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with ${signal || code}`));
    });
  });
}

function waitForPreview(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // Server is not ready yet.
      }

      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Preview did not respond at ${url} within ${timeoutMs}ms`));
        return;
      }
      setTimeout(check, 500);
    };
    check();
  });
}

async function runAudit() {
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await run("npm", ["audit", "--audit-level=moderate"], { timeout: 120000 });
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      console.warn(`npm audit attempt ${attempt} failed; retrying...`);
    }
  }
}

async function ensureChromium() {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    await browser.close();
  } catch (error) {
    console.warn(`Playwright Chromium unavailable (${error.message}); installing...`);
    await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
  }
}

let preview;

try {
  await runAudit();
  await run("npm", ["test"], { env: smokeEnv });
  await run("npm", ["run", "build"], { env: smokeEnv });
  await ensureChromium();

  preview = spawn("npm", ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT], {
    stdio: "inherit",
    shell: process.platform === "win32",
    detached: process.platform !== "win32",
    env: smokeEnv,
  });

  await waitForPreview(PREVIEW_URL);
  await run("npm", ["run", "test:e2e-theme"], { env: smokeEnv });
} finally {
  if (preview?.pid) {
    try {
      process.kill(process.platform === "win32" ? preview.pid : -preview.pid);
    } catch {
      // Preview may already have exited.
    }
  }
}
