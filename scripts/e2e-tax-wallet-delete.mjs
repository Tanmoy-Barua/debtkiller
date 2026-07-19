/**
 * Browser smoke: log earning → tax wallet rises → delete earning → tax wallet restored.
 */
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE || "http://127.0.0.1:4174/";
const NOTE = `TaxDelete ${Date.now()}`;

function parseUsd(text) {
  const m = String(text || "").replace(/,/g, "").match(/\$?-?\d+(?:\.\d+)?/);
  if (!m) return NaN;
  return Number(m[0].replace("$", ""));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(BASE, { waitUntil: "networkidle", cache: "no-store" });
  await page.getByText("Debt Destroyer").first().waitFor({ timeout: 15000 });
  if (await page.getByText("OWNER ACCESS").count()) {
    throw new Error("Login gate present — run without Supabase env for local-only e2e");
  }

  const readWallet = async () => {
    await page.getByRole("button", { name: "Home" }).click();
    const card = page
      .locator("div")
      .filter({ has: page.getByText("TAX WALLET", { exact: true }) })
      .filter({ hasText: "Paid tax" })
      .first();
    await card.waitFor({ timeout: 8000 });
    const amountText = await card.locator("div").nth(1).innerText();
    return parseUsd(amountText);
  };

  const before = await readWallet();

  await page.getByRole("button", { name: "Money" }).click();
  await page.getByRole("button", { name: "Log earnings" }).click();
  await page.getByPlaceholder("$0.00").first().fill("1000");
  await page.getByPlaceholder("Busy Friday night").fill(NOTE);
  await page.getByRole("button", { name: "Save shift" }).click();
  await page.getByText(NOTE).waitFor({ timeout: 8000 });

  const afterAdd = await readWallet();
  const expectedAdd = before + 150; // 15% of $1000
  if (Math.abs(afterAdd - expectedAdd) > 0.05) {
    throw new Error(`Expected wallet ${expectedAdd} after add, got ${afterAdd} (before=${before})`);
  }

  await page.getByRole("button", { name: "Money" }).click();
  await page.getByText(NOTE).waitFor({ timeout: 5000 });
  await page.getByTitle("Delete earning").click();
  await page.getByText(NOTE).waitFor({ state: "detached", timeout: 5000 });
  await page.waitForTimeout(400);

  const afterDelete = await readWallet();
  if (Math.abs(afterDelete - before) > 0.05) {
    throw new Error(`Expected wallet back to ${before} after delete, got ${afterDelete}`);
  }

  console.log("ok  - e2e tax wallet restored after deleting earning");
} catch (error) {
  console.error("FAIL - e2e tax wallet delete");
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
