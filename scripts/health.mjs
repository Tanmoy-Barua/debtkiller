import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "playwright";

const HOST = "127.0.0.1";
const PORT = "4176";
const BASE_URL = `http://${HOST}:${PORT}/`;
const PREVIEW_READY_TIMEOUT_MS = 30_000;

const localOnlyEnv = {
  ...process.env,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_SUPABASE_PUBLISHABLE_KEY: "",
  VITE_OWNER_EMAIL: "",
};

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function runStep(name, args, options = {}) {
  console.log(`\n==> ${name}`);
  const child = spawn(npmCommand(), args, {
    stdio: "inherit",
    env: localOnlyEnv,
    shell: false,
    ...options,
  });

  const [code, signal] = await once(child, "exit");
  if (code !== 0) {
    throw new Error(`${name} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}`);
  }
}

async function ensureChromium() {
  console.log("\n==> Ensuring Playwright Chromium is installed");
  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    console.log("Playwright Chromium is already available.");
    return;
  } catch (error) {
    console.log(`Playwright Chromium launch check failed; installing browser dependencies. (${error.message})`);
  }

  const child = spawn("npx", ["playwright", "install", "--with-deps", "chromium"], {
    stdio: "inherit",
    env: localOnlyEnv,
    shell: process.platform === "win32",
  });

  const [code, signal] = await once(child, "exit");
  if (code !== 0) {
    throw new Error(`Playwright Chromium install failed with ${signal ? `signal ${signal}` : `exit code ${code}`}`);
  }
}

async function waitForPreview() {
  const deadline = Date.now() + PREVIEW_READY_TIMEOUT_MS;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Preview server did not become ready at ${BASE_URL}: ${lastError?.message ?? "timed out"}`);
}

function stopPreview(child) {
  if (!child.pid || child.exitCode !== null) return;

  if (process.platform === "win32") {
    child.kill();
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function runPreviewSmoke() {
  console.log("\n==> Starting Vite preview");
  const preview = spawn(
    npmCommand(),
    ["run", "preview", "--", "--host", HOST, "--port", PORT, "--strictPort"],
    {
      stdio: "inherit",
      env: localOnlyEnv,
      detached: process.platform !== "win32",
      shell: false,
    },
  );

  try {
    await waitForPreview();
    await runStep("Playwright theme smoke", ["run", "test:e2e-theme"], {
      env: { ...localOnlyEnv, E2E_BASE: BASE_URL },
    });
  } finally {
    stopPreview(preview);
  }
}

try {
  await runStep("npm audit", ["audit", "--audit-level=moderate"]);
  await runStep("Theme unit tests", ["run", "test:theme"]);
  await runStep("Production build", ["run", "build"]);
  await ensureChromium();
  await runPreviewSmoke();
  console.log("\nHealth check passed.");
} catch (error) {
  console.error("\nHealth check failed.");
  console.error(error);
  process.exit(1);
}
