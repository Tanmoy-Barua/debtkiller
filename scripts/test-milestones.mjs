/**
 * Regression: overpaying a debt must only count the applied balance toward milestones.
 */
import assert from "node:assert/strict";
import { appliedPayment, milestoneCrossings } from "../src/milestones.js";

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

run("appliedPayment caps to remaining balance", () => {
  assert.equal(appliedPayment(50, 500), 50);
  assert.equal(appliedPayment(50, 50), 50);
  assert.equal(appliedPayment(50, 20), 20);
  assert.equal(appliedPayment(0, 100), 0);
  assert.equal(appliedPayment(40, -5), 0);
});

run("overpay does not cross a false $1k milestone", () => {
  // Already paid $980. Overpay $500 on a $50 debt → only +$50 → $1030? No: +50 → $1030 would cross 1000.
  // Better case: paidBefore=$900, overpay $500 on $50 balance → applied $50 → paidAfter=$950 → no $1k yet.
  const paidBefore = 900;
  const applied = appliedPayment(50, 500);
  assert.equal(applied, 50);
  const crossed = milestoneCrossings(paidBefore, paidBefore + applied, []);
  assert.deepEqual(crossed, []);
});

run("typed overpay amount would wrongly cross if not capped (documents the bug)", () => {
  const paidBefore = 900;
  const typed = 500; // what the old code used
  const wrong = milestoneCrossings(paidBefore, paidBefore + typed, []);
  assert.deepEqual(wrong, [1000]); // old buggy behavior
  const right = milestoneCrossings(paidBefore, paidBefore + appliedPayment(50, typed), []);
  assert.deepEqual(right, []);
});

run("legitimate crossing still works", () => {
  const crossed = milestoneCrossings(800, 1200, []);
  assert.deepEqual(crossed, [1000]);
});

run("multiple crossings and already-seen skipped", () => {
  assert.deepEqual(milestoneCrossings(500, 2500, []), [1000, 2000]);
  assert.deepEqual(milestoneCrossings(500, 2500, [1000]), [2000]);
});

run("no progress or zero step yields nothing", () => {
  assert.deepEqual(milestoneCrossings(1000, 1000, []), []);
  assert.deepEqual(milestoneCrossings(1000, 900, []), []);
});

if (process.exitCode) {
  console.error("\nMilestone tests failed.");
  process.exit(1);
}
console.log("\nAll milestone tests passed.");
