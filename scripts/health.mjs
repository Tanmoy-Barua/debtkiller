import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";

const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_PORT = "4176";
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;
const OPTIONAL_VITE_ENV = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_OWNER_EMAIL",
];

function localSmokeEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const key of OPTIONAL_VITE_ENV) {
    delete env[key];
  }
  return env;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${[command, ...args].join(" ")}`);
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: options.env ?? process.env,
      shell: process.platform === "win32",
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with ${signal ?? `exit code ${code}`}`));
      }
    });
  });
}

async function browserIsInstalled() {
  const probe = spawn(
    process.execPath,
    ["-e", "import('playwright').then(async ({ chromium }) => { const browser = await chromium.launch({ headless: true }); await browser.close(); })"],
    {
      cwd: process.cwd(),
      env: process.env,
      shell: process.platform === "win32",
      stdio: "ignore",
    },
  );

  return new Promise((resolve) => {
    probe.on("error", () => resolve(false));
    probe.on("exit", (code) => resolve(code === 0));
  });
}

async function ensureChromium() {
  if (await browserIsInstalled()) {
    return;
  }

  console.log("\nPlaywright Chromium is missing; installing browser dependencies.");
  await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
}

async function waitForPreview(processRef) {
  const deadline = Date.now() + 30_000;
  let lastError;

  while (Date.now() < deadline) {
    if (processRef.exitCode !== null) {
      throw new Error(`Preview server exited early with code ${processRef.exitCode}`);
    }

    try {
      const response = await fetch(PREVIEW_URL);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await wait(500);
  }

  throw new Error(`Preview did not become ready at ${PREVIEW_URL}: ${lastError?.message ?? "timeout"}`);
}

function startPreview() {
  console.log(`\n> npx vite preview --host ${PREVIEW_HOST} --port ${PREVIEW_PORT} --strictPort`);
  return spawn("npx", ["vite", "preview", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT, "--strictPort"], {
    cwd: process.cwd(),
    env: localSmokeEnv(),
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
    stdio: "inherit",
  });
}

function stopPreview(processRef) {
  if (!processRef || processRef.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    processRef.kill();
    return;
  }

  try {
    process.kill(-processRef.pid, "SIGTERM");
  } catch {
    processRef.kill("SIGTERM");
  }
}

let preview;

try {
  await run("npm", ["audit", "--audit-level=moderate"]);
  await run("npm", ["run", "test:theme"]);
  await run("npm", ["run", "build"], { env: localSmokeEnv() });
  await ensureChromium();

  preview = startPreview();
  await waitForPreview(preview);
  await run("npm", ["run", "test:e2e-theme"], {
    env: localSmokeEnv({ E2E_BASE: PREVIEW_URL }),
  });

  console.log("\nApplication health check passed.");
} finally {
  stopPreview(preview);
}
