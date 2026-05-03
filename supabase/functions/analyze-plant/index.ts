// ===========================================================================
// Supabase Edge Function: analyze-plant
//   POST /functions/v1/analyze-plant
//
//   Auth: requires the caller's Supabase JWT (Authorization: Bearer <token>).
//         The function uses that JWT to talk back to the database with the
//         user's RLS, so a caller can never read or write another user's data.
//
//   Body: { plantId: string, photoId?: string, photoUrl: string, question?: string }
//
//   It does the following:
//     1. Loads the plant + full care history + photo history from Supabase
//        (using the caller's JWT so RLS applies).
//     2. Builds a structured prompt for Grok including all that context.
//     3. Calls the xAI Grok API (vision + reasoning) with the new photo URL.
//     4. Persists the advice into `grok_advice` and returns it.
//
//   Secrets (set via `supabase secrets set`):
//     - XAI_API_KEY     (required) — your xAI API key
//     - XAI_MODEL       (optional) — defaults to "grok-4-fast"
// ===========================================================================
//
// Run locally:  supabase functions serve analyze-plant --env-file ./supabase/.env
// Deploy:       supabase functions deploy analyze-plant
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

interface Plant {
  id: string;
  name: string;
  species: string | null;
  pot_type: string | null;
  drainage: boolean;
  light: string | null;
  location: string | null;
  notes: string | null;
  watering_interval_days: number | null;
  fertilizing_interval_days: number | null;
  created_at: string;
}

interface CareLog {
  action_type: string;
  acted_at: string;
  notes: string | null;
}

interface PlantPhoto {
  id: string;
  url: string;
  caption: string | null;
  uploaded_at: string;
}

interface PriorAdvice {
  status: string | null;
  summary: string | null;
  next_action: string | null;
  created_at: string;
}

const SYSTEM_PROMPT = `You are BotanyBuddy, an expert, warm, and precise houseplant care assistant.

You are helping the owner of ONE specific plant. Always tailor advice to:
- The exact species
- Pot type and drainage situation (especially "no drainage" = high risk of rot)
- Recent care history
- Current photo

Be honest: if the plant looks healthy, say so. If something looks wrong, explain why.

Answer ONLY in valid JSON matching this exact schema (no extra text):

{
  "status": "Healthy" | "Needs water soon" | "Needs water now" | "Overwatered" | "Concern" | "Pest" | "Repot soon" | "Recovering" | "Unclear",
  "summary": "1-2 short sentences about the current photo and plant condition.",
  "observations": ["bullet point 1", "bullet point 2"],
  "watering": "specific advice for this plant right now",
  "light": "light recommendation",
  "humidity": "humidity recommendation",
  "problems": ["problem: explanation", ...] or [],
  "repotting": "repotting/drainage advice or empty string",
  "next_action": "One clear, actionable sentence (e.g. 'Water lightly today' or 'Mist leaves daily')",
  "next_action_in_days": number | null   // 0 = today, 3 = in 3 days, null = no specific action
}`;

function buildUserPrompt(
  plant: Plant,
  logs: CareLog[],
  photos: PlantPhoto[],
  priorAdvice: PriorAdvice[],
  question: string | undefined,
): string {
  const ageDays = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(plant.created_at).getTime()) / 86_400_000,
    ),
  );

  const recentLogs = logs.slice(0, 25).map((l) => {
    const days = Math.floor(
      (Date.now() - new Date(l.acted_at).getTime()) / 86_400_000,
    );
    const note = l.notes ? ` — ${l.notes}` : "";
    return `  - ${days}d ago: ${l.action_type}${note}`;
  });

  const recentPhotos = photos.slice(0, 6).map((p) => {
    const days = Math.floor(
      (Date.now() - new Date(p.uploaded_at).getTime()) / 86_400_000,
    );
    const cap = p.caption ? ` (${p.caption})` : "";
    return `  - ${days}d ago${cap}`;
  });

  const advice = priorAdvice.slice(0, 5).map((a) => {
    const days = Math.floor(
      (Date.now() - new Date(a.created_at).getTime()) / 86_400_000,
    );
    return `  - ${days}d ago: ${a.status ?? "?"} — ${a.summary ?? ""} → ${a.next_action ?? ""}`;
  });

  return `Plant profile
-------------
Name: ${plant.name}
Species: ${plant.species ?? "unknown"}
Pot: ${plant.pot_type ?? "unknown"} | Drainage: ${plant.drainage ? "Yes" : "NO DRAINAGE HOLES — HIGH RISK"}
Light preference: ${plant.light ?? "unknown"}
Location: ${plant.location ?? "unknown"}
Notes: ${plant.notes ?? "(none)"}
Age: ${ageDays} days

Recent care log (most recent first)
-----------------------------------
${recentLogs.length ? recentLogs.join("\n") : "  (none yet)"}

Recent photos
-------------
${recentPhotos.length ? recentPhotos.join("\n") : "  (first photo)"}

Previous Grok advice
--------------------
${advice.length ? advice.join("\n") : "  (none)"}

User question: ${question ?? "Give a full current assessment and next action."}`;
}

async function callGrok(
  userPrompt: string,
  photoUrl: string,
): Promise<any> {
  const res = await fetch(`${XAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${XAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: photoUrl, detail: "high" } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grok API ${res.status}: ${text}`);
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { status: "Unclear", summary: raw, next_action: "" };
  }
  return { parsed, raw, model: data?.model ?? XAI_MODEL };
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

    // Use the caller's JWT so RLS applies to all reads/writes.
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const { plantId, photoId, photoUrl, question } = body ?? {};
    if (!plantId || !photoUrl) {
      return json({ error: "plantId and photoUrl are required" }, 400);
    }

    // 1. Load plant + history (RLS guarantees ownership).
    const [plantRes, logsRes, photosRes, adviceRes] = await Promise.all([
      supabase.from("plants").select("*").eq("id", plantId).single(),
      supabase
        .from("care_logs")
        .select("action_type, acted_at, notes")
        .eq("plant_id", plantId)
        .order("acted_at", { ascending: false })
        .limit(50),
      supabase
        .from("plant_photos")
        .select("id, url, caption, uploaded_at")
        .eq("plant_id", plantId)
        .order("uploaded_at", { ascending: false })
        .limit(10),
      supabase
        .from("grok_advice")
        .select("status, summary, next_action, created_at")
        .eq("plant_id", plantId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (plantRes.error || !plantRes.data) {
      return json({ error: "Plant not found" }, 404);
    }
    const plant = plantRes.data as Plant;
    const logs = (logsRes.data ?? []) as CareLog[];
    const photos = (photosRes.data ?? []) as PlantPhoto[];
    const priorAdvice = (adviceRes.data ?? []) as PriorAdvice[];

    // 2. Build prompt and 3. call Grok.
    const userPrompt = buildUserPrompt(plant, logs, photos, priorAdvice, question);
    const { parsed, raw, model } = await callGrok(userPrompt, photoUrl);

    // Compute next-action timestamp.
    let nextActionAt: string | null = null;
    if (typeof parsed.next_action_in_days === "number") {
      const d = new Date();
      d.setDate(d.getDate() + parsed.next_action_in_days);
      nextActionAt = d.toISOString();
    }

    // 4. Persist advice.
    const { data: inserted, error: insertErr } = await supabase
      .from("grok_advice")
      .insert({
        plant_id: plantId,
        user_id: userId,
        photo_id: photoId ?? null,
        summary: parsed.summary ?? null,
        status: parsed.status ?? null,
        next_action: parsed.next_action ?? null,
        next_action_at: nextActionAt,
        raw: { ...parsed, _raw: raw },
        model,
      })
      .select()
      .single();

    if (insertErr) {
      // Still return advice to the client even if logging failed.
      return json({ advice: parsed, persisted: false, error: insertErr.message });
    }

    return json({ advice: parsed, persisted: true, record: inserted });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
