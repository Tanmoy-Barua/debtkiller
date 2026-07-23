import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const host = "127.0.0.1";
const port = "4176";
const baseUrl = `http://${host}:${port}/`;

const localOnlyEnv = {
  ...process.env,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_OWNER_EMAIL: "",
  E2E_BASE: baseUrl,
};

function run(label, command, args, options = {}) {
  console.log(`\n==> ${label}`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed with ${signal || `exit code ${code}`}`));
    });
  });
}

async function ensureChromium() {
  if (existsSync(chromium.executablePath())) return;

  const args =
    process.platform === "linux"
      ? ["playwright", "install", "--with-deps", "chromium"]
      : ["playwright", "install", "chromium"];

  try {
    await run("Install Playwright Chromium", npx, args);
  } catch (error) {
    if (process.platform !== "linux") throw error;
    console.warn(`Playwright dependency install failed: ${error.message}`);
    await run("Install Playwright Chromium browser only", npx, ["playwright", "install", "chromium"]);
  }
}

async function waitForPreview() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await delay(500);
  }
  throw new Error(`Preview did not become ready at ${baseUrl}`);
}

async function stopPreview(preview) {
  if (preview.exitCode != null || preview.signalCode != null) return;

  if (process.platform !== "win32" && preview.pid) {
    try {
      process.kill(-preview.pid, "SIGTERM");
    } catch {
      preview.kill("SIGTERM");
    }
  } else {
    preview.kill("SIGTERM");
  }

  await Promise.race([
    new Promise((resolve) => preview.once("exit", resolve)),
    delay(5_000).then(() => {
      if (preview.exitCode == null && preview.signalCode == null) preview.kill("SIGKILL");
    }),
  ]);
}

await run("Audit dependencies", npm, ["audit", "--audit-level=moderate"]);
await run("Theme unit tests", npm, ["run", "test:theme"]);
await run("Production build", npm, ["run", "build"], { env: localOnlyEnv });
await ensureChromium();

console.log("\n==> Start local preview");
const preview = spawn(
  npm,
  ["run", "preview", "--", "--host", host, "--port", port, "--strictPort"],
  {
    stdio: "inherit",
    env: localOnlyEnv,
    detached: process.platform !== "win32",
  },
);

try {
  await waitForPreview();
  await run("Theme browser smoke", npm, ["run", "test:e2e-theme"], { env: localOnlyEnv });
  console.log("\nApplication health check passed.");
} finally {
  await stopPreview(preview);
}
