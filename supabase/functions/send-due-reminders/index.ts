// ===========================================================================
// Supabase Edge Function: send-due-reminders
//   POST /functions/v1/send-due-reminders
//
//   Designed to be called by Supabase pg_cron via pg_net every ~15 minutes.
//   Scans the public.due_reminders view, sends a Web Push to every device
//   the user has subscribed, and marks the reminder as notified so it's
//   not re-sent.
//
//   Auth: shared secret in `X-Cron-Secret` header. Deploy with --no-verify-jwt.
//
//   Required secrets (`supabase secrets set …`):
//     - SERVICE_ROLE_KEY      Supabase service-role key (bypasses RLS)
//     - VAPID_PUBLIC_KEY      VAPID public key (URL-safe base64)
//     - VAPID_PRIVATE_KEY     VAPID private key (URL-safe base64)
//     - VAPID_SUBJECT         "mailto:you@example.com"
//     - CRON_SHARED_SECRET    Random string the cron job sends in the header
// ===========================================================================
//
// Deploy:  supabase functions deploy send-due-reminders --no-verify-jwt
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@botanybuddy.app";
const CRON_SHARED_SECRET = Deno.env.get("CRON_SHARED_SECRET") ?? "";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

interface DueReminder {
  user_id: string;
  plant_id: string;
  plant_name: string;
  title: string;
  source: "grok" | "water";
  advice_id: string | null;
}

interface PushSub {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!CRON_SHARED_SECRET) return json({ error: "CRON_SHARED_SECRET not set" }, 500);
  if (req.headers.get("x-cron-secret") !== CRON_SHARED_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1. Find due reminders.
  const { data: due, error: dueErr } = await admin
    .from("due_reminders")
    .select("*")
    .limit(200);
  if (dueErr) return json({ error: dueErr.message }, 500);
  const reminders = (due ?? []) as DueReminder[];

  if (reminders.length === 0) return json({ ok: true, sent: 0 });

  // 2. Group by user so we only fetch each user's subs once.
  const byUser = new Map<string, DueReminder[]>();
  for (const r of reminders) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id)!.push(r);
  }

  let sent = 0;
  let errors = 0;
  const deadEndpoints: string[] = [];
  const notifiedAdviceIds: string[] = [];
  const notifiedPlantIds: string[] = [];

  for (const [userId, items] of byUser) {
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .eq("user_id", userId);

    const userSubs = (subs ?? []) as PushSub[];

    for (const r of items) {
      const payload = JSON.stringify({
        title: r.plant_name,
        body: r.title,
        url: `/plants/${r.plant_id}`,
        tag: `reminder-${r.plant_id}-${r.source}`,
      });

      // Fan out to every device this user subscribed.
      for (const sub of userSubs) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            { TTL: 60 * 60 * 24 },
          );
          sent++;
        } catch (err: any) {
          // 404 / 410 = subscription is dead, prune it.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            deadEndpoints.push(sub.endpoint);
          } else {
            errors++;
            console.error("push error", sub.endpoint, err?.statusCode, err?.body);
          }
        }
      }

      // Mark this reminder as notified so it's not re-sent.
      if (r.source === "grok" && r.advice_id) {
        notifiedAdviceIds.push(r.advice_id);
      } else if (r.source === "water") {
        notifiedPlantIds.push(r.plant_id);
      }
    }
  }

  if (notifiedAdviceIds.length > 0) {
    await admin
      .from("grok_advice")
      .update({ notified_at: new Date().toISOString() })
      .in("id", notifiedAdviceIds);
  }
  if (notifiedPlantIds.length > 0) {
    await admin
      .from("plants")
      .update({ last_water_due_notified_at: new Date().toISOString() })
      .in("id", notifiedPlantIds);
  }
  if (deadEndpoints.length > 0) {
    await admin
      .from("push_subscriptions")
      .delete()
      .in("endpoint", deadEndpoints);
  }

  return json({ ok: true, sent, errors, pruned: deadEndpoints.length });
});
