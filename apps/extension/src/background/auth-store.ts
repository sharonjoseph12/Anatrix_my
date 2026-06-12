// apps/extension/src/background/auth-store.ts
// Tiny wrapper over chrome.storage.local that returns the bits the background
// service worker actually needs to authenticate outbound calls: the access
// token, the API base URL (from the cached supabase URL or build-time env),
// and the refresh token. Kept separate from `lib/supabase.ts` because that
// module is bundled into the popup and uses the in-memory client; the
// service worker needs a lower-level accessor that doesn't construct a
// supabase-js client on every call.

const TOKEN_KEY = "antarix:auth:token";
const REFRESH_KEY = "antarix:auth:refresh";
const API_BASE_KEY = "antarix:auth:apiBase";

export interface StoredAuth {
  accessToken: string;
  refreshToken: string | null;
  apiBase: string;
}

function inferApiBase(): string {
  // Prefer build-time env, fall back to the manifest host_permissions default.
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const fromEnv = env?.VITE_SUPABASE_URL;
  if (fromEnv) return fromEnv;
  return "http://127.0.0.1:54321";
}

export async function getStoredAuth(): Promise<StoredAuth | null> {
  const result = await chrome.storage.local.get([TOKEN_KEY, REFRESH_KEY, API_BASE_KEY]);
  const accessToken = (result[TOKEN_KEY] as string | undefined) ?? null;
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken: (result[REFRESH_KEY] as string | undefined) ?? null,
    apiBase: (result[API_BASE_KEY] as string | undefined) ?? inferApiBase(),
  };
}

export async function setStoredAuth(input: {
  accessToken: string;
  refreshToken: string | null;
  apiBase?: string;
}): Promise<void> {
  const next: Record<string, string> = {
    [TOKEN_KEY]: input.accessToken,
  };
  if (input.refreshToken) next[REFRESH_KEY] = input.refreshToken;
  if (input.apiBase) next[API_BASE_KEY] = input.apiBase;
  await chrome.storage.local.set(next);
}

export async function clearStoredAuth(): Promise<void> {
  await chrome.storage.local.remove([TOKEN_KEY, REFRESH_KEY, API_BASE_KEY]);
}
