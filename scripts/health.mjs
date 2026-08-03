import { spawn } from "node:child_process";

const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_PORT = "4176";
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: options.env ?? process.env,
      stdio: "inherit",
      shell: process.platform === "win32",
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPreview(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(PREVIEW_URL, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
      lastError = new Error(`Preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(500);
  }

  throw new Error(`Preview did not become healthy at ${PREVIEW_URL}: ${lastError?.message || "timeout"}`);
}

async function ensureChromium() {
  try {
    await run("node", [
      "-e",
      "import('playwright').then(async ({ chromium }) => { const browser = await chromium.launch({ headless: true }); await browser.close(); })",
    ]);
  } catch {
    console.log("\nPlaywright Chromium is missing; installing browser dependencies.\n");
    await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
  }
}

async function main() {
  console.log("\n== App health: dependency audit ==\n");
  await run("npm", ["audit", "--audit-level=moderate"]);

  console.log("\n== App health: theme unit tests ==\n");
  await run("npm", ["run", "test:theme"]);

  console.log("\n== App health: production build ==\n");
  await run("npm", ["run", "build"]);

  console.log("\n== App health: browser smoke ==\n");
  await ensureChromium();

  const previewEnv = {
    ...process.env,
    VITE_SUPABASE_URL: "",
    VITE_SUPABASE_ANON_KEY: "",
    VITE_OWNER_EMAIL: "",
  };
  const preview = spawn("npm", ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT], {
    detached: process.platform !== "win32",
    env: previewEnv,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  try {
    await waitForPreview();
    await run("npm", ["run", "test:e2e-theme"], {
      env: { ...previewEnv, E2E_BASE: PREVIEW_URL },
    });
  } finally {
    if (!preview.killed) {
      if (process.platform === "win32") {
        preview.kill("SIGTERM");
      } else {
        process.kill(-preview.pid, "SIGTERM");
      }
    }
  }

  console.log("\nApp health check passed.\n");
}

main().catch((error) => {
  console.error("\nApp health check failed.");
  console.error(error);
  process.exit(1);
});
