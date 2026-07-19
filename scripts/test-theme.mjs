import assert from "node:assert/strict";
import { LIGHT, DARK, resolveThemeMode, paletteFor } from "../src/theme.js";

function run(name, fn) {
  try {
    fn();
    console.log(`ok  - ${name}`);
  } catch (error) {
    console.error(`FAIL - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

run("dark and light palettes expose required keys", () => {
  for (const key of ["pageBg", "surface", "text", "green", "lane", "navBg", "asphalt"]) {
    assert.equal(typeof DARK[key], "string", `dark.${key}`);
    assert.equal(typeof LIGHT[key], "string", `light.${key}`);
  }
  assert.notEqual(DARK.pageBg, LIGHT.pageBg);
  assert.notEqual(DARK.text, LIGHT.text);
});

run("resolveThemeMode respects explicit preference", () => {
  assert.equal(resolveThemeMode("light"), "light");
  assert.equal(resolveThemeMode("dark"), "dark");
});

run("paletteFor returns matching mode", () => {
  assert.equal(paletteFor("light").mode, "light");
  assert.equal(paletteFor("dark").mode, "dark");
});

if (process.exitCode) {
  console.error("\nTheme tests failed.");
  process.exit(1);
}
console.log("\nAll theme tests passed.");
