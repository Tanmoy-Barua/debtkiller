import { spawn } from "node:child_process";

const PREVIEW_ORIGIN = "http://127.0.0.1:4176";
const PREVIEW_URL = `${PREVIEW_ORIGIN}/`;

const localOnlyEnv = {
  ...process.env,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_OWNER_EMAIL: "",
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${[command, ...args].join(" ")}`);
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

function startPreview() {
  console.log(`\n$ npm run preview -- --host 127.0.0.1 --port 4176 --strictPort`);
  const child = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4176", "--strictPort"], {
    env: localOnlyEnv,
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

async function waitForPreview(child, timeoutMs = 30_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Preview server exited early with code ${child.exitCode}`);
    }

    try {
      const response = await fetch(PREVIEW_URL);
      if (response.ok) return;
    } catch {
      // Vite preview is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Preview server did not become healthy at ${PREVIEW_URL}`);
}

async function stopPreview(child) {
  if (child.exitCode !== null) return;

  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => {
      setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
        resolve();
      }, 5_000);
    }),
  ]);
}

let preview;

try {
  await run("npm", ["audit", "--audit-level=moderate"]);
  await run("npm", ["test"]);
  await run("npm", ["run", "build"], { env: localOnlyEnv });

  preview = startPreview();
  await waitForPreview(preview);
  await run("npm", ["run", "test:e2e-theme"], {
    env: {
      ...localOnlyEnv,
      E2E_BASE: PREVIEW_URL,
    },
  });

  console.log("\nApplication health check passed.");
} catch (error) {
  console.error("\nApplication health check failed.");
  console.error(error);
  process.exitCode = 1;
} finally {
  if (preview) await stopPreview(preview);
}
