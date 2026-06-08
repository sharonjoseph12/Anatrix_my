import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { SourceCard } from "./source-card";
import { PartialCaptureBanner } from "./partial-capture-banner";
import { DeleteAllButton } from "./delete-all-button";
import { DPDPErasureSection } from "./dpdp-erasure-section";
import { renderWhatWeLearned } from "@/lib/signals/plain-language";
import { COMBINED_SCORE_CAP } from "@antarix/utils/score-cap";
import type { SignalSource, SignalCenterSnapshot, SignalProvider } from "@antarix/types/signals";
import type { BiometricProvider } from "@antarix/types/biometrics";
import type { IDEEditor } from "@antarix/types/ide-telemetry";
import type { DPDPErasureRequest } from "@/lib/audit/dpdp-erasure";

type BiometricConnectionRow = {
  id: string;
  provider: BiometricProvider;
  status: "connected" | "expired" | "disconnected";
  connected_at: string;
  last_sync_at: string | null;
  scopes_json: string[] | null;
};

type BiometricAggregateRow = {
  id: string;
  connection_id: string;
  provider: BiometricProvider;
  period_type: "daily" | "monthly";
  period_start: string;
  sleep_duration_minutes: number | null;
  sleep_quality_score: number | null;
  hrv_ms: number | null;
  resting_hr_bpm: number | null;
  daily_readiness_score: number | null;
  source_hash: string;
};

type IDEAggregateRow = {
  id: string;
  device_id: string;
  student_id: string;
  day: string;
  session_count: number;
  total_active_seconds: number;
  language_breakdown_json: Record<string, number> | null;
  productivity_score_raw: number;
  score_contribution: number;
  period_type: "daily" | "monthly";
  period_start: string;
  computed_at: string;
};

type IDESessionRow = {
  id: string;
  device_id: string;
  student_id: string;
  started_at: string;
  ended_at: string;
  editor: IDEEditor;
  language: string;
  raw_partial_capture: boolean;
};

const ALL_PROVIDERS: { provider: SignalProvider; kind: "ide" | "biometric"; editor?: IDEEditor; biometric_provider?: BiometricProvider; cap: 3 | 2 }[] = [
  { provider: "ide_vscode", kind: "ide", editor: "vscode", cap: 3 },
  { provider: "ide_cursor", kind: "ide", editor: "cursor", cap: 3 },
  { provider: "biometric_healthkit", kind: "biometric", biometric_provider: "healthkit", cap: 2 },
  { provider: "biometric_google_fit", kind: "biometric", biometric_provider: "google_fit", cap: 2 },
  { provider: "biometric_oura", kind: "biometric", biometric_provider: "oura", cap: 2 },
  { provider: "biometric_whoop", kind: "biometric", biometric_provider: "whoop", cap: 2 },
];

async function loadSnapshot(studentId: string, locale: string): Promise<{ snapshot: SignalCenterSnapshot; dpdpRequests: DPDPErasureRequest[] }> {
  const supabase = await createSupabaseServerClient();

  const [bioConnRes, bioAggRes, ideAggRes, ideSessRes, dpdpRes] = await Promise.all([
    supabase
      .from("biometric_connections")
      .select("id,provider,status,connected_at,last_sync_at,scopes_json")
      .eq("student_id", studentId)
      .returns<BiometricConnectionRow[]>(),
    supabase
      .from("biometric_aggregates")
      .select("id,connection_id,provider,period_type,period_start,sleep_duration_minutes,sleep_quality_score,hrv_ms,resting_hr_bpm,daily_readiness_score,source_hash")
      .eq("student_id", studentId)
      .eq("period_type", "daily")
      .order("period_start", { ascending: false })
      .limit(120)
      .returns<BiometricAggregateRow[]>(),
    supabase
      .from("ide_aggregates")
      .select("id,device_id,student_id,day,session_count,total_active_seconds,language_breakdown_json,productivity_score_raw,score_contribution,period_type,period_start,computed_at")
      .eq("student_id", studentId)
      .eq("period_type", "daily")
      .order("period_start", { ascending: false })
      .limit(120)
      .returns<IDEAggregateRow[]>(),
    supabase
      .from("ide_sessions")
      .select("id,device_id,student_id,started_at,ended_at,editor,language,raw_partial_capture")
      .eq("student_id", studentId)
      .eq("raw_partial_capture", true)
      .order("started_at", { ascending: false })
      .limit(1)
      .returns<IDESessionRow[]>(),
    supabase
      .from("dpdp_erasure_requests")
      .select("id,student_id,status,requested_at,due_by,completed_at")
      .eq("student_id", studentId)
      .order("requested_at", { ascending: false })
      .returns<DPDPErasureRequest[]>(),
  ]);

  const bioConns = bioConnRes.data ?? [];
  const bioAggs = bioAggRes.data ?? [];
  const ideAggs = ideAggRes.data ?? [];
  const ideSess = ideSessRes.data ?? [];
  const dpdpRequests = (dpdpRes.data ?? []) as DPDPErasureRequest[];

  const partial_capture = ideSess.length > 0;

  const sources: SignalSource[] = ALL_PROVIDERS.map((meta) => {
    if (meta.kind === "biometric" && meta.biometric_provider) {
      const conn = bioConns.find((c) => c.provider === meta.biometric_provider) ?? null;
      const connAggs = conn ? bioAggs.filter((a) => a.connection_id === conn.id) : [];
      const last5 = connAggs.slice(0, 5);
      const status: SignalSource["status"] = conn
        ? (conn.status as SignalSource["status"])
        : "disconnected";
      const base: SignalSource = {
        provider: meta.provider,
        kind: "biometric",
        status,
        biometric_provider: meta.biometric_provider,
        connected_at: conn?.connected_at ?? null,
        last_sync_at: conn?.last_sync_at ?? null,
        last_5_aggregates: last5.map((a) => ({
          period_start: a.period_start,
          score_contribution: a.daily_readiness_score !== null
            ? Math.min(2, Number((Number(a.daily_readiness_score) / 100 * 2).toFixed(2)))
            : undefined,
          summary: {
            sleep_duration_minutes: a.sleep_duration_minutes,
            sleep_quality_score: a.sleep_quality_score,
            hrv_ms: a.hrv_ms,
            resting_hr_bpm: a.resting_hr_bpm,
            daily_readiness_score: a.daily_readiness_score,
          },
        })),
        what_we_learned: "",
        total_score_cap_pct: 2,
      };
      base.what_we_learned = renderWhatWeLearned(base, base.last_5_aggregates, locale);
      if (!base.what_we_learned) base.what_we_learned = status === "connected" ? "Active" : "Disconnected";
      return base;
    }

    if (meta.kind === "ide" && meta.editor) {
      const matched = ideAggs;
      const firstAgg = matched[0];
      const last5 = matched.slice(0, 5);
      const hasAny = matched.length > 0;
      const lastSync = firstAgg?.computed_at ?? null;
      const status: SignalSource["status"] = hasAny ? "connected" : "disconnected";
      const langBreakdown = matched.reduce<Record<string, number>>((acc, a) => {
        const lb = (a.language_breakdown_json ?? {}) as Record<string, number>;
        for (const [k, v] of Object.entries(lb)) {
          acc[k] = (acc[k] ?? 0) + Number(v);
        }
        return acc;
      }, {});
      const topLanguage = Object.entries(langBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "mixed";
      const base: SignalSource = {
        provider: meta.provider,
        kind: "ide",
        status,
        editor: meta.editor,
        connected_at: hasAny ? last5[last5.length - 1]?.period_start ?? null : null,
        last_sync_at: lastSync,
        last_5_aggregates: last5.map((a) => ({
          period_start: a.period_start,
          score_contribution: Number(a.score_contribution ?? 0),
          summary: {
            total_active_seconds: a.total_active_seconds,
            session_count: a.session_count,
            language: topLanguage,
          },
        })),
        what_we_learned: "",
        total_score_cap_pct: 3,
      };
      base.what_we_learned = renderWhatWeLearned(base, base.last_5_aggregates, locale);
      if (!base.what_we_learned) base.what_we_learned = status === "connected" ? "Active" : "Disconnected";
      return base;
    }

    return {
      provider: meta.provider,
      kind: meta.kind,
      status: "disconnected" as const,
      last_5_aggregates: [],
      what_we_learned: "Disconnected",
      total_score_cap_pct: meta.cap,
    };
  });

  const snapshot: SignalCenterSnapshot = {
    sources,
    total_active_score_cap_pct: COMBINED_SCORE_CAP,
    partial_capture,
  };

  return { snapshot, dpdpRequests };
}

export default async function PrivacyCenterPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings/signals");

  const t = await getTranslations("settings.signals");
  const locale = await getLocale();
  const { snapshot, dpdpRequests } = await loadSnapshot(user.id, locale);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("page_title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("page_description")}</p>
      </div>

      <PartialCaptureBanner enabled={snapshot.partial_capture} />

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>
            {t("combined_cap_notice", { cap: snapshot.total_active_score_cap_pct })}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0" />
      </Card>

      <div className="space-y-3">
        {snapshot.sources.map((source) => (
          <SourceCard key={source.provider} source={source} />
        ))}
      </div>

      <DPDPErasureSection requests={dpdpRequests} />

      <DeleteAllButton />
    </div>
  );
}
