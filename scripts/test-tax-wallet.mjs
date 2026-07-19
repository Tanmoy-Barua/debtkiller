/**
 * Regression: deleting/editing earnings must reverse the exact parked tax,
 * even if the tax rate changed later.
 */
import assert from "node:assert/strict";
import {
  applyTaxEdit,
  applyTaxPark,
  applyTaxUnpark,
  incomeOfEarning,
  taxForIncome,
  taxParkedOf,
} from "../src/taxWallet.js";

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

run("taxForIncome parks 15% of income", () => {
  assert.equal(taxForIncome(1000, 0.15), 150);
  assert.equal(taxForIncome(33.33, 0.15), 5);
});

run("add then delete restores wallet", () => {
  let wallet = 0;
  const income = 200;
  const rate = 0.15;
  const parked = applyTaxPark(wallet, income, rate);
  wallet = parked.wallet;
  assert.equal(wallet, 30);
  const entry = { gross: 200, other: 0, taxParked: parked.taxParked };
  const unparked = applyTaxUnpark(wallet, entry, rate);
  assert.equal(unparked.wallet, 0);
  assert.equal(unparked.taxBite, 30);
});

run("delete uses stored taxParked even if rate changed", () => {
  const entry = { gross: 1000, other: 0, taxParked: 150 }; // parked at 15%
  const result = applyTaxUnpark(150, entry, 0.25); // rate now 25%
  // Must reverse 150, not 250
  assert.equal(result.taxBite, 150);
  assert.equal(result.wallet, 0);
});

run("delete without taxParked falls back to current rate", () => {
  const entry = { gross: 1000, other: 0 }; // legacy row
  const result = applyTaxUnpark(200, entry, 0.15);
  assert.equal(result.taxBite, 150);
  assert.equal(result.wallet, 50);
});

run("edit earning adjusts wallet by tax delta", () => {
  const prev = { gross: 1000, other: 0, taxParked: 150 };
  const result = applyTaxEdit(150, prev, 2000, 0.15);
  assert.equal(result.taxDelta, 150);
  assert.equal(result.taxParked, 300);
  assert.equal(result.wallet, 300);
});

run("edit down then delete clears parked tax", () => {
  let wallet = 0;
  const add = applyTaxPark(wallet, 1000, 0.15);
  wallet = add.wallet;
  let entry = { gross: 1000, other: 0, taxParked: add.taxParked };
  const edited = applyTaxEdit(wallet, entry, 400, 0.15);
  wallet = edited.wallet;
  entry = { ...entry, gross: 400, taxParked: edited.taxParked };
  assert.equal(wallet, 60);
  const removed = applyTaxUnpark(wallet, entry, 0.15);
  assert.equal(removed.wallet, 0);
});

run("incomeOfEarning sums gross + other", () => {
  assert.equal(incomeOfEarning({ gross: 80, other: 20 }), 100);
  assert.equal(taxParkedOf({ gross: 80, other: 20, taxParked: 12 }, 0.15), 12);
});

run("wallet never goes negative on unpark", () => {
  const entry = { gross: 1000, other: 0, taxParked: 150 };
  const result = applyTaxUnpark(40, entry, 0.15); // already withdrew most tax
  assert.equal(result.wallet, 0);
});

if (process.exitCode) {
  console.error("\nTax wallet tests failed.");
  process.exit(1);
}
console.log("\nAll tax wallet tests passed.");
