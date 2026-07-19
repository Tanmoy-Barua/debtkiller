import { spawn } from "node:child_process";

const PREVIEW_URL = process.env.E2E_BASE || "http://127.0.0.1:4176/";
const PREVIEW_ARGS = ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4176", "--strictPort"];

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
      reject(new Error(`${command} ${args.join(" ")} failed with ${signal || `exit code ${code}`}`));
    });
  });
}

async function waitForPreview(url, timeoutMs = 30000) {
  const start = Date.now();
  let lastError;

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return;
      lastError = new Error(`Preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Preview did not become ready at ${url}: ${lastError?.message || "timed out"}`);
}

async function main() {
  await run("npm", ["audit", "--audit-level=moderate"]);
  await run("npm", ["test"]);
  await run("npm", ["run", "build"]);

  const preview = spawn("npm", PREVIEW_ARGS, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, E2E_BASE: PREVIEW_URL },
  });

  try {
    await waitForPreview(PREVIEW_URL);
    await run("npm", ["run", "test:e2e-theme"], {
      env: { ...process.env, E2E_BASE: PREVIEW_URL },
    });
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error("FAIL - app health check");
  console.error(error);
  process.exit(1);
});
