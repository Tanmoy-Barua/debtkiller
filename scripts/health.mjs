import { spawn } from "node:child_process";
import process from "node:process";

const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_PORT = "4176";
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;

const localEnv = {
  ...process.env,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_SUPABASE_PUBLISHABLE_KEY: "",
  VITE_OWNER_EMAIL: "",
};

async function run(command, args, options = {}) {
  const label = [command, ...args].join(" ");
  console.log(`\n> ${label}`);
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  if (code !== 0) {
    throw new Error(`${label} exited with code ${code}`);
  }
}

async function runAudit() {
  const attempts = 3;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await run("npm", ["audit", "--audit-level=moderate"]);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      console.warn(`npm audit failed on attempt ${attempt}; retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
  throw lastError;
}

async function ensureChromium() {
  const check = spawn("node", ["-e", "import('playwright').then(async ({ chromium }) => { const browser = await chromium.launch({ headless: true }); await browser.close(); })"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  const code = await new Promise((resolve) => {
    check.on("error", () => resolve(1));
    check.on("close", resolve);
  });

  if (code === 0) return;
  await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
}

function startPreview() {
  console.log(`\n> npm run preview -- --host ${PREVIEW_HOST} --port ${PREVIEW_PORT} --strictPort`);
  return spawn("npm", ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT, "--strictPort"], {
    env: localEnv,
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitForPreview(child) {
  let output = "";
  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stdout.write(text);
  });
  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stderr.write(text);
  });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Vite preview exited early with code ${child.exitCode}\n${output}`);
    }
    try {
      const response = await fetch(PREVIEW_URL);
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timed out waiting for Vite preview");
}

function stopPreview(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    child.kill();
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

let preview;
try {
  await runAudit();
  await run("npm", ["run", "test:theme"]);
  await run("npm", ["run", "build"], { env: localEnv });
  await ensureChromium();
  preview = startPreview();
  await waitForPreview(preview);
  await run("npm", ["run", "test:e2e-theme"], {
    env: {
      ...localEnv,
      E2E_BASE: PREVIEW_URL,
    },
  });
  console.log("\nHealth check passed.");
} finally {
  if (preview) stopPreview(preview);
}
