import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

export function getPlaidClient() {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const envName = (process.env.PLAID_ENV || "sandbox").toLowerCase();

  if (!clientId || !secret) {
    const err = new Error("Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET.");
    err.status = 503;
    throw err;
  }

  const basePath =
    envName === "production"
      ? PlaidEnvironments.production
      : envName === "development"
        ? PlaidEnvironments.development
        : PlaidEnvironments.sandbox;

  const configuration = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  return new PlaidApi(configuration);
}

export function mapLiabilityAccounts(liabilitiesResponse) {
  const accounts = liabilitiesResponse?.data?.accounts || [];
  const liab = liabilitiesResponse?.data?.liabilities || {};
  const creditById = Object.fromEntries((liab.credit || []).map((c) => [c.account_id, c]));
  const studentById = Object.fromEntries((liab.student || []).map((s) => [s.account_id, s]));
  const mortgageById = Object.fromEntries((liab.mortgage || []).map((m) => [m.account_id, m]));

  return accounts
    .filter((a) => a.type === "credit" || a.type === "loan")
    .map((a) => {
      const credit = creditById[a.account_id];
      const student = studentById[a.account_id];
      const mortgage = mortgageById[a.account_id];
      const balance = Math.abs(Number(a.balances?.current ?? a.balances?.available ?? 0));
      const min =
        Number(credit?.minimum_payment_amount) ||
        Number(student?.minimum_payment_amount) ||
        Number(mortgage?.next_monthly_payment) ||
        null;
      const apr =
        credit?.aprs?.find((x) => x.apr_type === "purchase_apr")?.apr_percentage ??
        credit?.aprs?.[0]?.apr_percentage ??
        null;
      const group = a.type === "credit" || a.subtype === "credit card" ? "card" : "loan";
      return {
        plaidAccountId: a.account_id,
        name: a.official_name || a.name || "Linked account",
        balance,
        min: min && min > 0 ? min : null,
        group,
        type: apr != null ? `Linked · ${apr}% APR` : `Linked via Plaid · ${a.subtype || a.type}`,
        mask: a.mask || null,
        subtype: a.subtype || a.type,
      };
    });
}
