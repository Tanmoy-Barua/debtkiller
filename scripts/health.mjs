import { spawn } from "node:child_process";

const HEALTH_ENV = {
  ...process.env,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_SUPABASE_PUBLISHABLE_KEY: "",
  VITE_OWNER_EMAIL: "",
};

const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_PORT = "4176";
const PREVIEW_BASE = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;

let previewProcess;

function isWindows() {
  return process.platform === "win32";
}

function commandFor(bin) {
  return isWindows() ? `${bin}.cmd` : bin;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${[command, ...args].join(" ")}`);
    const child = spawn(commandFor(command), args, {
      stdio: "inherit",
      shell: false,
      env: options.env ?? HEALTH_ENV,
      detached: options.detached ?? false,
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPreview() {
  const started = Date.now();
  const timeoutMs = 30_000;
  let lastError;

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(PREVIEW_BASE);
      if (response.ok) return;
      lastError = new Error(`preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(500);
  }

  throw new Error(`Vite preview did not become healthy at ${PREVIEW_BASE}: ${lastError?.message || "timeout"}`);
}

async function ensureChromium() {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    await browser.close();
  } catch (error) {
    console.warn(`Playwright Chromium is not ready (${error.message}); installing browser dependencies.`);
    await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
  }
}

function startPreview() {
  console.log(`\n> npm run preview -- --host ${PREVIEW_HOST} --port ${PREVIEW_PORT} --strictPort`);
  previewProcess = spawn(commandFor("npm"), ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT, "--strictPort"], {
    stdio: "inherit",
    shell: false,
    env: HEALTH_ENV,
    detached: !isWindows(),
  });

  previewProcess.on("error", (error) => {
    console.error("Failed to start Vite preview:", error);
  });
}

function stopPreview() {
  if (!previewProcess || previewProcess.killed) return;

  if (!isWindows() && previewProcess.pid) {
    try {
      process.kill(-previewProcess.pid, "SIGTERM");
      return;
    } catch (error) {
      console.warn(`Failed to terminate preview process group: ${error.message}`);
    }
  }

  previewProcess.kill("SIGTERM");
}

async function main() {
  try {
    await run("npm", ["audit", "--audit-level=moderate"]);
    await run("npm", ["test"]);
    await run("npm", ["run", "build"]);
    await ensureChromium();

    startPreview();
    await waitForPreview();
    await run("npm", ["run", "test:e2e-theme"], {
      env: {
        ...HEALTH_ENV,
        E2E_BASE: PREVIEW_BASE,
      },
    });

    console.log("\nHealth check passed.");
  } finally {
    stopPreview();
  }
}

main().catch((error) => {
  console.error("\nHealth check failed.");
  console.error(error);
  process.exitCode = 1;
});
