// apps/web/src/i18n/request.ts
//
// next-intl request config. Locale resolution priority:
//   1. URL request locale (next-intl fills this from the [locale] segment
//      or the middleware's locale detection)
//   2. Supabase users.locale column for the authenticated user
//   3. defaultLocale (en)
//
// On a missing key in step 2 (DB read failure), we fall through silently
// to the default locale. Logging to i18n_missing_keys is performed in the
// renderer path; the request config simply chooses a locale.

import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, locales, type Locale } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  let locale: Locale = isLocale(requested ?? undefined) ? (requested as Locale) : defaultLocale;

  // Only attempt the DB lookup when the URL did NOT already supply a locale.
  // The URL is treated as authoritative for the current request so that
  // the locale-switcher can force a locale without waiting for the DB.
  if (!isLocale(requested ?? undefined)) {
    try {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: row } = await supabase
          .from("users")
          .select("locale")
          .eq("id", user.id)
          .single();
        const dbLocale = (row as { locale?: string | null } | null)?.locale;
        if (dbLocale && isLocale(dbLocale)) {
          locale = dbLocale as Locale;
        }
      }
    } catch {
      // Swallow — fall back to the locale already resolved from the URL /
      // default. The renderer will still upsert into i18n_missing_keys
      // whenever a key is missing, so translator telemetry is preserved.
    }
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "UTC",
  };
});

export { locales, defaultLocale };
export type { Locale };
