/**
 * Browser smoke: overpaying a $50 debt records $50 (not $500) and does not
 * record a false $1k milestone when total paid was far below $1k.
 */
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE || "http://127.0.0.1:4175/";
const DEBT_NAME = `Overpay ${Date.now()}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByText("Debt Destroyer").first().waitFor({ timeout: 15000 });
  if (await page.getByText("OWNER ACCESS").count()) {
    throw new Error("Login gate present — run without Supabase env for local-only e2e");
  }

  await page.getByRole("button", { name: "Debts" }).click();
  await page.getByRole("button", { name: "Add debt" }).click();
  await page.getByPlaceholder("Chase Freedom").fill(DEBT_NAME);
  await page.getByPlaceholder("$0.00").first().fill("50");
  await page.getByRole("button", { name: "Add debt" }).last().click();
  await page.getByText(DEBT_NAME, { exact: true }).waitFor({ timeout: 5000 });

  await page.getByRole("button", { name: "Log payment" }).first().click();
  await page.getByPlaceholder("$ amount").fill("500");
  await page.getByTitle("Confirm payment").click();

  // Wait for debounced autosave
  await page.waitForTimeout(1200);

  const stored = await page.evaluate((name) => {
    const raw = localStorage.getItem("debt-destroyer:v2");
    if (!raw) return null;
    const state = JSON.parse(raw);
    const debt = (state.debts || []).find((d) => d.name === name);
    return debt
      ? {
          balance: debt.balance,
          paid: debt.paid,
          lastPayment: debt.payments?.[0]?.amount,
          milestonesSeen: state.milestonesSeen || [],
        }
      : null;
  }, DEBT_NAME);

  if (!stored) throw new Error("Debt not found in localStorage after payment");
  if (Math.abs(stored.lastPayment - 50) > 0.001) {
    throw new Error(`Expected applied payment $50, got ${stored.lastPayment}`);
  }
  if (Math.abs(stored.balance) > 0.01) {
    throw new Error(`Expected balance ~0 after overpay, got ${stored.balance}`);
  }
  if (stored.milestonesSeen.includes(1000)) {
    throw new Error("False $1k milestone recorded after overpaying a $50 debt");
  }

  console.log("ok  - e2e overpay applies $50 and skips false $1k milestone");
} catch (error) {
  console.error("FAIL - e2e milestone overpay");
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
