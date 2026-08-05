import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const HOST = "127.0.0.1";
const PORT = process.env.HEALTH_PREVIEW_PORT || "4176";
const BASE_URL = process.env.E2E_BASE || `http://${HOST}:${PORT}/`;

const localOnlyEnv = {
  ...process.env,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_OWNER_EMAIL: "",
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${[command, ...args].join(" ")}`);
    const child = spawn(command, args, {
      stdio: "inherit",
      env: options.env || process.env,
      shell: process.platform === "win32",
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
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    return;
  } catch (error) {
    console.warn("\nPlaywright Chromium is not ready; installing browser dependencies.");
    console.warn(error.message);
    await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
  } finally {
    await browser?.close();
  }
}

function startPreview() {
  console.log(`\n$ npm run preview -- --host ${HOST} --port ${PORT} --strictPort`);
  return spawn("npm", ["run", "preview", "--", "--host", HOST, "--port", PORT, "--strictPort"], {
    stdio: "inherit",
    env: localOnlyEnv,
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
  });
}

async function waitForPreview(child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error(`Preview server exited early with code ${child.exitCode}`);
    }

    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }

    await delay(500);
  }

  throw new Error(`Preview server did not become healthy at ${BASE_URL}`);
}

async function stopPreview(child) {
  if (!child.pid || child.exitCode != null) return;

  try {
    if (process.platform === "win32") {
      child.kill("SIGTERM");
    } else {
      process.kill(-child.pid, "SIGTERM");
    }
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }

  await delay(500);
}

let preview;
try {
  await run("npm", ["audit", "--audit-level=moderate"]);
  await run("npm", ["test"]);
  await run("npm", ["run", "build"], { env: localOnlyEnv });
  await ensureChromium();

  preview = startPreview();
  await waitForPreview(preview);
  await run("npm", ["run", "test:e2e-theme"], {
    env: {
      ...localOnlyEnv,
      E2E_BASE: BASE_URL,
    },
  });

  console.log("\nApp health checks passed.");
} finally {
  await stopPreview(preview);
}
