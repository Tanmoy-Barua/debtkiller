import { spawn } from "node:child_process";
import { once } from "node:events";

const PREVIEW_PORT = process.env.HEALTH_PREVIEW_PORT || "4176";
const PREVIEW_HOST = "127.0.0.1";
const previewUrl = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;

const localOnlyEnv = {
  ...process.env,
  E2E_BASE: process.env.E2E_BASE || previewUrl,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_SUPABASE_PUBLISHABLE_KEY: "",
  VITE_OWNER_EMAIL: "",
};

function command(bin, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${bin} ${args.join(" ")} failed with ${signal || `exit ${code}`}`));
      }
    });
  });
}

async function ensureChromium() {
  try {
    await command(
      "node",
      ["-e", "import('playwright').then(async ({ chromium }) => { const browser = await chromium.launch({ headless: true }); await browser.close(); })"],
      { stdio: "ignore" },
    );
  } catch {
    console.log("\nPlaywright Chromium is missing; installing browser dependencies...");
    await command("npx", ["playwright", "install", "--with-deps", "chromium"]);
  }
}

async function waitForPreview(child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Preview exited before becoming ready with exit ${child.exitCode}`);
    }

    try {
      const response = await fetch(previewUrl);
      if (response.ok) return;
    } catch {
      // Vite preview is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Preview did not become ready at ${previewUrl}`);
}

function stopPreview(child) {
  if (child.exitCode !== null) return;

  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, "SIGTERM");
      return;
    } catch {
      // Fall through to killing just the child process.
    }
  }

  child.kill("SIGTERM");
}

async function main() {
  console.log("== npm audit ==");
  await command("npm", ["audit", "--audit-level=moderate"]);

  console.log("\n== theme unit tests ==");
  await command("npm", ["run", "test:theme"], { env: localOnlyEnv });

  console.log("\n== production build ==");
  await command("npm", ["run", "build"], { env: localOnlyEnv });

  console.log("\n== Playwright browser ==");
  await ensureChromium();

  console.log("\n== preview smoke ==");
  const preview = spawn("npm", ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT, "--strictPort"], {
    detached: process.platform !== "win32",
    env: localOnlyEnv,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  const previewError = new Promise((_, reject) => preview.once("error", reject));

  try {
    await Promise.race([waitForPreview(preview), previewError]);
    await command("npm", ["run", "test:e2e-theme"], { env: localOnlyEnv });
  } finally {
    stopPreview(preview);
    await Promise.race([
      once(preview, "exit"),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }
}

main().catch((error) => {
  console.error("\nHealth check failed.");
  console.error(error);
  process.exit(1);
});
