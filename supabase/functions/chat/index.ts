// ===========================================================================
// Supabase Edge Function: chat
//   POST /functions/v1/chat
//
//   Body: {
//     plantId: string,
//     content: string,                  // user message
//     photoId?: string,                 // optional new photo to include
//     photoUrl?: string                 // public URL of that photo
//   }
//
//   Returns: { message: ChatMessage }   // the assistant's reply
//
//   The edge function:
//     1. Verifies the caller's JWT (RLS enforced by passing the JWT to the
//        Supabase client — the user can only chat about their own plants).
//     2. Loads the plant context + recent care log + chat history.
//     3. Builds a multi-turn conversation: system → prior msgs → new user msg.
//     4. Calls Grok with vision if a photo was attached.
//     5. Persists the user message and the assistant reply.
//
//   Secrets:
//     - XAI_API_KEY (required)
//     - XAI_MODEL   (optional, defaults to "grok-4-fast")
// ===========================================================================
//
// Deploy:  supabase functions deploy chat
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const XAI_API_KEY = Deno.env.get("XAI_API_KEY");
const XAI_MODEL = Deno.env.get("XAI_MODEL") ?? "grok-4-fast";
const XAI_BASE_URL = Deno.env.get("XAI_BASE_URL") ?? "https://api.x.ai/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `You are BotanyBuddy, a warm, expert houseplant care assistant.

You're chatting with the owner of ONE specific plant. You'll receive that
plant's profile, recent care log, and the prior chat history as context.
Tailor every answer to THIS plant — its species, pot, drainage, light,
location, recent care, and what's been said in the conversation so far.

Style:
- Keep replies tight: 1–3 short paragraphs unless the user asks for depth.
- Be honest. If something looks wrong, say what and why. If it's fine, say so.
- No markdown, no bullet lists with "-", just clean prose.
- Don't restate the plant profile back at the user.
- If the user shares a new photo, look at it carefully and reference what
  you actually see.`;

function buildContext(plant: any, logs: any[]): string {
  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(plant.created_at).getTime()) / 86_400_000),
  );
  const recentLogs = (logs ?? []).slice(0, 15).map((l: any) => {
    const days = Math.floor(
      (Date.now() - new Date(l.acted_at).getTime()) / 86_400_000,
    );
    const note = l.notes ? ` — ${l.notes}` : "";
    return `  - ${days}d ago: ${l.action_type}${note}`;
  });
  return `Plant context (do NOT restate to the user):
Name: ${plant.name}
Species: ${plant.species ?? "unknown"}
Pot: ${plant.pot_type ?? "unknown"} | Drainage: ${plant.drainage ? "Yes" : "NO DRAINAGE — HIGH RISK"}
Light: ${plant.light ?? "unknown"}
Location: ${plant.location ?? "unknown"}
Owner notes: ${plant.notes ?? "(none)"}
Age in collection: ${ageDays} days

Recent care log (most recent first):
${recentLogs.length ? recentLogs.join("\n") : "  (no entries yet)"}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if (!XAI_API_KEY) return json({ error: "XAI_API_KEY not configured" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing bearer token" }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const { plantId, content, photoId, photoUrl } = body ?? {};
    if (!plantId || !content?.trim()) {
      return json({ error: "plantId and content are required" }, 400);
    }

    // 1. Persist the user message first so the UI can optimistically show it
    //    and so chat history stays consistent if Grok errors out.
    const { error: insertUserErr } = await supabase.from("chat_messages").insert({
      plant_id: plantId,
      user_id: userId,
      role: "user",
      content: content.trim(),
      photo_id: photoId ?? null,
    });
    if (insertUserErr) return json({ error: insertUserErr.message }, 500);

    // 2. Load context + chat history (RLS guarantees ownership).
    const [plantRes, logsRes, historyRes] = await Promise.all([
      supabase.from("plants").select("*").eq("id", plantId).single(),
      supabase
        .from("care_logs")
        .select("action_type, acted_at, notes")
        .eq("plant_id", plantId)
        .order("acted_at", { ascending: false })
        .limit(20),
      supabase
        .from("chat_messages")
        .select("role, content, created_at")
        .eq("plant_id", plantId)
        .order("created_at", { ascending: true })
        .limit(40),
    ]);

    if (plantRes.error || !plantRes.data) {
      return json({ error: "Plant not found" }, 404);
    }

    const plant = plantRes.data;
    const logs = logsRes.data ?? [];
    const history: Array<{ role: string; content: string }> = (historyRes.data ?? []) as any;

    // 3. Build chat messages for Grok.
    const contextBlock = buildContext(plant, logs);
    const messages: any[] = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\n${contextBlock}` },
    ];
    // History excludes the just-inserted last user message — we append it
    // separately below with the photo attachment.
    const prior = history.slice(0, -1);
    for (const m of prior) {
      messages.push({ role: m.role, content: m.content });
    }
    if (photoUrl) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: content.trim() },
          { type: "image_url", image_url: { url: photoUrl, detail: "high" } },
        ],
      });
    } else {
      messages.push({ role: "user", content: content.trim() });
    }

    // 4. Call Grok.
    const grokRes = await fetch(`${XAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        temperature: 0.5,
        messages,
      }),
    });

    if (!grokRes.ok) {
      const text = await grokRes.text();
      return json({ error: `Grok API ${grokRes.status}: ${text}` }, 502);
    }
    const grokData = await grokRes.json();
    const reply: string =
      grokData?.choices?.[0]?.message?.content ?? "(no response)";

    // 5. Persist the assistant reply.
    const { data: inserted, error: insertReplyErr } = await supabase
      .from("chat_messages")
      .insert({
        plant_id: plantId,
        user_id: userId,
        role: "assistant",
        content: reply,
        photo_id: null,
        model: grokData?.model ?? XAI_MODEL,
      })
      .select()
      .single();

    if (insertReplyErr) return json({ error: insertReplyErr.message }, 500);

    return json({ message: inserted });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
