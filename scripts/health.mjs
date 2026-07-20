import { spawn } from "node:child_process";

const PREVIEW_URL = "http://127.0.0.1:4176/";
const LOCAL_ONLY_ENV_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_OWNER_EMAIL"
];

function localOnlyEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const key of LOCAL_ONLY_ENV_KEYS) {
    delete env[key];
  }
  return env;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options
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
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`Preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Preview did not become ready at ${url}: ${lastError?.message || "timed out"}`);
}

async function withPreview(fn) {
  let stoppingPreview = false;
  const preview = spawn(
    "npm",
    ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4176", "--strictPort"],
    {
      stdio: "inherit",
      detached: process.platform !== "win32",
      shell: process.platform === "win32",
      env: localOnlyEnv()
    }
  );

  const previewExited = new Promise((resolve) => {
    preview.on("error", (error) => {
      resolve({ error });
    });
    preview.on("exit", (code, signal) => {
      resolve({ code, signal });
    });
  });

  try {
    const startupResult = await Promise.race([
      waitForPreview(PREVIEW_URL).then(() => null),
      previewExited
    ]);
    if (startupResult) {
      const reason = startupResult.error?.message || startupResult.signal || `exit code ${startupResult.code}`;
      throw new Error(`Preview stopped before it was ready with ${reason}`);
    }
    await fn();
  } finally {
    if (preview.pid && !preview.killed) {
      stoppingPreview = true;
      if (process.platform === "win32") {
        preview.kill();
      } else {
        try {
          process.kill(-preview.pid, "SIGTERM");
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
        }
      }
    }
    if (stoppingPreview) {
      await previewExited;
    }
  }
}

async function main() {
  await run("npm", ["audit", "--audit-level=moderate"]);
  await run("npm", ["run", "test"]);
  await run("npm", ["run", "build"], { env: localOnlyEnv() });
  await withPreview(async () => {
    await run("npm", ["run", "test:e2e-theme"], {
      env: localOnlyEnv({ E2E_BASE: PREVIEW_URL })
    });
  });

  console.log("\nApplication health check passed.");
}

main().catch((error) => {
  console.error("\nApplication health check failed.");
  console.error(error);
  process.exit(1);
});
