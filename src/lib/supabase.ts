import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Fail loudly in dev so the user knows to copy .env.example to .env.
  console.error(
    "Missing Supabase env vars. Copy .env.example to .env and fill in your project URL and anon key.",
  );
}

export const supabase = createClient(url ?? "", anon ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const PHOTO_BUCKET = "plant-photos";

export const ANALYZE_FUNCTION_URL =
  import.meta.env.VITE_ANALYZE_FUNCTION_URL ||
  (url ? `${url}/functions/v1/analyze-plant` : "");

export const CHAT_FUNCTION_URL =
  import.meta.env.VITE_CHAT_FUNCTION_URL ||
  (url ? `${url}/functions/v1/chat` : "");

export const IDENTIFY_FUNCTION_URL =
  import.meta.env.VITE_IDENTIFY_FUNCTION_URL ||
  (url ? `${url}/functions/v1/identify-plant` : "");
