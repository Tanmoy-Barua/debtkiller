import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_PORT = "4176";
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;

const localOnlyEnv = {
  ...process.env,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_SUPABASE_PUBLISHABLE_KEY: "",
  VITE_OWNER_EMAIL: "",
  E2E_BASE: PREVIEW_URL,
};

async function run(command, args, options = {}) {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  if (code !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${code}`);
  }
}

async function ensureChromium() {
  const executable = chromium.executablePath();
  if (existsSync(executable)) return;
  await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
}

async function waitForPreview() {
  const deadline = Date.now() + 30000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(PREVIEW_URL);
      if (response.ok) return;
      lastError = new Error(`Preview responded with ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }

  throw new Error(`Preview did not become ready: ${lastError?.message || "timeout"}`);
}

function stopPreview(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === "win32") child.kill();
    else process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

async function main() {
  await run("npm", ["audit", "--audit-level=moderate"]);
  await run("npm", ["run", "test:theme"]);
  await run("npm", ["run", "build"], { env: localOnlyEnv });
  await ensureChromium();

  console.log(`\n$ npm run preview -- --host ${PREVIEW_HOST} --port ${PREVIEW_PORT} --strictPort`);
  const preview = spawn(
    "npm",
    ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT, "--strictPort"],
    {
      stdio: "inherit",
      detached: process.platform !== "win32",
      shell: process.platform === "win32",
      env: localOnlyEnv,
    }
  );

  try {
    await waitForPreview();
    await run("npm", ["run", "test:e2e-theme"], { env: localOnlyEnv });
  } finally {
    stopPreview(preview);
  }

  console.log("\nApp health checks passed.");
}

main().catch((error) => {
  console.error("\nApp health checks failed.");
  console.error(error);
  process.exit(1);
});
