import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const baseUrl = process.env.E2E_BASE || "http://127.0.0.1:4176/";

function appEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.VITE_SUPABASE_URL;
  delete env.VITE_SUPABASE_ANON_KEY;
  delete env.VITE_OWNER_EMAIL;
  return env;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
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
  const probe = [
    "-e",
    "import('playwright').then(async ({ chromium }) => { const browser = await chromium.launch({ headless: true }); await browser.close(); })",
  ];

  try {
    await run("node", probe, { env: appEnv(), stdio: "ignore" });
  } catch {
    console.log("Playwright Chromium is missing; installing browser dependencies...");
    await run(npxCmd, ["playwright", "install", "--with-deps", "chromium"], { env: appEnv() });
    await run("node", probe, { env: appEnv() });
  }
}

function startPreview() {
  const child = spawn(
    npmCmd,
    ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4176"],
    {
      env: appEnv(),
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  child.stdout.on("data", (chunk) => process.stdout.write(`[preview] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[preview] ${chunk}`));
  return child;
}

async function waitForPreview(child) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Preview exited early with code ${child.exitCode}`);
    }

    try {
      const res = await fetch(baseUrl);
      if (res.ok) return;
    } catch {
      // Server is still starting.
    }

    await delay(500);
  }

  throw new Error(`Preview did not become healthy at ${baseUrl}`);
}

function stopPreview(child) {
  if (!child?.pid || child.exitCode !== null) return;

  try {
    if (process.platform === "win32") {
      child.kill("SIGTERM");
    } else {
      process.kill(-child.pid, "SIGTERM");
    }
  } catch {
    // Normal teardown may race with Vite preview shutdown.
  }
}

let preview;

try {
  await run(npmCmd, ["audit", "--audit-level=moderate"]);
  await run(npmCmd, ["test"], { env: appEnv() });
  await run(npmCmd, ["run", "build"], { env: appEnv() });
  await ensureChromium();

  preview = startPreview();
  await waitForPreview(preview);
  await run(npmCmd, ["run", "test:e2e-theme"], {
    env: appEnv({ E2E_BASE: baseUrl }),
  });

  console.log("\nApp health check passed.");
} finally {
  stopPreview(preview);
}
