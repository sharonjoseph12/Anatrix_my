"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar, Loader2, Video, Phone, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Format = "video" | "phone" | "in_person";

const FORMATS: Array<{ value: Format; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "video", label: "Video", icon: Video },
  { value: "phone", label: "Phone", icon: Phone },
  { value: "in_person", label: "In person", icon: MapPin },
];

export function ScheduleForm({
  candidateId,
  candidateName,
  companyId,
  recruiterId,
}: {
  candidateId: string;
  candidateName: string;
  companyId: string | null;
  recruiterId: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(tomorrowIso());
  const [time, setTime] = useState("14:00");
  const [format, setFormat] = useState<Format>("video");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!companyId) {
      toast.error("No company linked to your account");
      return;
    }
    setBusy(true);
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      const res = await fetch(`/api/recruiter/search/${candidateId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_at: scheduledAt, format, notes }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Failed to schedule");
        return;
      }
      toast.success(`Interview scheduled with ${candidateName}`);
      startTransition(() => router.push("/company/pipeline"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4" />
          Interview details
        </CardTitle>
        <CardDescription>Schedule and we&apos;ll update the candidate&apos;s pipeline state.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                disabled={busy || isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                disabled={busy || isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Format</Label>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((f) => {
                const Icon = f.icon;
                const active = format === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFormat(f.value)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm",
                      active ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/30",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes for the candidate</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional. Will be sent in the invite."
              disabled={busy || isPending}
            />
          </div>

          <Button type="submit" disabled={busy || isPending}>
            {busy || isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
            <span className="ml-1">Schedule</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
