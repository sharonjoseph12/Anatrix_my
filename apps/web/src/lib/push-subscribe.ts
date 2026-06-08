"use client";

// Register the web-push service worker and the user's VAPID subscription
// whenever they toggle the push_channel on. Called from settings/notifications.

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function usePushSubscription() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (!("PushManager" in window)) return;
    if (Notification.permission === "denied") return;

    (async () => {
      const reg = await navigator.serviceWorker.register("/sw-push.js");
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        if (Notification.permission === "default") {
          const perm = await Notification.requestPermission();
          if (perm !== "granted") return;
        }
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
      }
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("push_subscriptions").upsert({
        user_id: user.id,
        endpoint: sub.endpoint,
        keys_p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")!))),
        keys_auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth")!))),
      }, { onConflict: "user_id,endpoint" });
    })();
  }, []);
}
