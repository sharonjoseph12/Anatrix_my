// apps/web/src/app/(student)/settings/notifications/page.tsx
// Server entry — delegates the prefs editor to a client component and the
// channel picker to its own server component.

import { NudgePreferencesEditor } from "./nudge-preferences-editor";
import { ChannelsSection } from "./channels-section";

export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-sm text-muted-foreground">Tune what your AI Coach sends, when, and where.</p>
      </div>
      <NudgePreferencesEditor />
      <ChannelsSection />
    </div>
  );
}
