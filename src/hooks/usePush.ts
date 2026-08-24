import { useEffect, useState, useCallback } from "react";

import { getVapidPublicKey, subscribePush, unsubscribePush } from "@/lib/push.functions";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

export type PushState = "unsupported" | "loading" | "default" | "granted" | "denied";

export function usePush(userId: string | undefined) {
  const [state, setState] = useState<PushState>("loading");
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Check browser support
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }

    async function init() {
      try {
        // Register service worker
        await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        // Check permission
        if ("Notification" in window) {
          const perm = Notification.permission;
          if (perm === "granted") setState("granted");
          else if (perm === "denied") setState("denied");
          else setState("default");
        } else {
          setState("unsupported");
          return;
        }

        // Check existing subscription
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch {
        setState("default");
      }
    }

    init();
  }, [userId]);

  const enable = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;

      // Request permission
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("denied");
        setError("Notifications refusées. Autorisez-les dans les paramètres du navigateur.");
        return;
      }
      setState("granted");

      // Subscribe with VAPID key
      const { publicKey } = await getVapidPublicKey();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Store subscription server-side
      const keys = sub.toJSON().keys;
      await subscribePush({
        endpoint: sub.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: navigator.userAgent,
      });
      setSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'activation");
    }
  }, [userId]);

  const disable = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePush({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la désactivation");
    }
  }, [userId]);

  return { state, subscribed, error, enable, disable };
}
