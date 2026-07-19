/** LocalStorage backup keys + helpers (no cloud deps — easy to unit test). */

export const STORE_KEY = "debt-destroyer:v2";
export const LEGACY_KEY = "debt-destroyer:v1";

export function localKey(userId) {
  return userId ? `${STORE_KEY}:${userId}` : STORE_KEY;
}

/**
 * Read the local backup for a user.
 * When userId is null/undefined (local-only mode), reads the unscoped key
 * and falls back to the legacy v1 key.
 */
export function loadLocalBackup(userId, storage = globalThis.localStorage) {
  if (!storage) return null;
  try {
    const keyed = storage.getItem(localKey(userId));
    if (keyed) return JSON.parse(keyed);
    if (!userId) {
      const legacy = storage.getItem(LEGACY_KEY);
      return legacy ? JSON.parse(legacy) : null;
    }
    return null;
  } catch (error) {
    console.warn("Local backup could not be read", error);
    return null;
  }
}

export function saveLocalBackup(state, userId, storage = globalThis.localStorage) {
  if (!storage) return false;
  try {
    storage.setItem(localKey(userId), JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn("Local backup could not be saved", error);
    return false;
  }
}

export function clearUnscopedLocalBackups(storage = globalThis.localStorage) {
  if (!storage) return;
  try {
    storage.removeItem(STORE_KEY);
    storage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}
