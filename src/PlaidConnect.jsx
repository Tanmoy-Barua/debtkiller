import React, { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Landmark, RefreshCw, Link2 } from "lucide-react";
import { createLinkToken, exchangePublicToken, syncPlaidAccounts, mergePlaidAccountsIntoDebts } from "./plaidApi.js";

export default function PlaidConnect({ debts, setDebts, today, flash, styles }) {
  const { card, btnPrimary, btnGhost, FONT_MONO, FONT_DISP, C, SectionLabel } = styles;
  const [linkToken, setLinkToken] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [configured, setConfigured] = useState(true);

  const prepareLink = useCallback(async () => {
    setBusy(true);
    setStatus("");
    try {
      const data = await createLinkToken();
      setLinkToken(data.link_token);
      setConfigured(true);
    } catch (error) {
      setConfigured(false);
      setStatus(error.message || "Plaid is not configured yet");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    prepareLink();
  }, [prepareLink]);

  const onSuccess = useCallback(
    async (public_token, metadata) => {
      setBusy(true);
      setStatus("Importing accounts…");
      try {
        const result = await exchangePublicToken(public_token, metadata?.institution);
        const merged = mergePlaidAccountsIntoDebts(debts, result.accounts || [], today);
        setDebts(merged.debts);
        setStatus(
          `Linked ${result.institution_name || "bank"} · ${merged.added} added · ${merged.updated} updated` +
            (result.persisted ? " · refresh enabled" : "")
        );
        flash?.(`Imported ${result.accounts?.length || 0} account(s) from Plaid`);
        await prepareLink();
      } catch (error) {
        setStatus(error.message || "Link failed");
        flash?.(error.message || "Plaid link failed");
      } finally {
        setBusy(false);
      }
    },
    [debts, setDebts, today, flash, prepareLink]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => setBusy(false),
  });

  const refresh = async () => {
    setBusy(true);
    setStatus("Syncing balances…");
    try {
      const result = await syncPlaidAccounts();
      const merged = mergePlaidAccountsIntoDebts(debts, result.accounts || [], today);
      setDebts(merged.debts);
      setStatus(`Synced ${result.accounts?.length || 0} account(s)`);
      flash?.("Plaid balances refreshed");
    } catch (error) {
      setStatus(error.message || "Sync failed");
      flash?.(error.message || "Plaid sync failed");
    } finally {
      setBusy(false);
    }
  };

  const linkedCount = debts.filter((d) => d.plaidAccountId).length;

  return (
    <section style={card}>
      <SectionLabel icon={Landmark}>BANK & CARD LINK (PLAID)</SectionLabel>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, lineHeight: 1.5, marginTop: 8, marginBottom: 12 }}>
        Connect credit cards and loans securely via Plaid. Balances import into Debts. Personal IOUs stay manual.
      </div>
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={busy || !ready || !configured}
          onClick={() => open()}
          style={{ ...btnPrimary, opacity: busy || !ready || !configured ? 0.6 : 1, flex: 1, minWidth: 140 }}
        >
          <Link2 size={15} /> {busy ? "Working…" : "Connect with Plaid"}
        </button>
        <button
          type="button"
          disabled={busy || linkedCount === 0}
          onClick={refresh}
          style={{ ...btnGhost, opacity: busy ? 0.6 : 1, flex: 1, minWidth: 140 }}
        >
          <RefreshCw size={15} /> Refresh balances
        </button>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint, marginTop: 10 }}>
        {linkedCount} linked debt{linkedCount === 1 ? "" : "s"}
        {status ? ` · ${status}` : ""}
      </div>
      {!configured && (
        <div style={{ marginTop: 10, fontFamily: FONT_MONO, fontSize: 11, color: C.amber, lineHeight: 1.45 }}>
          Add PLAID_CLIENT_ID + PLAID_SECRET on Vercel (sandbox is fine to start). See SETUP.md.
        </div>
      )}
    </section>
  );
}
