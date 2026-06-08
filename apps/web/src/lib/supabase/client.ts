import { createClient as createBrowserClient } from "@supabase/supabase-js";

// Browser-safe Supabase client. No server-only imports here.
// This file can be imported by both Server and Client Components.

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  );
}

export type SupabaseBrowser = ReturnType<typeof createSupabaseBrowserClient>;
