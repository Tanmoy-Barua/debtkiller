import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_PORT = "4176";
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${[command, ...args].join(" ")}`);
    const child = spawn(command, args, {
      env: process.env,
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

function startPreview() {
  console.log(`\n> npm run preview -- --host ${PREVIEW_HOST} --port ${PREVIEW_PORT}`);
  const env = {
    ...process.env,
    VITE_SUPABASE_URL: "",
    VITE_SUPABASE_ANON_KEY: "",
    VITE_OWNER_EMAIL: "",
  };
  const preview = spawn(
    "npm",
    ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT],
    {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
      detached: process.platform !== "win32",
    },
  );

  preview.stdout.on("data", (chunk) => process.stdout.write(chunk));
  preview.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return preview;
}

async function waitForPreview(preview) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (preview.exitCode !== null) {
      throw new Error(`Preview exited early with code ${preview.exitCode}`);
    }

    try {
      const response = await fetch(PREVIEW_URL);
      if (response.ok) return;
    } catch {
      // Vite preview may still be binding the port.
    }
    await delay(500);
  }
  throw new Error(`Preview did not become ready at ${PREVIEW_URL}`);
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
    await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
  }
}

function stopPreview(preview) {
  if (!preview || preview.exitCode !== null) return;

  if (process.platform === "win32") {
    preview.kill();
    return;
  }

  try {
    process.kill(-preview.pid, "SIGTERM");
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
  console.log("\nHealth check passed.");
} finally {
  stopPreview(preview);
}
