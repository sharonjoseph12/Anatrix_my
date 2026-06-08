import type { SignalSource } from "@antarix/types/signals";

const IDE_LEARNED: Record<string, string> = {
  en: "We saw that you coded for {total_active_seconds} across {session_count} sessions, with {language} being the most frequent language. We do NOT see your source code, file paths, or anything you typed — only timing and aggregate activity counts.",
  hi: "हमने देखा कि आपने {session_count} सत्रों में कुल {total_active_seconds} समय तक कोड लिखा, जिसमें {language} सबसे अधिक इस्तेमाल की गई भाषा थी। हम आपका सोर्स कोड, फ़ाइल पाथ, या आपने क्या टाइप किया — कुछ भी नहीं देखते, केवल समय और कुल गतिविधि गिनते हैं।",
};

const BIOMETRIC_LEARNED: Record<string, string> = {
  en: "We saw your {provider} summary for {day}: sleep {sleep}, HRV {hrv}, resting heart rate {rhr}. We use these to corroborate the peak window detector — never to share, never to rank you, never to display without your toggle being on.",
  hi: "हमने {day} के लिए आपका {provider} सारांश देखा: नींद {sleep}, HRV {hrv}, विश्राम हृदय गति {rhr}। हम इन्हें पीक विंडो डिटेक्टर की पुष्टि के लिए उपयोग करते हैं — कभी साझा नहीं करते, कभी आपकी रैंकिंग के लिए नहीं।",
};

function pick(template: Record<string, string>, locale: string): string {
  return template[locale] ?? template.en ?? "";
}

export interface SignalAggregate {
  period_start: string;
  score_contribution?: number;
  summary?: Record<string, string | number | null>;
}

export function renderWhatWeLearned(
  source: SignalSource,
  aggregates: SignalAggregate[],
  locale: string = "en",
): string {
  const summary = aggregates[0]?.summary ?? {};
  if (source.kind === "ide") {
    const total = Number(summary.total_active_seconds ?? 0);
    const count = Number(summary.session_count ?? 0);
    const lang = String(summary.language ?? "mixed");
    return pick(IDE_LEARNED, locale)
      .replace("{total_active_seconds}", String(total))
      .replace("{session_count}", String(count))
      .replace("{language}", lang);
  }
  if (source.kind === "biometric") {
    const provider: string = source.biometric_provider ?? "biometric";
    const day: string = aggregates[0]?.period_start ?? "recent days";
    return pick(BIOMETRIC_LEARNED, locale)
      .replace("{provider}", provider)
      .replace("{day}", day)
      .replace("{sleep}", String(summary.sleep_duration_minutes ?? "—"))
      .replace("{hrv}", String(summary.hrv_ms ?? "—"))
      .replace("{rhr}", String(summary.resting_hr_bpm ?? "—"));
  }
  return "Active";
}
