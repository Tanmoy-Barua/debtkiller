import { createClient } from "@supabase/supabase-js";

const STORE_KEY = "debt-destroyer:v2";
const LEGACY_KEY = "debt-destroyer:v1";
/** Owner allowlist — set via VITE_OWNER_EMAIL (never hardcode a real address in git). */
const OWNER_EMAIL = String(import.meta.env.VITE_OWNER_EMAIL || "")
  .trim()
  .toLowerCase();
export const ownerEmailConfigured = Boolean(OWNER_EMAIL);
/** Detect old shared/seed dashboards wrongly copied onto other accounts. */
const LEAKED_SEED_MARKERS = [
  "Credit Card 01",
  "Credit Card 02",
  "Lender Loan 01",
  "Friend IOU 01",
  "Family Loan 01",
  "Family Loan 02",
  "Family Loan 03",
];
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const cloudEnabled = Boolean(url && anonKey && !url.includes("YOUR_PROJECT"));
const supabase = cloudEnabled
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    })
  : null;

export function emptyAppState() {
  return {
    debts: [],
    earnings: [],
    expenses: [],
    recurring: [],
    settings: {
      monthlyBaseline: 3800,
      activePlan: "A",
      taxRate: 0.15,
      bufferGoal: 500,
      payoffMethod: "avalanche",
      dailyGasBudget: 40,
      softReminders: true,
      customDailyTarget: null,
      theme: "dark",
    },
    buffer: 0,
    taxWallet: 0,
    milestonesSeen: [],
  };
}

function localKey(userId) {
  return userId ? `${STORE_KEY}:${userId}` : STORE_KEY;
}

function stateLooksPopulated(state) {
  if (!state || typeof state !== "object") return false;
  const debts = Array.isArray(state.debts) ? state.debts.length : 0;
  const earnings = Array.isArray(state.earnings) ? state.earnings.length : 0;
  const expenses = Array.isArray(state.expenses) ? state.expenses.length : 0;
  return debts + earnings + expenses > 0 || Number(state.buffer) > 0;
}

function isOwnerAccount(email) {
  // No allowlist configured → any signed-in user owns their own row.
  if (!OWNER_EMAIL) return Boolean(String(email || "").trim());
  return String(email || "").trim().toLowerCase() === OWNER_EMAIL;
}

/** Detect the old shared/seed dashboard that was wrongly copied onto other accounts. */
function looksLikeLeakedOwnerSeed(state) {
  if (!state || !Array.isArray(state.debts) || state.debts.length < 5) return false;
  const names = new Set(state.debts.map((d) => String(d?.name || "")));
  const hits = LEAKED_SEED_MARKERS.filter((n) => names.has(n)).length;
  return hits >= 4;
}

function sanitizeStateForUser(state, email) {
  if (!state || typeof state !== "object") return emptyAppState();
  if (isOwnerAccount(email)) return state;
  if (looksLikeLeakedOwnerSeed(state)) return emptyAppState();
  return state;
}

function loadLocal(userId) {
  try {
    const keyed = localStorage.getItem(localKey(userId));
    if (keyed) return JSON.parse(keyed);
    // Local-only / legacy fallbacks when reading the unscoped key
    if (!userId) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      return legacy ? JSON.parse(legacy) : null;
    }
    return null;
  } catch (error) {
    console.warn("Local backup could not be read", error);
    return null;
  }
}

function clearLegacyLocalBackups() {
  try {
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

function saveLocal(state, userId) {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn("Local backup could not be saved", error);
    return false;
  }
}

function cleanAuthInput(email, password, { minPassword = 8 } = {}) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPassword = String(password || "");
  if (!cleanEmail || !cleanPassword) throw new Error("Enter email and password");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("Enter a valid email");
  if (cleanPassword.length < minPassword) {
    throw new Error(`Password must be at least ${minPassword} characters`);
  }
  return { cleanEmail, cleanPassword };
}

export async function getSession() {
  if (!cloudEnabled || !supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session ?? null;
}

export function onAuthChange(callback) {
  if (!cloudEnabled || !supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}

export async function signIn(email, password) {
  if (!cloudEnabled || !supabase) throw new Error("Cloud auth is not configured");
  const { cleanEmail, cleanPassword } = cleanAuthInput(email, password);

  // Optional allowlist: only enforced when VITE_OWNER_EMAIL is set.
  if (OWNER_EMAIL && cleanEmail !== OWNER_EMAIL) {
    throw new Error("Access restricted to the owner account only.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: cleanPassword,
  });
  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
      throw new Error("Wrong email or password");
    }
    if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
      throw new Error("Confirm your email first — check your inbox for the link.");
    }
    if (msg.includes("banned") || msg.includes("disabled")) {
      throw new Error("This account is disabled.");
    }
    if (msg.includes("rate") || msg.includes("too many")) {
      throw new Error("Too many attempts. Wait a minute and try again.");
    }
    throw new Error(error.message || "Sign in failed");
  }

  const session = data.session;
  if (OWNER_EMAIL && !isOwnerAccount(session?.user?.email)) {
    await supabase.auth.signOut();
    throw new Error("Access restricted to the owner account only.");
  }
  return session;
}

export async function signOut() {
  if (!cloudEnabled || !supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  clearLegacyLocalBackups();
}

async function fetchCloudState(userId) {
  const { data, error } = await supabase
    .from("app_state")
    .select("state, updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Never read shared row from the browser — only SQL restore in Supabase. */

async function saveCloud(state, userId) {
  const { error } = await supabase.from("app_state").upsert(
    {
      id: userId,
      state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw error;
}

export async function loadAppState() {
  if (!cloudEnabled) {
    const localState = loadLocal(null);
    return { state: localState, source: localState ? "local" : "empty" };
  }

  const session = await getSession();
  if (!session?.user?.id) return { state: null, source: "auth-required" };
  const userId = session.user.id;
  const email = session.user.email;

  try {
    const data = await fetchCloudState(userId);
    if (data?.state && typeof data.state === "object" && stateLooksPopulated(data.state)) {
      const cleaned = sanitizeStateForUser(data.state, email);
      if (cleaned !== data.state && !stateLooksPopulated(cleaned)) {
        // Wipe leaked owner copy from this non-owner account
        await saveCloud(cleaned, userId);
        saveLocal(cleaned, userId);
        return { state: cleaned, source: "cloud-purged" };
      }
      saveLocal(cleaned, userId);
      return { state: cleaned, source: "cloud" };
    }

    const localState = loadLocal(userId);
    if (localState && stateLooksPopulated(localState)) {
      const cleaned = sanitizeStateForUser(localState, email);
      if (!stateLooksPopulated(cleaned) && !isOwnerAccount(email)) {
        await saveCloud(cleaned, userId);
        saveLocal(cleaned, userId);
        return { state: cleaned, source: "local-purged" };
      }
      await saveCloud(cleaned, userId);
      saveLocal(cleaned, userId);
      return { state: cleaned, source: "local" };
    }

    if (data?.state && typeof data.state === "object") {
      const cleaned = sanitizeStateForUser(data.state, email);
      saveLocal(cleaned, userId);
      return { state: cleaned, source: "cloud" };
    }

    const starter = emptyAppState();
    await saveCloud(starter, userId);
    saveLocal(starter, userId);
    return { state: starter, source: "cloud" };
  } catch (error) {
    console.warn("Cloud load failed; using local backup", error);
    const localState = sanitizeStateForUser(loadLocal(userId), email);
    return { state: localState || emptyAppState(), source: localState ? "local" : "empty", error };
  }
}

export async function saveAppState(state) {
  const session = cloudEnabled ? await getSession() : null;
  const userId = session?.user?.id || null;
  const local = saveLocal(state, userId);
  if (!cloudEnabled) return { local, cloud: false };
  if (!userId) return { local, cloud: false, error: new Error("Not signed in") };

  try {
    await saveCloud(state, userId);
    return { local, cloud: true };
  } catch (error) {
    console.warn("Cloud save failed; local backup remains available", error);
    return { local, cloud: false, error };
  }
}

/** Subscribe to live updates for the signed-in user's row. */
export function subscribeAppState(onChange) {
  if (!cloudEnabled || !supabase) return () => {};

  let channel = null;
  let cancelled = false;

  (async () => {
    const session = await getSession();
    const userId = session?.user?.id;
    if (!userId || cancelled) return;

    channel = supabase
      .channel(`app_state:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_state",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const rowId = payload.new?.id;
          if (rowId && rowId !== userId) return;
          const next = payload.new?.state;
          if (next && typeof next === "object") {
            saveLocal(next, userId);
            onChange(next);
          }
        }
      )
      .subscribe();
  })();

  return () => {
    cancelled = true;
    if (channel) supabase.removeChannel(channel);
  };
}
