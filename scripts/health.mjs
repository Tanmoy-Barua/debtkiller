import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_PORT = "4176";
const PREVIEW_BASE = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;

const cleanEnv = {
  ...process.env,
  E2E_BASE: PREVIEW_BASE,
};

for (const key of [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_OWNER_EMAIL",
]) {
  delete cleanEnv[key];
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: cleanEnv,
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with ${signal || `exit ${code}`}`));
    });
  });
}

async function waitForPreview(processHandle) {
  const deadline = Date.now() + 30_000;
  let lastError;

  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) {
      throw new Error(`vite preview exited early with code ${processHandle.exitCode}`);
    }

    try {
      const response = await fetch(PREVIEW_BASE, { redirect: "manual" });
      if (response.ok || response.status === 304) return;
      lastError = new Error(`preview responded with ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`vite preview did not become ready: ${lastError?.message || "timed out"}`);
}

function stopPreview(processHandle) {
  if (!processHandle || processHandle.exitCode !== null) return;

  if (process.platform !== "win32" && processHandle.pid) {
    try {
      process.kill(-processHandle.pid, "SIGTERM");
      return;
    } catch {
      // Fall through to killing the child directly.
    }
  }

  processHandle.kill("SIGTERM");
}

async function main() {
  await run("npm", ["audit", "--audit-level=moderate"]);
  await run("npm", ["run", "test:theme"]);
  await run("npm", ["run", "build"]);

  if (!existsSync(chromium.executablePath())) {
    await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
  }

  let preview;
  try {
    preview = spawn("npm", ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT, "--strictPort"], {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: cleanEnv,
      detached: process.platform !== "win32",
    });

    await waitForPreview(preview);
    await run("npm", ["run", "test:e2e-theme"]);
  } finally {
    stopPreview(preview);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
