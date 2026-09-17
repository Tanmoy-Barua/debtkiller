import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

const PREVIEW_PORT = process.env.HEALTH_PREVIEW_PORT || "4176";
const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;
const CLEAN_ENV_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_OWNER_EMAIL",
];

function localEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const key of CLEAN_ENV_KEYS) {
    delete env[key];
  }
  return env;
}

function run(command, args, options = {}) {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runAuditWithRetries() {
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    console.log(`\n$ npm audit --audit-level=moderate (attempt ${attempt}/${attempts})`);
    const result = spawnSync("npm", ["audit", "--audit-level=moderate"], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    if (result.status === 0) return;
    if (attempt === attempts) process.exit(result.status ?? 1);
    console.log("npm audit failed; retrying in case the registry response was transient...");
  }
}

function ensureChromium() {
  const result = spawnSync(
    "node",
    [
      "--input-type=module",
      "-e",
      "import { chromium } from 'playwright'; import { existsSync } from 'node:fs'; process.exit(existsSync(chromium.executablePath()) ? 0 : 1);",
    ],
    {
      stdio: "ignore",
      shell: process.platform === "win32",
    },
  );

  if (result.status === 0) {
    return;
  }

  // This also runs in CI on fresh Playwright updates where the package is
  // installed but the matching browser binary is not cached yet.
  run("npx", ["playwright", "install", "--with-deps", "chromium"]);
}

function startPreview() {
  console.log(`\n$ npm run preview -- --host ${PREVIEW_HOST} --port ${PREVIEW_PORT} --strictPort`);
  const preview = spawn(
    "npm",
    ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT, "--strictPort"],
    {
      env: localEnv(),
      stdio: "inherit",
      detached: process.platform !== "win32",
      shell: process.platform === "win32",
    },
  );

  preview.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`Vite preview exited early with status ${code}.`);
    }
  });

  return preview;
}

async function waitForPreview(preview) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (preview.exitCode !== null || preview.signalCode !== null) {
      throw new Error("Vite preview exited before becoming ready.");
    }
    try {
      const response = await fetch(PREVIEW_URL);
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${PREVIEW_URL}`);
}

function stopPreview(preview) {
  if (!preview.pid) return;
  try {
    if (process.platform === "win32") {
      preview.kill();
      return;
    }
    process.kill(-preview.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

runAuditWithRetries();
run("npm", ["run", "test:theme"], { env: localEnv() });
run("npm", ["run", "build"], { env: localEnv() });
ensureChromium();

const preview = startPreview();
try {
  await waitForPreview(preview);
  run("npm", ["run", "test:e2e-theme"], {
    env: localEnv({ E2E_BASE: PREVIEW_URL }),
  });
} finally {
  stopPreview(preview);
}

console.log("\nApp health check passed.");
