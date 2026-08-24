import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  sendPushToSubscriptions,
  shouldDeactivate,
  type PushSubscriptionRow,
} from "./push.server";

/** Public: returns the VAPID public key so the browser can subscribe to push. */
export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env["VAPID_PUBLIC_KEY"]! };
});

/** Authenticated: store the caller's own push subscription. */
export const subscribePush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: unknown) =>
      z
        .object({
          endpoint: z.string().url(),
          p256dh: z.string(),
          auth: z.string(),
          userAgent: z.string().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Look up linked member
    const { data: member } = await supabase
      .from("members")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        member_id: member?.id ?? null,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth_key: data.auth,
        user_agent: data.userAgent ?? null,
        active: true,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Authenticated: deactivate the caller's push subscription for an endpoint. */
export const unsubscribePush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: unknown) => z.object({ endpoint: z.string() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("push_subscriptions")
      .update({ active: false })
      .eq("user_id", userId)
      .eq("endpoint", data.endpoint);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Authenticated: returns the caller's notifications (most recent 50). */
export const getNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Authenticated: mark a notification as read. */
export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Authenticated: mark all of the caller's notifications as read. */
export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("read", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Staff-only: send a notification to one or more users.
 * Creates in-app notification rows and pushes to all active subscriptions.
 */
export const sendNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: unknown) =>
      z
        .object({
          userIds: z.array(z.string().uuid()).min(1),
          type: z.string(),
          title: z.string().min(1),
          body: z.string().optional(),
          link: z.string().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify caller is staff
    const { data: canSend } = await supabase.rpc("is_staff", { _user_id: userId });
    if (!canSend) throw new Error("Forbidden: staff only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Create in-app notification rows
    const rows = data.userIds.map((uid) => ({
      user_id: uid,
      type: data.type,
      title: data.title,
      body: data.body ?? null,
      link: data.link ?? null,
      read: false,
    }));
    const { error: notifError } = await supabaseAdmin.from("notifications").insert(rows);
    if (notifError) throw new Error(notifError.message);

    // 2. Fetch active push subscriptions for target users
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_key")
      .in("user_id", data.userIds)
      .eq("active", true);

    if (subs && subs.length > 0) {
      const pushPayload = {
        title: data.title,
        body: data.body ?? "",
        link: data.link,
        tag: `icc-${data.type}`,
      };
      const results = await sendPushToSubscriptions(
        subs as PushSubscriptionRow[],
        pushPayload,
      );

      // 3. Deactivate dead subscriptions
      const deadEndpoints = results.filter((r) => shouldDeactivate(r.status)).map((r) => r.endpoint);
      if (deadEndpoints.length > 0) {
        await supabaseAdmin
          .from("push_subscriptions")
          .update({ active: false })
          .in("endpoint", deadEndpoints);
      }
    }

    return { ok: true, sent: data.userIds.length };
  });
