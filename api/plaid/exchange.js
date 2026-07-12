import { getPlaidClient, mapLiabilityAccounts } from "../_lib/plaid.js";
import { allowCors, getServiceClient, readJson, requireUser, sendJson } from "../_lib/auth.js";
import { CountryCode } from "plaid";

export default async function handler(req, res) {
  allowCors(req, res);
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const { user } = await requireUser(req);
    const body = await readJson(req);
    const publicToken = body.public_token;
    if (!publicToken) return sendJson(res, 400, { error: "public_token required" });

    const client = getPlaidClient();
    const exchange = await client.itemPublicTokenExchange({ public_token: publicToken });
    const accessToken = exchange.data.access_token;
    const itemId = exchange.data.item_id;

    let institutionName = body.institution?.name || "Linked institution";
    try {
      const item = await client.itemGet({ access_token: accessToken });
      const institutionId = item.data.item.institution_id;
      if (institutionId) {
        const inst = await client.institutionsGetById({
          institution_id: institutionId,
          country_codes: [CountryCode.Us],
        });
        institutionName = inst.data.institution.name || institutionName;
      }
    } catch (_) {
      /* institution lookup optional */
    }

    let accounts = [];
    try {
      const liabilities = await client.liabilitiesGet({ access_token: accessToken });
      accounts = mapLiabilityAccounts(liabilities);
    } catch (error) {
      // Some items may not support liabilities; fall back to account balances
      const bal = await client.accountsGet({ access_token: accessToken });
      accounts = (bal.data.accounts || [])
        .filter((a) => a.type === "credit" || a.type === "loan")
        .map((a) => ({
          plaidAccountId: a.account_id,
          name: a.official_name || a.name || "Linked account",
          balance: Math.abs(Number(a.balances?.current ?? 0)),
          min: null,
          group: a.type === "credit" ? "card" : "loan",
          type: `Linked via Plaid · ${a.subtype || a.type}`,
          mask: a.mask || null,
          subtype: a.subtype || a.type,
        }));
    }

    const service = getServiceClient();
    let persisted = false;
    if (service) {
      const { error } = await service.from("plaid_items").upsert(
        {
          user_id: user.id,
          item_id: itemId,
          access_token: accessToken,
          institution_name: institutionName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "item_id" }
      );
      if (error) console.error("plaid_items upsert", error);
      else persisted = true;
    }

    return sendJson(res, 200, {
      item_id: itemId,
      institution_name: institutionName,
      accounts,
      persisted,
      message: persisted
        ? "Linked and saved for future sync"
        : "Linked for this import. Add SUPABASE_SERVICE_ROLE_KEY to enable refresh sync.",
    });
  } catch (error) {
    console.error("exchange", error?.response?.data || error);
    return sendJson(res, error.status || 500, {
      error: error?.response?.data?.error_message || error.message || "Could not link account",
    });
  }
}
