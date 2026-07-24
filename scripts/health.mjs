import { spawn } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const HOST = "127.0.0.1";
const PORT = Number(process.env.HEALTH_PREVIEW_PORT || 4176);
const BASE = `http://${HOST}:${PORT}/`;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: process.platform === "win32",
      stdio: "inherit",
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

async function waitForPort(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await canConnect()) return;
    await delay(500);
  }
  throw new Error(`Timed out waiting for Vite preview at ${BASE}`);
}

function canConnect() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: HOST, port: PORT });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function ensureChromium() {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    await browser.close();
  } catch (error) {
    console.warn("Playwright Chromium is unavailable; installing browser dependencies.");
    console.warn(error?.message || error);
    await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
  }
}

function startPreview() {
  const env = {
    ...process.env,
    VITE_SUPABASE_URL: "",
    VITE_SUPABASE_ANON_KEY: "",
    VITE_OWNER_EMAIL: "",
  };
  return spawn("npm", ["run", "preview", "--", "--host", HOST, "--port", String(PORT), "--strictPort"], {
    detached: process.platform !== "win32",
    env,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
}

function stopPreview(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  if (process.platform === "win32") {
    child.kill("SIGTERM");
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

let preview;
let stoppingPreview = false;

try {
  await run("npm", ["audit", "--audit-level=moderate"]);
  await run("npm", ["run", "test:theme"]);
  await run("npm", ["run", "build"]);
  await ensureChromium();

  preview = startPreview();
  preview.on("exit", (code, signal) => {
    if (stoppingPreview) return;
    if (code !== null && code !== 0) {
      console.error(`Vite preview exited early with code ${code}`);
    } else if (signal) {
      console.error(`Vite preview exited early from signal ${signal}`);
    }
  });

  await waitForPort();
  await run("npm", ["run", "test:e2e-theme"], {
    env: { ...process.env, E2E_BASE: BASE },
  });
  console.log("\nApplication health check passed.");
} finally {
  stoppingPreview = true;
  stopPreview(preview);
}
