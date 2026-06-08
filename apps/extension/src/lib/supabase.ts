import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const TOKEN_KEY = "antarix:auth:token";
const REFRESH_KEY = "antarix:auth:refresh";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  }

  cachedClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cachedClient;
}

export async function setStoredTokens(accessToken: string, refreshToken: string): Promise<void> {
  await chrome.storage.local.set({
    [TOKEN_KEY]: accessToken,
    [REFRESH_KEY]: refreshToken,
  });
}

export async function clearStoredTokens(): Promise<void> {
  await chrome.storage.local.remove([TOKEN_KEY, REFRESH_KEY]);
}

export async function getAccessToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(TOKEN_KEY);
  return (result[TOKEN_KEY] as string | undefined) ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(REFRESH_KEY);
  return (result[REFRESH_KEY] as string | undefined) ?? null;
}

export async function authenticatedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
