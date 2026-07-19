/** Pure tax-wallet helpers — keep add / edit / delete math consistent. */

export function asMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function incomeOfEarning(entry) {
  if (!entry || typeof entry !== "object") return 0;
  return asMoney(entry.gross) + asMoney(entry.other);
}

/** Tax to park for a given income at rate (0–1). */
export function taxForIncome(income, taxRate) {
  const rate = Number(taxRate);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return +(asMoney(income) * rate).toFixed(2);
}

/**
 * Amount previously parked for this earning.
 * Prefer stored taxParked so later tax-rate changes don't distort delete/edit.
 */
export function taxParkedOf(entry, taxRate) {
  if (!entry || typeof entry !== "object") return 0;
  if (entry.taxParked != null && entry.taxParked !== "") {
    return asMoney(entry.taxParked);
  }
  return taxForIncome(incomeOfEarning(entry), taxRate);
}

/** Next wallet after parking tax for a new earning. */
export function applyTaxPark(wallet, income, taxRate) {
  const bite = taxForIncome(income, taxRate);
  return { wallet: +(asMoney(wallet) + bite).toFixed(2), taxParked: bite };
}

/** Next wallet after removing an earning (reverse its parked tax). */
export function applyTaxUnpark(wallet, entry, taxRate) {
  const bite = taxParkedOf(entry, taxRate);
  return { wallet: Math.max(0, +(asMoney(wallet) - bite).toFixed(2)), taxBite: bite };
}

/** Next wallet after editing an earning's income. */
export function applyTaxEdit(wallet, prevEntry, nextIncome, taxRate) {
  const prevTax = taxParkedOf(prevEntry, taxRate);
  const nextTax = taxForIncome(nextIncome, taxRate);
  const taxDelta = +(nextTax - prevTax).toFixed(2);
  return {
    wallet: Math.max(0, +(asMoney(wallet) + taxDelta).toFixed(2)),
    taxDelta,
    taxParked: nextTax,
  };
}
