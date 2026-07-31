import { once } from "node:events";
import { spawn } from "node:child_process";

const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_PORT = "4176";
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;

async function run(command, args, options = {}) {
  console.log(`\n> ${[command, ...args].join(" ")}`);
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  const [code, signal] = await once(child, "exit");
  if (code !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${signal ?? `exit code ${code}`}`);
  }
}

async function ensureChromium() {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    await browser.close();
  } catch (error) {
    console.warn("Playwright Chromium is not ready; installing browser dependencies.");
    console.warn(error.message);
    await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
  }
}

function startPreview() {
  const previewEnv = {
    ...process.env,
    VITE_SUPABASE_URL: "",
    VITE_SUPABASE_ANON_KEY: "",
    VITE_OWNER_EMAIL: "",
  };

  const child = spawn(
    "npm",
    ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT, "--strictPort"],
    {
      env: previewEnv,
      shell: process.platform === "win32",
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));

  return child;
}

async function waitForPreview(child) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Preview server exited early with code ${child.exitCode}`);
    }

    try {
      const response = await fetch(PREVIEW_URL);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Preview server did not become healthy at ${PREVIEW_URL}`);
}

function stopPreview(child) {
  if (!child || child.exitCode !== null) return;

  if (process.platform === "win32") {
    child.kill("SIGTERM");
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

let preview;

try {
  await run("npm", ["audit", "--audit-level=moderate"]);
  await run("npm", ["run", "test:theme"]);
  await run("npm", ["run", "build"]);
  await ensureChromium();

  console.log(`\n> npm run preview -- --host ${PREVIEW_HOST} --port ${PREVIEW_PORT} --strictPort`);
  preview = startPreview();
  await waitForPreview(preview);
  await run("npm", ["run", "test:e2e-theme"], {
    env: {
      ...process.env,
      E2E_BASE: PREVIEW_URL,
    },
  });

  console.log("\nApp health check passed.");
} finally {
  stopPreview(preview);
}
