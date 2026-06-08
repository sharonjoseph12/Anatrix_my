// apps/web/src/app/(student)/settings/notifications/channels-section.tsx
// T045 — Server component that loads the user's external_channel_handles and
// institution_nudge_settings, then renders the Discord + Telegram cards.

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DiscordCard, type DiscordStatus } from "@/components/channels/discord-card";
import { TelegramCard, type TelegramStatus } from "@/components/channels/telegram-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

export async function ChannelsSection() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings/notifications");

  const { data: handles } = await supabase
    .from("external_channel_handles")
    .select("channel,platform_handle,verified,disconnected_reason,last_verified_at")
    .eq("user_id", user.id)
    .returns<Array<{
      channel: "discord" | "telegram" | "whatsapp";
      platform_handle: string | null;
      verified: boolean;
      disconnected_reason: string | null;
      last_verified_at: string | null;
    }>>();

  const { data: institutionRows } = await supabase
    .from("institution_nudge_settings")
    .select("institution_id, channel, institutions(name)")
    .eq("enabled", true)
    .gt("expires_at", new Date().toISOString())
    .returns<Array<{
      institution_id: string;
      channel: "discord" | "telegram" | "whatsapp";
      institutions: { name: string } | { name: string }[] | null;
    }>>();

  const get = (ch: "discord" | "telegram") => {
    const h = (handles ?? []).find((r) => r.channel === ch);
    if (!h) {
      return {
        connected: false,
        verified: false,
        handle: null,
        disconnectedReason: null,
        lastVerifiedAt: null,
        connectedByInstitution: null,
      };
    }
    return {
      connected: true,
      verified: h.verified,
      handle: h.platform_handle,
      disconnectedReason: h.disconnected_reason,
      lastVerifiedAt: h.last_verified_at,
      connectedByInstitution: null,
    };
  };

  const discordStatus: DiscordStatus = get("discord");
  const telegramStatus: TelegramStatus = get("telegram");

  const institutionBadge = (institutionRows ?? [])
    .map((r) => {
      const inst = Array.isArray(r.institutions) ? r.institutions[0] : r.institutions;
      return inst?.name ?? null;
    })
    .filter((s): s is string => !!s);
  const hasInstitution = institutionBadge.length > 0;
  if (hasInstitution) {
    if (discordStatus.connected) discordStatus.connectedByInstitution = institutionBadge[0]!;
    if (telegramStatus.connected) telegramStatus.connectedByInstitution = institutionBadge[0]!;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Free channels</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <DiscordCard initial={discordStatus} />
          <TelegramCard initial={telegramStatus} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Premium: WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            WhatsApp is reserved for premium plans and institution-wide rollouts.
            Enable WhatsApp Premium in billing to opt in.
          </p>
          <Badge variant="outline" className="mt-2 text-[10px]">
            Coming soon
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
