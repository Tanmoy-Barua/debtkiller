import { spawn } from "node:child_process";
import process from "node:process";

const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";
const npx = isWindows ? "npx.cmd" : "npx";
const previewHost = "127.0.0.1";
const previewPort = "4176";
const previewUrl = `http://${previewHost}:${previewPort}/`;

const cleanEnv = {
  ...process.env,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_SUPABASE_PUBLISHABLE_KEY: "",
  VITE_OWNER_EMAIL: "",
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: cleanEnv,
      shell: false,
      ...options,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
      }
    });
  });
}

function waitForPreview(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Preview did not start at ${previewUrl} within 30 seconds`));
    }, 30_000);

    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Preview exited before smoke tests could run (code ${code ?? "unknown"})`));
    });

    const probe = async () => {
      try {
        const response = await fetch(previewUrl);
        if (response.ok) {
          clearTimeout(timeout);
          resolve();
          return;
        }
      } catch {
        // Keep probing until Vite preview is ready or the timeout fires.
      }
      setTimeout(probe, 500);
    };

    probe();
  });
}

function stopPreview(child) {
  if (!child.pid || child.killed) return;

  if (isWindows) {
    child.kill();
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill();
  }
}

async function ensureChromium() {
  try {
    await run(process.execPath, [
      "--input-type=module",
      "--eval",
      "import { chromium } from 'playwright'; const browser = await chromium.launch({ headless: true }); await browser.close();",
    ], { stdio: "ignore" });
  } catch {
    await run(npx, ["playwright", "install", "--with-deps", "chromium"]);
  }
}

let preview;

try {
  await run(npm, ["audit", "--audit-level=moderate"]);
  await run(npm, ["run", "test:theme"]);
  await run(npm, ["run", "build"]);
  await ensureChromium();

  preview = spawn(npm, ["run", "preview", "--", "--host", previewHost, "--port", previewPort], {
    stdio: "inherit",
    env: cleanEnv,
    detached: !isWindows,
    shell: false,
  });

  await waitForPreview(preview);
  await run(npm, ["run", "test:e2e-theme"], {
    env: { ...cleanEnv, E2E_BASE: previewUrl },
  });

  console.log("\nApp health check passed.");
} finally {
  if (preview) stopPreview(preview);
}
