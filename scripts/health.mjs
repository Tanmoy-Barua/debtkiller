import { spawn } from "node:child_process";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const previewUrl = "http://127.0.0.1:4176/";

function run(command, args, options = {}) {
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
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with ${signal || `exit code ${code}`}`));
      }
    });
  });
}

async function chromiumLaunches() {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

async function ensureChromium() {
  if (await chromiumLaunches()) return;
  console.log("Playwright Chromium is missing; installing browser dependencies...");
  await run(npxCmd, ["playwright", "install", "--with-deps", "chromium"]);
}

function previewEnvironment() {
  const env = { ...process.env };
  delete env.VITE_SUPABASE_URL;
  delete env.VITE_SUPABASE_ANON_KEY;
  delete env.VITE_OWNER_EMAIL;
  env.E2E_BASE = previewUrl;
  return env;
}

async function waitForPreview(processHandle) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) {
      throw new Error(`Vite preview exited before becoming ready (code ${processHandle.exitCode})`);
    }

    try {
      const response = await fetch(previewUrl);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for Vite preview at ${previewUrl}`);
}

function stopPreview(processHandle) {
  if (!processHandle || processHandle.exitCode !== null) return;

  try {
    if (process.platform === "win32") {
      processHandle.kill("SIGTERM");
    } else {
      process.kill(-processHandle.pid, "SIGTERM");
    }
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

await run(npmCmd, ["audit", "--audit-level=moderate"]);
await run(npmCmd, ["run", "test:theme"]);
await run(npmCmd, ["run", "build"]);
await ensureChromium();

const preview = spawn(npmCmd, ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4176", "--strictPort"], {
  detached: process.platform !== "win32",
  env: previewEnvironment(),
  stdio: "inherit",
});

try {
  await waitForPreview(preview);
  await run(npmCmd, ["run", "test:e2e-theme"], { env: previewEnvironment() });
} finally {
  stopPreview(preview);
}

console.log("\nApp health check passed.");
