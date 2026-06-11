"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PartialCaptureBanner({ enabled }: { enabled: boolean }) {
  const t = useTranslations("settings.signals");
  if (!enabled) return null;
  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5" />
          {t("partial_capture.title")}
        </CardTitle>
        <CardDescription className="text-amber-900/80 dark:text-amber-200/80">
          {t("partial_capture.body")}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0" />
    </Card>
  );
}

export default PartialCaptureBanner;
