/**
 * Browser smoke test: add a debt in local-only mode, reload, confirm it persists.
 */
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE || "http://127.0.0.1:4173/";
const DEBT_NAME = `Persist Test ${Date.now()}`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByText("Debt Destroyer").first().waitFor({ timeout: 15000 });

  // Local-only mode should skip login
  if (await page.getByText("OWNER ACCESS").count()) {
    throw new Error("Unexpected login gate — cloud appears enabled; need local-only for this test");
  }

  await page.getByRole("button", { name: "Debts" }).click();
  await page.getByRole("button", { name: "Add debt" }).click();
  await page.getByPlaceholder("Chase Freedom").fill(DEBT_NAME);
  await page.getByPlaceholder("$0.00").first().fill("123.45");
  await page.getByRole("button", { name: "Add debt" }).last().click();
  await page.getByText(DEBT_NAME).waitFor({ timeout: 5000 });

  // Wait for debounced autosave
  await page.waitForTimeout(1200);

  const stored = await page.evaluate(() => localStorage.getItem("debt-destroyer:v2"));
  if (!stored || !stored.includes(DEBT_NAME)) {
    throw new Error("localStorage missing saved debt after autosave");
  }

  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Debt Destroyer").first().waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Debts" }).click();
  await page.getByText(DEBT_NAME).waitFor({ timeout: 10000 });

  console.log("ok  - e2e local reload keeps debt:", DEBT_NAME);
} catch (error) {
  console.error("FAIL - e2e local reload");
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
