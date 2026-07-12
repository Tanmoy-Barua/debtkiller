import { getPlaidClient, mapLiabilityAccounts } from "../_lib/plaid.js";
import { allowCors, getServiceClient, requireUser, sendJson } from "../_lib/auth.js";

export default async function handler(req, res) {
  allowCors(req, res);
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const { user } = await requireUser(req);
    const service = getServiceClient();
    if (!service) {
      return sendJson(res, 503, {
        error: "Refresh sync needs SUPABASE_SERVICE_ROLE_KEY on the server.",
      });
    }

    const { data: items, error } = await service
      .from("plaid_items")
      .select("item_id, access_token, institution_name")
      .eq("user_id", user.id);
    if (error) throw error;
    if (!items?.length) return sendJson(res, 200, { connections: [], accounts: [] });

    const client = getPlaidClient();
    const connections = [];
    const accounts = [];

    for (const item of items) {
      try {
        const liabilities = await client.liabilitiesGet({ access_token: item.access_token });
        const mapped = mapLiabilityAccounts(liabilities).map((a) => ({
          ...a,
          institutionName: item.institution_name,
          itemId: item.item_id,
        }));
        accounts.push(...mapped);
        connections.push({
          item_id: item.item_id,
          institution_name: item.institution_name,
          account_count: mapped.length,
        });
      } catch (err) {
        console.error("sync item", item.item_id, err?.response?.data || err);
        connections.push({
          item_id: item.item_id,
          institution_name: item.institution_name,
          error: err?.response?.data?.error_message || err.message || "Sync failed",
        });
      }
    }

    return sendJson(res, 200, { connections, accounts, synced_at: new Date().toISOString() });
  } catch (error) {
    console.error("sync", error?.response?.data || error);
    return sendJson(res, error.status || 500, {
      error: error?.response?.data?.error_message || error.message || "Sync failed",
    });
  }
}
