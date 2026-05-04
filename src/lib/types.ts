// Shared TypeScript types that mirror the Supabase schema.

export type CareAction =
  | "water"
  | "fertilize"
  | "repot"
  | "prune"
  | "mist"
  | "rotate"
  | "observation"
  | "other";

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Plant {
  id: string;
  user_id: string;
  name: string;
  species: string | null;
  pot_type: string | null;
  drainage: boolean;
  light: string | null;
  location: string | null;
  notes: string | null;
  cover_photo_url: string | null;
  watering_interval_days: number | null;
  fertilizing_interval_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface PlantPhoto {
  id: string;
  plant_id: string;
  user_id: string;
  storage_path: string;
  url: string;
  caption: string | null;
  uploaded_at: string;
}

export interface CareLog {
  id: string;
  plant_id: string;
  user_id: string;
  action_type: CareAction;
  acted_at: string;
  notes: string | null;
  created_at: string;
}

export interface GrokAdviceRecord {
  id: string;
  plant_id: string;
  user_id: string;
  photo_id: string | null;
  summary: string | null;
  status: string | null;
  next_action: string | null;
  next_action_at: string | null;
  raw: GrokAdvice & { _raw?: string };
  model: string | null;
  created_at: string;
}

export interface GrokAdvice {
  status?: string;
  summary?: string;
  observations?: string[];
  watering?: string;
  light?: string;
  humidity?: string;
  problems?: string[];
  repotting?: string;
  next_action?: string;
  next_action_in_days?: number | null;
}

export interface IdentifyResult extends GrokAdvice {
  confidence: "high" | "medium" | "low";
  species: string | null;
  common_name: string | null;
  suggested_name: string | null;
  model?: string;
  _raw?: string;
}

export interface PlantWithStatus extends Plant {
  latest_advice_id: string | null;
  latest_status: string | null;
  latest_summary: string | null;
  latest_next_action: string | null;
  latest_next_action_at: string | null;
  latest_advice_at: string | null;
  last_watered_at: string | null;
  last_fertilized_at: string | null;
}

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  plant_id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  photo_id: string | null;
  model: string | null;
  created_at: string;
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
}
