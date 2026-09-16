import { spawn } from "node:child_process";
import process from "node:process";

const PREVIEW_URL = "http://127.0.0.1:4176/";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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

      const detail = signal ? `signal ${signal}` : `exit code ${code}`;
      reject(new Error(`${command} ${args.join(" ")} failed with ${detail}`));
    });
  });
}

async function runAuditWithRetries() {
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await run("npm", ["audit", "--audit-level=moderate"]);
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      console.warn(`npm audit attempt ${attempt} failed; retrying...`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
}

async function ensureChromium() {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    await browser.close();
  } catch (error) {
    console.warn("Playwright Chromium is unavailable; installing browser dependencies...");
    await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
  }
}

async function waitForPreview(processHandle) {
  const deadline = Date.now() + 30_000;
  let lastError;

  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) {
      throw new Error(`Vite preview exited early with code ${processHandle.exitCode}`);
    }

    try {
      const response = await fetch(PREVIEW_URL);
      if (response.ok) return;
      lastError = new Error(`Preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for preview: ${lastError?.message || "unknown error"}`);
}

async function runPreviewSmoke() {
  const env = {
    ...process.env,
    VITE_SUPABASE_URL: "",
    VITE_SUPABASE_ANON_KEY: "",
    VITE_SUPABASE_PUBLISHABLE_KEY: "",
    VITE_OWNER_EMAIL: "",
  };

  const preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4176"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    detached: process.platform !== "win32",
    env,
  });

  try {
    await waitForPreview(preview);
    await run("npm", ["run", "test:e2e-theme"], { env: { ...env, E2E_BASE: PREVIEW_URL } });
  } finally {
    if (preview.pid) {
      try {
        if (process.platform === "win32") {
          preview.kill();
        } else {
          process.kill(-preview.pid);
        }
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }
  }
}

const smokeEnv = {
  ...process.env,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_SUPABASE_PUBLISHABLE_KEY: "",
  VITE_OWNER_EMAIL: "",
};

await runAuditWithRetries();
await run("npm", ["test"]);
await run("npm", ["run", "build"], { env: smokeEnv });
await ensureChromium();
await runPreviewSmoke();

console.log("\nApp health check passed.");
