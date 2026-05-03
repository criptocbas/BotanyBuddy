import { useCallback, useEffect, useState } from "react";
import { supabase, PHOTO_BUCKET, ANALYZE_FUNCTION_URL } from "@/lib/supabase";
import type {
  CareAction,
  CareLog,
  GrokAdvice,
  GrokAdviceRecord,
  Plant,
  PlantPhoto,
  PlantWithStatus,
} from "@/lib/types";
import { useAuth } from "./useAuth";

export function usePlants() {
  const { user } = useAuth();
  const [plants, setPlants] = useState<PlantWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setPlants([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("plants_with_status")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    setPlants((data ?? []) as PlantWithStatus[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: refresh when our own plants/logs/advice change.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`plants-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plants", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grok_advice", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  const createPlant = useCallback(
    async (input: Omit<Plant, "id" | "user_id" | "created_at" | "updated_at" | "cover_photo_url">) => {
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("plants")
        .insert({ ...input, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      await refresh();
      return data as Plant;
    },
    [user, refresh],
  );

  const deletePlant = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("plants").delete().eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  return { plants, loading, error, refresh, createPlant, deletePlant };
}

// ---------------------------------------------------------------------------
// Single-plant detail data (photos, logs, advice)
// ---------------------------------------------------------------------------
export function usePlant(plantId: string | undefined) {
  const { user } = useAuth();
  const [plant, setPlant] = useState<Plant | null>(null);
  const [photos, setPhotos] = useState<PlantPhoto[]>([]);
  const [logs, setLogs] = useState<CareLog[]>([]);
  const [advice, setAdvice] = useState<GrokAdviceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!plantId || !user) return;
    setLoading(true);
    const [p, ph, lg, ad] = await Promise.all([
      supabase.from("plants").select("*").eq("id", plantId).single(),
      supabase
        .from("plant_photos")
        .select("*")
        .eq("plant_id", plantId)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("care_logs")
        .select("*")
        .eq("plant_id", plantId)
        .order("acted_at", { ascending: false }),
      supabase
        .from("grok_advice")
        .select("*")
        .eq("plant_id", plantId)
        .order("created_at", { ascending: false }),
    ]);
    if (p.data) setPlant(p.data as Plant);
    setPhotos((ph.data ?? []) as PlantPhoto[]);
    setLogs((lg.data ?? []) as CareLog[]);
    setAdvice((ad.data ?? []) as GrokAdviceRecord[]);
    setLoading(false);
  }, [plantId, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!plantId) return;
    const channel = supabase
      .channel(`plant-${plantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plant_photos", filter: `plant_id=eq.${plantId}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "care_logs", filter: `plant_id=eq.${plantId}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grok_advice", filter: `plant_id=eq.${plantId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [plantId, refresh]);

  const updatePlant = useCallback(
    async (patch: Partial<Plant>) => {
      if (!plantId) return;
      const { error } = await supabase
        .from("plants")
        .update(patch)
        .eq("id", plantId);
      if (error) throw error;
      await refresh();
    },
    [plantId, refresh],
  );

  const addLog = useCallback(
    async (action_type: CareAction, notes?: string, acted_at?: string) => {
      if (!plantId || !user) return;
      const { error } = await supabase.from("care_logs").insert({
        plant_id: plantId,
        user_id: user.id,
        action_type,
        notes: notes ?? null,
        acted_at: acted_at ?? new Date().toISOString(),
      });
      if (error) throw error;
      await refresh();
    },
    [plantId, user, refresh],
  );

  const uploadPhoto = useCallback(
    async (file: File, caption?: string): Promise<PlantPhoto | null> => {
      if (!plantId || !user) return null;
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${plantId}/${Date.now()}.${ext}`;
      const up = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw up.error;
      const { data: urlData } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
      const { data, error } = await supabase
        .from("plant_photos")
        .insert({
          plant_id: plantId,
          user_id: user.id,
          storage_path: path,
          url: urlData.publicUrl,
          caption: caption ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      // Set as cover photo for quick dashboard rendering.
      await supabase
        .from("plants")
        .update({ cover_photo_url: urlData.publicUrl })
        .eq("id", plantId);
      await refresh();
      return data as PlantPhoto;
    },
    [plantId, user, refresh],
  );

  const analyzeWithGrok = useCallback(
    async (photo: PlantPhoto, question?: string): Promise<GrokAdvice> => {
      if (!plantId) throw new Error("No plant");
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not signed in");
      if (!ANALYZE_FUNCTION_URL) {
        throw new Error("VITE_ANALYZE_FUNCTION_URL is not configured");
      }
      const res = await fetch(ANALYZE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plantId,
          photoId: photo.id,
          photoUrl: photo.url,
          question,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Grok error ${res.status}`);
      await refresh();
      return json.advice as GrokAdvice;
    },
    [plantId, refresh],
  );

  return {
    plant,
    photos,
    logs,
    advice,
    loading,
    refresh,
    updatePlant,
    addLog,
    uploadPhoto,
    analyzeWithGrok,
  };
}
