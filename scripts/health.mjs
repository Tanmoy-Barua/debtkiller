import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const HEALTH_ENV = {
  ...process.env,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_SUPABASE_PUBLISHABLE_KEY: "",
  VITE_OWNER_EMAIL: "",
  E2E_BASE: "http://127.0.0.1:4176/",
};

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    console.log(`\n$ ${[command, ...args].join(" ")}`);
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: HEALTH_ENV,
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

const waitForPreview = async (url, timeoutMs = 30000) => {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`preview responded with HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for preview at ${url}: ${lastError?.message || "no response"}`);
};

const ensureChromium = async () => {
  const executablePath = chromium.executablePath();
  if (existsSync(executablePath)) return;

  await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
};

let preview;

try {
  await run("npm", ["audit", "--audit-level=moderate"]);
  await run("npm", ["test"]);
  await run("npm", ["run", "build"]);
  await ensureChromium();

  console.log("\n$ npm run preview -- --host 127.0.0.1 --port 4176 --strictPort");
  preview = spawn(
    "npm",
    ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4176", "--strictPort"],
    {
      stdio: "inherit",
      detached: process.platform !== "win32",
      env: HEALTH_ENV,
      shell: process.platform === "win32",
    }
  );

  await waitForPreview(HEALTH_ENV.E2E_BASE);
  await run("npm", ["run", "test:e2e-theme"]);
  console.log("\nHealth check passed.");
} finally {
  if (preview && !preview.killed) {
    try {
      if (process.platform === "win32") {
        preview.kill();
      } else {
        process.kill(-preview.pid, "SIGTERM");
      }
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
}
