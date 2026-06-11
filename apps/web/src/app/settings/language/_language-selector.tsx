"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Locale } from "@/i18n/config";

interface Props {
  current: Locale;
  options: Array<{ code: Locale; label: string }>;
}

export function LanguageSelector({ current, options }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<Locale>(current);
  const [pending, startTransition] = useTransition();
  const t = useTranslations("settings.language");

  function onChange(next: string) {
    const nextLocale = next as Locale;
    setValue(nextLocale);
    startTransition(async () => {
      const res = await fetch("/api/settings/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      if (!res.ok) {
        setValue(current);
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Failed to update language");
        return;
      }
      toast.success(t("saved"));
      // Force a re-render so the new locale flows through next-intl.
      router.refresh();
    });
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="w-full sm:w-72">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.code} value={o.code}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
