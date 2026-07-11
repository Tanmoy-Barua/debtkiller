import { createClient } from "@supabase/supabase-js";

const STORE_KEY = "debt-destroyer:v2";
const LEGACY_KEY = "debt-destroyer:v1";
const SHARED_ID = import.meta.env.VITE_APP_STATE_ID || "shared";
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
        detectSessionInUrl: false,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    })
  : null;

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORE_KEY) || localStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Local backup could not be read", error);
    return null;
  }
}

function saveLocal(state) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn("Local backup could not be saved", error);
    return false;
  }
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
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPassword = String(password || "");
  if (!cleanEmail || !cleanPassword) throw new Error("Enter email and password");
  if (cleanPassword.length < 12) throw new Error("Password must be at least 12 characters");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: cleanPassword,
  });
  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
      throw new Error("Wrong email or password");
    }
    if (msg.includes("rate") || msg.includes("too many")) {
      throw new Error("Too many attempts. Wait a minute and try again.");
    }
    throw new Error(error.message || "Sign in failed");
  }
  return data.session;
}

export async function signOut() {
  if (!cloudEnabled || !supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

async function fetchCloudState() {
  const { data, error } = await supabase
    .from("app_state")
    .select("state, updated_at")
    .eq("id", SHARED_ID)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function saveCloud(state) {
  const { error } = await supabase.from("app_state").upsert(
    {
      id: SHARED_ID,
      state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw error;
}

export async function loadAppState() {
  const localState = loadLocal();
  if (!cloudEnabled) return { state: localState, source: localState ? "local" : "empty" };

  const session = await getSession();
  if (!session) return { state: null, source: "auth-required" };

  try {
    const data = await fetchCloudState();
    if (data?.state && typeof data.state === "object") {
      saveLocal(data.state);
      return { state: data.state, source: "cloud" };
    }

    if (localState) {
      await saveCloud(localState);
      return { state: localState, source: "local" };
    }

    return { state: null, source: "empty" };
  } catch (error) {
    console.warn("Cloud load failed; using local backup", error);
    return { state: localState, source: localState ? "local" : "empty", error };
  }
}

export async function saveAppState(state) {
  const local = saveLocal(state);
  if (!cloudEnabled) return { local, cloud: false };

  const session = await getSession();
  if (!session) return { local, cloud: false, error: new Error("Not signed in") };

  try {
    await saveCloud(state);
    return { local, cloud: true };
  } catch (error) {
    console.warn("Cloud save failed; local backup remains available", error);
    return { local, cloud: false, error };
  }
}

/** Subscribe to live updates from other devices/browsers. Returns an unsubscribe fn. */
export function subscribeAppState(onChange) {
  if (!cloudEnabled || !supabase) return () => {};

  const channel = supabase
    .channel(`app_state:${SHARED_ID}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "app_state",
        filter: `id=eq.${SHARED_ID}`,
      },
      (payload) => {
        const next = payload.new?.state;
        if (next && typeof next === "object") {
          saveLocal(next);
          onChange(next);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
