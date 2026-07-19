/**
 * Browser smoke: Settings → Light theme updates page data-theme attribute.
 */
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE || "http://127.0.0.1:4176/";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByText("Debt Destroyer").first().waitFor({ timeout: 15000 });
  if (await page.getByText("OWNER ACCESS").count()) {
    throw new Error("Login gate present — run without Supabase env for local-only e2e");
  }

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByText("THEME", { exact: true }).waitFor({ timeout: 5000 });

  await page.getByRole("button", { name: "Light" }).click();
  await page.waitForTimeout(400);
  const lightTheme = await page.locator("[data-theme]").first().getAttribute("data-theme");
  if (lightTheme !== "light") throw new Error(`Expected data-theme=light, got ${lightTheme}`);

  const lightBg = await page.evaluate(() => getComputedStyle(document.querySelector("[data-theme]")).color);
  // text should be dark in light mode
  const rgb = lightBg.match(/\d+/g)?.map(Number) || [];
  if (rgb.length >= 3 && rgb[0] + rgb[1] + rgb[2] > 400) {
    throw new Error(`Expected dark text in light theme, got ${lightBg}`);
  }

  await page.getByRole("button", { name: "Dark" }).click();
  await page.waitForTimeout(400);
  const darkTheme = await page.locator("[data-theme]").first().getAttribute("data-theme");
  if (darkTheme !== "dark") throw new Error(`Expected data-theme=dark, got ${darkTheme}`);

  // Persisted preference
  await page.waitForTimeout(900);
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem("debt-destroyer:v2");
    return raw ? JSON.parse(raw)?.settings?.theme : null;
  });
  if (stored !== "dark") throw new Error(`Expected settings.theme=dark in storage, got ${stored}`);

  console.log("ok  - e2e theme toggles light/dark and persists");
} catch (error) {
  console.error("FAIL - e2e theme");
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
