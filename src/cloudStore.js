import { createClient } from "@supabase/supabase-js";

const STORE_KEY = "debt-destroyer:v2";
const LEGACY_KEY = "debt-destroyer:v1";
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const cloudEnabled = Boolean(url && anonKey);
const supabase = cloudEnabled
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
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

async function getAnonymousUser() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session?.user) return sessionData.session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}

export async function loadAppState() {
  const localState = loadLocal();
  if (!cloudEnabled) return { state: localState, source: localState ? "local" : "empty" };

  try {
    const user = await getAnonymousUser();
    const { data, error } = await supabase
      .from("app_state")
      .select("state, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (data?.state) {
      saveLocal(data.state);
      return { state: data.state, source: "cloud" };
    }

    if (localState) {
      await saveCloud(user.id, localState);
      return { state: localState, source: "local" };
    }

    return { state: null, source: "empty" };
  } catch (error) {
    console.warn("Cloud load failed; using local backup", error);
    return { state: localState, source: localState ? "local" : "empty", error };
  }
}

async function saveCloud(userId, state) {
  const { error } = await supabase.from("app_state").upsert(
    {
      user_id: userId,
      state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

export async function saveAppState(state) {
  const local = saveLocal(state);
  if (!cloudEnabled) return { local, cloud: false };

  try {
    const user = await getAnonymousUser();
    await saveCloud(user.id, state);
    return { local, cloud: true };
  } catch (error) {
    console.warn("Cloud save failed; local backup remains available", error);
    return { local, cloud: false, error };
  }
}
