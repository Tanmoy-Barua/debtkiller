/** Pure helpers for payoff milestones ($1k, $2k, …). */

export function asMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** Amount that actually reduces a debt balance (never more than remaining). */
export function appliedPayment(balance, amount) {
  const bal = asMoney(balance);
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return 0;
  return Math.min(bal, amt);
}

/**
 * Which $1k milestones are newly crossed when paid total moves
 * from paidBefore → paidAfter.
 */
export function milestoneCrossings(paidBefore, paidAfter, alreadySeen = [], step = 1000) {
  const before = Math.max(0, Number(paidBefore) || 0);
  const after = Math.max(0, Number(paidAfter) || 0);
  const seen = new Set(alreadySeen);
  const crossed = [];
  if (!(step > 0) || after <= before) return crossed;
  for (let k = step; k <= after; k += step) {
    if (before < k && after >= k && !seen.has(k)) crossed.push(k);
  }
  return crossed;
}
