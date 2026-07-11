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
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
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
