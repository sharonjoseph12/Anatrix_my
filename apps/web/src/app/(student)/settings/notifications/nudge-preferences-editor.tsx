"use client";

// T049 — Nudge preferences editor. Timezone, daily/weekly times, quiet hours,
// master pause, per-type and per-channel toggles.

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, CheckCircle2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const TYPES = [
  { id: "daily_morning", label: "Daily morning check-in" },
  { id: "real_time_peak", label: "Real-time peak window" },
  { id: "streak_risk", label: "Streak risk" },
  { id: "weekly_summary", label: "Weekly summary" },
] as const;

export function NudgePreferencesEditor() {
  const [prefs, setPrefs] = useState<Record<string, unknown> | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tzOptions, setTzOptions] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("nudge_preferences").select("*").eq("user_id", user.id).maybeSingle();
      if (data) setPrefs(data as Record<string, unknown>);
      try { setTzOptions((Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? []); } catch { /* not available in all envs */ }
    })();
  }, []);

  async function save() {
    if (!prefs) return;
    setBusy(true);
    setSaved(false);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("nudge_preferences").update(prefs).eq("user_id", user.id);
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (!prefs) return <div className="h-32 animate-pulse rounded-md bg-muted" />;

  const toggle = (key: string) => setPrefs((p) => ({ ...(p ?? {}), [key]: !(p?.[key] as boolean) }));
  const setField = (key: string, value: unknown) => setPrefs((p) => ({ ...(p ?? {}), [key]: value }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Timezone</Label>
              <Input
                list="tz-list"
                value={(prefs.timezone as string) ?? ""}
                onChange={(e) => setField("timezone", e.target.value)}
                placeholder="Asia/Kolkata"
              />
              <datalist id="tz-list">{tzOptions.map((tz) => <option key={tz} value={tz} />)}</datalist>
            </div>
            <div>
              <Label>Daily send time</Label>
              <Input type="time" value={(prefs.daily_send_local_time as string) ?? "08:00"}
                onChange={(e) => setField("daily_send_local_time", e.target.value)} />
            </div>
            <div>
              <Label>Weekly send time (Sun)</Label>
              <Input type="time" value={(prefs.weekly_send_local_time as string) ?? "10:00"}
                onChange={(e) => setField("weekly_send_local_time", e.target.value)} />
            </div>
            <div>
              <Label>Quiet hours start</Label>
              <Input type="time" value={(prefs.quiet_start_local as string) ?? "22:00"}
                onChange={(e) => setField("quiet_start_local", e.target.value)} />
            </div>
            <div>
              <Label>Quiet hours end</Label>
              <Input type="time" value={(prefs.quiet_end_local as string) ?? "07:00"}
                onChange={(e) => setField("quiet_end_local", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Channels</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { k: "whatsapp_channel", label: "WhatsApp (off by default until you opt in)" },
            { k: "push_channel", label: "Web push" },
            { k: "email_channel", label: "Email (weekly summary only)" },
          ].map((c) => (
            <div key={c.k} className="flex items-center justify-between">
              <Label>{c.label}</Label>
              <Switch checked={!!prefs[c.k]} onCheckedChange={() => toggle(c.k)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Types</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {TYPES.map((t) => (
            <div key={t.id} className="flex items-center justify-between">
              <Label>{t.label}</Label>
              <Switch checked={!!prefs[t.id]} onCheckedChange={() => toggle(t.id)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <div>
            <Label>Pause all nudges</Label>
            <p className="text-xs text-muted-foreground">Tells the AI Coach to stay quiet across every channel and type.</p>
          </div>
          <Switch checked={!!prefs.pause_all} onCheckedChange={() => toggle("pause_all")} />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        {saved && <span className="flex items-center gap-1 self-center text-xs text-emerald-500"><CheckCircle2 className="h-3 w-3" />Saved</span>}
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}
