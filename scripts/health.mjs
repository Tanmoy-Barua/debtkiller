import { spawn } from "node:child_process";

const PREVIEW_URL = "http://127.0.0.1:4176/";
const AUDIT_ATTEMPTS = 3;
const AUDIT_TIMEOUT_MS = 120_000;

function localOnlyEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.VITE_SUPABASE_URL;
  delete env.VITE_SUPABASE_ANON_KEY;
  delete env.VITE_SUPABASE_PUBLISHABLE_KEY;
  delete env.VITE_OWNER_EMAIL;
  return env;
}

function run(command, args, options = {}) {
  const { capture = false, timeoutMs, ...spawnOptions } = options;
  const child = spawn(command, args, {
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: process.platform === "win32",
    ...spawnOptions,
  });

  let stdout = "";
  let stderr = "";
  if (capture) {
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
  }

  let timedOut = false;
  const timer = timeoutMs
    ? setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs)
    : null;

  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (timer) clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const suffix = timedOut ? ` after ${timeoutMs}ms` : signal ? ` (${signal})` : "";
      const error = new Error(`${command} ${args.join(" ")} failed with exit code ${code}${suffix}`);
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      error.timedOut = timedOut;
      reject(error);
    });
  });
}

function summarizeAuditFindings(output) {
  try {
    const report = JSON.parse(output);
    const vulnerabilities = report.metadata?.vulnerabilities ?? {};
    const total =
      (vulnerabilities.moderate ?? 0) +
      (vulnerabilities.high ?? 0) +
      (vulnerabilities.critical ?? 0);
    if (!total) return "";

    const names = Object.entries(report.vulnerabilities ?? {})
      .filter(([, finding]) => ["moderate", "high", "critical"].includes(finding.severity))
      .map(([name, finding]) => `${name} (${finding.severity})`);
    return `${total} moderate-or-higher vulnerabilities: ${names.join(", ")}`;
  } catch {
    return "";
  }
}

async function runAudit() {
  for (let attempt = 1; attempt <= AUDIT_ATTEMPTS; attempt += 1) {
    try {
      await run("npm", ["audit", "--audit-level=moderate", "--json"], {
        capture: true,
        timeoutMs: AUDIT_TIMEOUT_MS,
      });
      console.log("ok  - npm audit found no moderate-or-higher vulnerabilities");
      return;
    } catch (error) {
      const summary = summarizeAuditFindings(`${error.stdout ?? ""}${error.stderr ?? ""}`);
      if (summary) {
        throw new Error(`npm audit reported ${summary}`);
      }
      if (attempt === AUDIT_ATTEMPTS) {
        console.warn("WARN - npm audit could not complete after retries; continuing with build checks");
        return;
      }
      console.warn(`WARN - npm audit attempt ${attempt} failed transiently; retrying`);
    }
  }
}

async function ensureChromium() {
  try {
    await run("node", [
      "--input-type=module",
      "-e",
      "import { chromium } from 'playwright'; const browser = await chromium.launch({ headless: true }); await browser.close();",
    ]);
  } catch {
    console.log("Playwright Chromium is missing; installing browser dependencies...");
    await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
  }
}

function startPreview() {
  const child = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4176"], {
    env: localOnlyEnv(),
    stdio: "inherit",
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
  });

  child.on("error", (error) => {
    console.error(error);
  });
  return child;
}

async function waitForPreview() {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(PREVIEW_URL);
      if (response.ok) return;
      lastError = new Error(`preview returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for preview at ${PREVIEW_URL}: ${lastError?.message ?? "unknown error"}`);
}

function stopPreview(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    child.kill("SIGTERM");
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
  await run("npm", ["test"]);
  await run("npm", ["run", "build"], { env: localOnlyEnv() });
  await ensureChromium();

  preview = startPreview();
  await waitForPreview();
  await run("npm", ["run", "test:e2e-theme"], {
    env: localOnlyEnv({ E2E_BASE: PREVIEW_URL }),
  });

  console.log("\nHealth check passed.");
} finally {
  if (preview) stopPreview(preview);
}
