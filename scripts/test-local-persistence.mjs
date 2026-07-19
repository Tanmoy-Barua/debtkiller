/**
 * Regression tests for local-only save/reload.
 * Catches the bug where loadLocal(null) returned null while save used debt-destroyer:v2.
 */
import assert from "node:assert/strict";
import {
  LEGACY_KEY,
  STORE_KEY,
  clearUnscopedLocalBackups,
  loadLocalBackup,
  localKey,
  saveLocalBackup,
} from "../src/localBackup.js";

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

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

run("localKey(null) uses unscoped v2 key", () => {
  assert.equal(localKey(null), STORE_KEY);
  assert.equal(localKey(undefined), STORE_KEY);
  assert.equal(localKey("user-1"), `${STORE_KEY}:user-1`);
});

run("local-only save then load round-trips", () => {
  const storage = createMemoryStorage();
  const state = {
    debts: [{ id: 1, name: "Card", balance: 100 }],
    earnings: [{ id: 2, date: "2026-07-19", gross: 50 }],
    expenses: [],
    buffer: 25,
  };
  assert.equal(saveLocalBackup(state, null, storage), true);
  assert.ok(storage.getItem(STORE_KEY), "expected unscoped key to be written");
  const loaded = loadLocalBackup(null, storage);
  assert.deepEqual(loaded, state);
});

run("reload after simulated page refresh keeps data", () => {
  const storage = createMemoryStorage();
  const state = { debts: [{ id: 9, name: "Mom", balance: 800 }], earnings: [], expenses: [], buffer: 0 };
  saveLocalBackup(state, null, storage);
  // New "page" — same storage, fresh load call (what App does on boot)
  const again = loadLocalBackup(null, storage);
  assert.equal(again.debts[0].name, "Mom");
  assert.equal(again.debts[0].balance, 800);
});

run("legacy v1 key is read when v2 is empty (local-only)", () => {
  const storage = createMemoryStorage();
  const legacy = { debts: [{ id: 3, name: "Legacy debt", balance: 40 }], earnings: [] };
  storage.setItem(LEGACY_KEY, JSON.stringify(legacy));
  const loaded = loadLocalBackup(null, storage);
  assert.equal(loaded.debts[0].name, "Legacy debt");
});

run("user-scoped key does not fall back to unscoped", () => {
  const storage = createMemoryStorage();
  storage.setItem(STORE_KEY, JSON.stringify({ debts: [{ id: 1, name: "Shared leak" }] }));
  const loaded = loadLocalBackup("user-abc", storage);
  assert.equal(loaded, null);
});

run("user-scoped save/load works", () => {
  const storage = createMemoryStorage();
  const state = { debts: [{ id: 4, name: "Loan", balance: 500 }] };
  saveLocalBackup(state, "user-abc", storage);
  assert.equal(storage.getItem(`${STORE_KEY}:user-abc`) != null, true);
  assert.deepEqual(loadLocalBackup("user-abc", storage), state);
});

run("clearUnscopedLocalBackups only clears unscoped keys", () => {
  const storage = createMemoryStorage();
  saveLocalBackup({ debts: [1] }, null, storage);
  saveLocalBackup({ debts: [2] }, "user-abc", storage);
  clearUnscopedLocalBackups(storage);
  assert.equal(loadLocalBackup(null, storage), null);
  assert.deepEqual(loadLocalBackup("user-abc", storage), { debts: [2] });
});

run("corrupt JSON returns null instead of throwing", () => {
  const storage = createMemoryStorage();
  storage.setItem(STORE_KEY, "{not-json");
  const prev = console.warn;
  console.warn = () => {};
  try {
    assert.equal(loadLocalBackup(null, storage), null);
  } finally {
    console.warn = prev;
  }
});

if (process.exitCode) {
  console.error("\nLocal persistence tests failed.");
  process.exit(1);
}
console.log("\nAll local persistence tests passed.");
