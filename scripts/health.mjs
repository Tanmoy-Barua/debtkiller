import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const previewUrl = "http://127.0.0.1:4176/";

function localOnlyEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.VITE_SUPABASE_URL;
  delete env.VITE_SUPABASE_ANON_KEY;
  delete env.VITE_SUPABASE_PUBLISHABLE_KEY;
  delete env.VITE_OWNER_EMAIL;
  return env;
}

function run(command, args, options = {}) {
  const { retries = 1, env = process.env } = options;

  return new Promise((resolve, reject) => {
    let attempt = 0;

    const start = () => {
      attempt += 1;
      const child = spawn(command, args, {
        stdio: "inherit",
        shell: process.platform === "win32",
        env,
      });

      child.on("error", reject);
      child.on("exit", async (code, signal) => {
        if (code === 0) {
          resolve();
          return;
        }

        if (attempt < retries) {
          console.warn(
            `Command failed (${command} ${args.join(" ")}) with ${signal || code}; retrying ${attempt + 1}/${retries}...`,
          );
          await delay(1500 * attempt);
          start();
          return;
        }

        reject(new Error(`Command failed: ${command} ${args.join(" ")} (${signal || code})`));
      });
    };

    start();
  });
}

async function ensureChromium() {
  const { chromium } = await import("playwright");
  if (existsSync(chromium.executablePath())) {
    return;
  }

  console.warn("Playwright Chromium is missing; installing browser dependencies...");
  await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
}

async function waitForPreview() {
  const startedAt = Date.now();
  const timeoutMs = 45_000;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(previewUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // Preview is still booting.
    }
    await delay(500);
  }

  throw new Error(`Preview did not become ready at ${previewUrl}`);
}

function startPreview() {
  return spawn(
    "npm",
    ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4176", "--strictPort"],
    {
      stdio: "inherit",
      detached: process.platform !== "win32",
      shell: process.platform === "win32",
      env: localOnlyEnv(),
    },
  );
}

function stopPreview(child) {
  if (!child.pid || child.exitCode !== null) {
    return;
  }

  try {
    if (process.platform === "win32") {
      child.kill("SIGTERM");
    } else {
      process.kill(-child.pid, "SIGTERM");
    }
  } catch (error) {
    if (error.code !== "ESRCH") {
      throw error;
    }
  }
}

let preview;

try {
  await run("npm", ["audit", "--audit-level=moderate"], { retries: 3 });
  await run("npm", ["run", "test:theme"]);
  await run("npm", ["run", "build"], { env: localOnlyEnv() });
  await ensureChromium();

  preview = startPreview();
  await waitForPreview();
  await run("npm", ["run", "test:e2e-theme"], {
    env: localOnlyEnv({ E2E_BASE: previewUrl }),
  });

  console.log("\nApplication health check passed.");
} finally {
  if (preview) {
    stopPreview(preview);
  }
}
