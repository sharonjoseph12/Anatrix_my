import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { locales, localeLabels, type Locale } from "@/i18n/config";
import { LanguageSelector } from "./_language-selector";

export default async function LanguageSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings/language");

  const t = await getTranslations("settings.language");

  const { data: row } = await supabase
    .from("users")
    .select("locale")
    .eq("id", user.id)
    .single();
  const current: Locale =
    row && typeof (row as { locale?: string | null }).locale === "string"
      ? ((row as { locale: string }).locale as Locale)
      : "en";

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <LanguageSelector
        current={current}
        options={locales.map((code) => ({ code, label: localeLabels[code] }))}
      />
    </div>
  );
}
