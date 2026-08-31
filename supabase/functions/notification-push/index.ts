import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")!;
const admin = createClient(URL, SERVICE);
const headers = { "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ success: false, error: "POST required" }, 405);
  try {
    const { notification_id } = await req.json();
    if (!notification_id) return json({ success: false, error: "notification_id required" }, 400);

    const now = new Date().toISOString();
    const { data: notification, error: claimError } = await admin
      .from("notifications")
      .update({ push_sent_at: now })
      .eq("id", notification_id)
      .is("push_sent_at", null)
      .select("id,user_id,title,body,link,type")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!notification) return json({ success: true, skipped: true, reason: "already_sent_or_missing" });

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    const { data: subscriptions, error: subError } = await admin
      .from("icc_push_subscriptions")
      .select("id,subscription")
      .eq("user_id", notification.user_id)
      .eq("enabled", true);
    if (subError) throw subError;

    let sent = 0, failed = 0;
    for (const row of subscriptions ?? []) {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify({
          title: notification.title,
          body: notification.body ?? "",
          link: notification.link ?? "/",
          url: notification.link ?? "/",
          tag: `icc-${notification.type ?? "notification"}-${notification.id}`,
        }));
        sent++;
      } catch (error: any) {
        failed++;
        if ([404, 410].includes(error?.statusCode)) {
          await admin.from("icc_push_subscriptions").update({ enabled: false, updated_at: now }).eq("id", row.id);
        }
      }
    }
    return json({ success: true, sent, failed, subscriptions: (subscriptions ?? []).length });
  } catch (error: any) {
    console.error(error);
    return json({ success: false, error: error?.message ?? String(error) }, 500);
  }
});
