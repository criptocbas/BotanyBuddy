// ===========================================================================
// Supabase Edge Function: identify-plant
//   POST /functions/v1/identify-plant
//
//   For the photo-first add-plant flow. The plant doesn't exist yet — the
//   user just took or picked a photo. We ask Grok to identify the species
//   from the image alone and return a confidence + a starter assessment.
//   The client persists everything (plant, photo, advice) once the user
//   confirms.
//
//   Auth: requires the caller's Supabase JWT (Authorization: Bearer <token>).
//   Body: { photoUrl: string }
//
//   Response: { result: IdentifyResult }
// ===========================================================================

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

const SYSTEM_PROMPT = `You are BotanyBuddy, an expert houseplant identification and care assistant.

The user has just taken or picked a photo of a plant they own. They have given you NOTHING else — no name, no species, no history. Your job is to identify what it is and give a brief starter assessment.

Be honest about uncertainty. If the photo is blurry, dark, too far away, shows multiple plants, or is not a houseplant at all, say so via the confidence field.

Confidence rubric:
- "high":   You are confident in the species (or at least the genus). The photo is clear.
- "medium": You can guess the species but have meaningful doubt, or the photo is okay but partial.
- "low":    The photo is blurry/dark/cluttered, or you genuinely cannot tell what it is.

Answer ONLY in valid JSON matching this exact schema (no extra text):

{
  "confidence": "high" | "medium" | "low",
  "species": "Scientific or common species name, e.g. 'Monstera deliciosa' or 'Snake Plant (Sansevieria)'",
  "common_name": "Short common name, e.g. 'Monstera' or 'Snake Plant'",
  "suggested_name": "A friendly nickname the user could call this plant, 1-3 words, e.g. 'Monstera' or 'Kitchen Pothos'",
  "status": "Healthy" | "Needs water soon" | "Needs water now" | "Overwatered" | "Concern" | "Pest" | "Repot soon" | "Recovering" | "Unclear",
  "summary": "1-2 short sentences about what you see in the photo and the plant's apparent condition.",
  "observations": ["bullet 1", "bullet 2"],
  "watering": "watering advice for this species/condition",
  "light": "light recommendation",
  "humidity": "humidity recommendation",
  "problems": ["problem: explanation", ...] or [],
  "repotting": "repotting/drainage advice or empty string",
  "next_action": "One clear, actionable next step (e.g. 'Water lightly today' or 'Wait 5 days before watering')",
  "next_action_in_days": number | null
}

If confidence is "low", set species/common_name/suggested_name to null and the advice fields can be brief or generic.`;

async function callGrok(photoUrl: string): Promise<any> {
  const res = await fetch(`${XAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${XAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Identify this plant and assess its current state from the photo alone. Be honest about your confidence.",
            },
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
    parsed = { confidence: "low", summary: raw };
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { photoUrl } = body ?? {};
    if (!photoUrl) return json({ error: "photoUrl is required" }, 400);

    const { parsed, raw, model } = await callGrok(photoUrl);
    return json({ result: { ...parsed, _raw: raw, model } });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
