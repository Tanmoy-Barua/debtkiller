import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const previewUrl = "http://127.0.0.1:4176/";

const localSmokeEnv = {
  ...process.env,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_SUPABASE_PUBLISHABLE_KEY: "",
  VITE_OWNER_EMAIL: "",
  E2E_BASE: previewUrl,
};

function run(command, args, options = {}) {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: options.env || process.env,
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

async function ensureChromium() {
  if (existsSync(chromium.executablePath())) return;
  run(npx, ["playwright", "install", "--with-deps", "chromium"]);
}

async function waitForPreview(processHandle) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < 30000) {
    if (processHandle.exitCode !== null) {
      throw new Error(`Vite preview exited early with code ${processHandle.exitCode}`);
    }

    try {
      const response = await fetch(previewUrl);
      if (response.ok) return;
      lastError = new Error(`Preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for ${previewUrl}: ${lastError?.message || "unknown error"}`);
}

let previewProcess;

try {
  run(npm, ["audit", "--audit-level=moderate"]);
  run(npm, ["run", "test:theme"]);
  run(npm, ["run", "build"], { env: localSmokeEnv });
  await ensureChromium();

  console.log(`\n$ npm run preview -- --host 127.0.0.1 --port 4176 --strictPort`);
  previewProcess = spawn(
    npm,
    ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4176", "--strictPort"],
    {
      env: localSmokeEnv,
      stdio: "inherit",
      detached: process.platform !== "win32",
    },
  );

  await waitForPreview(previewProcess);
  run(npm, ["run", "test:e2e-theme"], { env: localSmokeEnv });
  console.log("\nApp health check passed.");
} finally {
  if (previewProcess && previewProcess.exitCode === null) {
    try {
      if (process.platform === "win32") {
        previewProcess.kill("SIGTERM");
      } else {
        process.kill(-previewProcess.pid, "SIGTERM");
      }
    } catch {
      previewProcess.kill("SIGTERM");
    }
  }
}
