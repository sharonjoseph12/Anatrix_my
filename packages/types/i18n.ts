// i18n locale types — kept independent from apps/web/src/i18n/config.ts
// because packages cannot import from apps. The five-locale set matches
// the CHECK constraint on `users.locale` and `i18n_missing_keys.locale`
// in migration 034.

export const SUPPORTED_LOCALES = ["en", "hi", "ta", "te", "mr"] as const;

export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}
