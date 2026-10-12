import { existsSync } from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const previewUrl = "http://127.0.0.1:4176/";
const localOnlyEnv = {
  ...process.env,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_SUPABASE_PUBLISHABLE_KEY: "",
  VITE_OWNER_EMAIL: "",
};

async function run(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: options.env ?? process.env,
    shell: process.platform === "win32",
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
    output += chunk;
  });

  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  if (code !== 0) {
    const error = new Error(`${command} ${args.join(" ")} exited with ${code}`);
    error.output = output;
    throw error;
  }

  return output;
}

function hasAuditFindings(output) {
  return output.includes("# npm audit report") || /\d+\s+vulnerabilit(?:y|ies)/i.test(output);
}

async function auditWithRetries() {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await run("npm", ["audit", "--audit-level=moderate"]);
      return;
    } catch (error) {
      if (hasAuditFindings(error.output || "") || attempt === 3) throw error;
      console.warn(`npm audit failed without findings; retrying (${attempt}/3)...`);
      await delay(2000 * attempt);
    }
  }
}

async function ensureChromium() {
  const executable = chromium.executablePath();
  if (existsSync(executable)) return;

  console.log(`Playwright Chromium missing at ${executable}; installing...`);
  await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
}

function waitForHttp(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      request.on("error", retry);
      request.setTimeout(3000, () => {
        request.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(check, 500);
    };

    check();
  });
}

async function withPreview(fn) {
  const child = spawn(
    "npm",
    ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4176", "--strictPort"],
    {
      stdio: "inherit",
      env: localOnlyEnv,
      detached: process.platform !== "win32",
      shell: process.platform === "win32",
    },
  );

  try {
    await waitForHttp(previewUrl);
    await fn();
  } finally {
    if (process.platform === "win32") {
      child.kill();
    } else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    }
  }
}

await auditWithRetries();
await run("npm", ["run", "test:theme"], { env: localOnlyEnv });
await run("npm", ["run", "build"], { env: localOnlyEnv });
await ensureChromium();
await withPreview(async () => {
  await run("npm", ["run", "test:e2e-theme"], {
    env: {
      ...localOnlyEnv,
      E2E_BASE: previewUrl,
    },
  });
});
