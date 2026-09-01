import { spawn } from "node:child_process";

const PREVIEW_URL = "http://127.0.0.1:4176/";
const PREVIEW_ENV_OVERRIDES = {
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

async function waitForPreview(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`Preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Preview did not become ready at ${url}: ${lastError?.message || "timed out"}`);
}

function startPreview() {
  const child = spawn(
    "npm",
    ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4176", "--strictPort"],
    {
      stdio: "inherit",
      detached: process.platform !== "win32",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        ...PREVIEW_ENV_OVERRIDES,
      },
    },
  );

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
    if (error?.code !== "ESRCH") throw error;
  }
}

const cleanEnv = {
  ...process.env,
  ...PREVIEW_ENV_OVERRIDES,
};

let preview;

try {
  await run("npm", ["audit", "--audit-level=moderate"]);
  await run("npm", ["run", "test:theme"]);
  await run("npm", ["run", "build"], { env: cleanEnv });
  await ensureChromium();

  preview = startPreview();
  await waitForPreview(PREVIEW_URL);
  await run("npm", ["run", "test:e2e-theme"], {
    env: {
      ...cleanEnv,
      E2E_BASE: PREVIEW_URL,
    },
  });

  console.log("\nHealth check passed.");
} finally {
  stopPreview(preview);
}
