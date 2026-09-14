import { spawn } from "node:child_process";

const AUDIT_ATTEMPTS = 3;
const AUDIT_TIMEOUT_MS = 120_000;
const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_PORT = "4176";
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;

const localOnlyEnv = {
  ...process.env,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_SUPABASE_PUBLISHABLE_KEY: "",
  VITE_OWNER_EMAIL: "",
};

function commandText(command, args) {
  return [command, ...args].join(" ");
}

function run(command, args, options = {}) {
  const label = options.label ?? commandText(command, args);
  console.log(`\n> ${label}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: options.env ?? process.env,
      detached: options.detached ?? false,
    });

    let timedOut = false;
    const timeout = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
        }, options.timeoutMs)
      : null;

    child.on("error", (error) => {
      if (timeout) clearTimeout(timeout);
      reject(error);
    });

    child.on("exit", (code, signal) => {
      if (timeout) clearTimeout(timeout);
      if (code === 0) {
        resolve({ code, signal });
        return;
      }

      const cause = timedOut ? `timed out after ${options.timeoutMs}ms` : `exited with ${code ?? signal}`;
      reject(new Error(`${label} ${cause}`));
    });
  });
}

function startPreview() {
  console.log(`\n> npm run preview -- --host ${PREVIEW_HOST} --port ${PREVIEW_PORT}`);

  const child = spawn(
    "npm",
    ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT],
    {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: localOnlyEnv,
      detached: process.platform !== "win32",
    },
  );

  child.on("error", (error) => {
    throw error;
  });

  return child;
}

async function waitForPreview() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(PREVIEW_URL);
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Preview did not become ready at ${PREVIEW_URL}`);
}

async function runAudit() {
  for (let attempt = 1; attempt <= AUDIT_ATTEMPTS; attempt += 1) {
    try {
      await run("npm", ["audit", "--audit-level=moderate"], {
        label: `npm audit --audit-level=moderate (attempt ${attempt}/${AUDIT_ATTEMPTS})`,
        timeoutMs: AUDIT_TIMEOUT_MS,
      });
      return;
    } catch (error) {
      if (attempt === AUDIT_ATTEMPTS) throw error;
      console.warn(`Audit attempt ${attempt} failed: ${error.message}`);
      console.warn("Retrying in case the npm advisory endpoint was transiently unavailable.");
    }
  }
}

async function ensureChromium() {
  try {
    await run("node", ["-e", "import('playwright').then(async ({ chromium }) => { const browser = await chromium.launch({ headless: true }); await browser.close(); })"], {
      label: "verify Playwright Chromium",
      env: localOnlyEnv,
    });
  } catch {
    await run("npx", ["playwright", "install", "--with-deps", "chromium"], {
      label: "install Playwright Chromium",
      env: localOnlyEnv,
    });
  }
}

async function main() {
  await runAudit();
  await run("npm", ["run", "test:theme"], { env: localOnlyEnv });
  await run("npm", ["run", "build"], { env: localOnlyEnv });
  await ensureChromium();

  const preview = startPreview();
  try {
    await waitForPreview();
    await run("npm", ["run", "test:e2e-theme"], {
      env: {
        ...localOnlyEnv,
        E2E_BASE: PREVIEW_URL,
      },
    });
  } finally {
    if (preview.pid) {
      if (process.platform === "win32") {
        preview.kill("SIGTERM");
      } else {
        try {
          process.kill(-preview.pid, "SIGTERM");
        } catch {
          preview.kill("SIGTERM");
        }
      }
    }
  }
}

main().catch((error) => {
  console.error("\nHealth check failed.");
  console.error(error);
  process.exit(1);
});
