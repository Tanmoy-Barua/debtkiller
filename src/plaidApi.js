import { getSession } from "./cloudStore.js";

async function authHeaders() {
  const session = await getSession();
  if (!session?.access_token) throw new Error("Sign in required for Plaid");
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

async function api(path, options = {}) {
  const headers = await authHeaders();
  const res = await fetch(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function createLinkToken() {
  return api("/api/plaid/create-link-token", { method: "POST", body: "{}" });
}

export function exchangePublicToken(public_token, institution) {
  return api("/api/plaid/exchange", {
    method: "POST",
    body: JSON.stringify({ public_token, institution }),
  });
}

export function syncPlaidAccounts() {
  return api("/api/plaid/sync", { method: "POST", body: "{}" });
}

/** Merge Plaid liability accounts into local debts list. */
export function mergePlaidAccountsIntoDebts(existingDebts, accounts, today) {
  let next = [...existingDebts];
  let added = 0;
  let updated = 0;

  for (const acct of accounts) {
    const balance = Number(acct.balance) || 0;
    const idx = next.findIndex(
      (d) =>
        d.plaidAccountId === acct.plaidAccountId ||
        (d.name || "").toLowerCase() === (acct.name || "").toLowerCase()
    );

    if (idx >= 0) {
      const cur = next[idx];
      const originalBalance = Math.max(asMoney(cur.originalBalance), balance);
      next[idx] = {
        ...cur,
        name: acct.name || cur.name,
        balance,
        originalBalance,
        min: acct.min ?? cur.min,
        group: acct.group || cur.group,
        type: acct.type || cur.type,
        paid: balance <= 0.005,
        plaidAccountId: acct.plaidAccountId,
        plaidMask: acct.mask || cur.plaidMask || null,
        plaidSyncedAt: today,
      };
      updated += 1;
    } else {
      next.unshift({
        id: Date.now() + Math.floor(Math.random() * 1000) + added,
        name: acct.name,
        balance,
        originalBalance: balance,
        min: acct.min || null,
        deadline: null,
        type: acct.type || "Linked via Plaid",
        group: acct.group || "card",
        paid: balance <= 0.005,
        payments: [],
        createdAt: today,
        plaidAccountId: acct.plaidAccountId,
        plaidMask: acct.mask || null,
        plaidSyncedAt: today,
      });
      added += 1;
    }
  }

  return { debts: next, added, updated };
}

function asMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}
