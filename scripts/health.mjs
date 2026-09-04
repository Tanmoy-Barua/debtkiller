import { spawn } from "node:child_process";
import process from "node:process";
import { chromium } from "playwright";

const previewPort = process.env.HEALTH_PREVIEW_PORT || "4176";
const previewHost = "127.0.0.1";
const previewUrl = `http://${previewHost}:${previewPort}/`;

const localEnv = {
  ...process.env,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_SUPABASE_PUBLISHABLE_KEY: "",
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
      reject(new Error(`${command} ${args.join(" ")} failed with ${signal || code}`));
    });
  });
}

function runBuffered(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${[command, ...args].join(" ")}`);
    const child = spawn(command, args, {
      shell: process.platform === "win32",
      ...options,
    });

    let output = "";
    const timeoutMs = options.timeoutMs;
    const timer =
      timeoutMs &&
      setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`${command} ${args.join(" ")} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      process.stdout.write(chunk);
      output += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      process.stderr.write(chunk);
      output += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (timer) clearTimeout(timer);
      resolve({ code, signal, output });
    });
  });
}

function isAuditServiceError(output) {
  return (
    output.includes("audit endpoint returned an error") ||
    output.includes("Internal Server Error") ||
    output.includes("Bad Request") ||
    output.includes("This endpoint is being retired")
  );
}

function isAuditFinding(output) {
  return /# npm audit report/.test(output) || /\b(low|moderate|high|critical) severity vulnerabilities?\b/i.test(output);
}

async function runAudit() {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await runBuffered("npm", ["audit", "--audit-level=moderate"], {
        timeoutMs: 120000,
      });

      if (result.code === 0) return;
      if (isAuditFinding(result.output) && !isAuditServiceError(result.output)) {
        throw new Error("npm audit reported moderate-or-higher vulnerabilities");
      }
      if (attempt === maxAttempts) {
        console.warn("\nWARN - npm audit service unavailable; continuing with build and smoke checks.");
        return;
      }
    } catch (error) {
      if (attempt === maxAttempts) {
        console.warn(`\nWARN - npm audit could not complete: ${error.message}`);
        console.warn("Continuing with build and smoke checks.");
        return;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
  }
}

async function ensureChromium() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    console.warn(`Chromium launch failed; installing browser dependencies. ${error.message}`);
    await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
  } finally {
    await browser?.close();
  }
}

function startPreview() {
  console.log(`\n$ npm run preview -- --host ${previewHost} --port ${previewPort} --strictPort`);
  const child = spawn(
    "npm",
    ["run", "preview", "--", "--host", previewHost, "--port", previewPort, "--strictPort"],
    {
      env: localEnv,
      stdio: "inherit",
      detached: process.platform !== "win32",
      shell: process.platform === "win32",
    },
  );

  child.on("error", (error) => {
    throw error;
  });

  return child;
}

async function waitForPreview(timeoutMs = 30000) {
  const started = Date.now();
  let lastError;

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(previewUrl);
      if (response.ok) return;
      lastError = new Error(`preview responded with ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Preview did not become ready at ${previewUrl}: ${lastError?.message || "unknown error"}`);
}

function stopPreview(child) {
  if (!child || child.killed) return;

  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, "SIGTERM");
      return;
    } catch {
      // Fall back to killing the direct child below.
    }
  }

  child.kill("SIGTERM");
}

let preview;

try {
  await runAudit();
  await run("npm", ["run", "test:theme"]);
  await run("npm", ["run", "build"], { env: localEnv });
  await ensureChromium();
  preview = startPreview();
  await waitForPreview();
  await run("npm", ["run", "test:e2e-theme"], {
    env: {
      ...localEnv,
      E2E_BASE: previewUrl,
    },
  });
  console.log("\nHealth check passed.");
} finally {
  stopPreview(preview);
}
