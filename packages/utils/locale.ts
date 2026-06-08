import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  isSupportedLocale,
  type SupportedLocale,
} from "@antarix/types";

// Normalise an arbitrary locale string (from Accept-Language, user row, query
// param, etc.) into one of the 5 supported locales. Falls back to DEFAULT_LOCALE
// for null, empty, or unrecognised inputs.
export function normalizeLocale(
  input: string | null | undefined,
): SupportedLocale {
  if (!input) return DEFAULT_LOCALE;
  if (isSupportedLocale(input)) return input;
  const prefix = input.split("-")[0];
  if (!prefix) return DEFAULT_LOCALE;
  const lower = prefix.toLowerCase();
  return isSupportedLocale(lower) ? lower : DEFAULT_LOCALE;
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE, isSupportedLocale };
export type { SupportedLocale };
