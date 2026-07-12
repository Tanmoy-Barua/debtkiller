import { CountryCode, Products } from "plaid";
import { getPlaidClient } from "../_lib/plaid.js";
import { allowCors, requireUser, sendJson } from "../_lib/auth.js";

export default async function handler(req, res) {
  allowCors(req, res);
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const { user } = await requireUser(req);
    const client = getPlaidClient();
    const response = await client.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: "Debt Destroyer",
      language: "en",
      country_codes: [CountryCode.Us],
      products: [Products.Liabilities],
      optional_products: [Products.Transactions],
    });
    return sendJson(res, 200, { link_token: response.data.link_token });
  } catch (error) {
    console.error("create-link-token", error?.response?.data || error);
    return sendJson(res, error.status || 500, {
      error: error?.response?.data?.error_message || error.message || "Could not create link token",
    });
  }
}
