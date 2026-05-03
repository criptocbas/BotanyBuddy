import { useCallback, useEffect, useState } from "react";
import { supabase, CHAT_FUNCTION_URL } from "@/lib/supabase";
import type { ChatMessage, PlantPhoto } from "@/lib/types";
import { useAuth } from "./useAuth";

export function useChat(plantId: string | undefined) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    if (!plantId || !user) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("plant_id", plantId)
      .order("created_at", { ascending: true });
    setMessages((data ?? []) as ChatMessage[]);
    setLoading(false);
  }, [plantId, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime updates so other devices stay in sync.
  useEffect(() => {
    if (!plantId) return;
    const channel = supabase
      .channel(`chat-${plantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `plant_id=eq.${plantId}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [plantId, refresh]);

  const send = useCallback(
    async (content: string, photo?: PlantPhoto | null) => {
      if (!plantId || !user) return;
      if (!CHAT_FUNCTION_URL) {
        throw new Error("VITE_CHAT_FUNCTION_URL is not configured");
      }
      setSending(true);
      // Optimistic: show the user message immediately.
      const optimistic: ChatMessage = {
        id: `pending-${Date.now()}`,
        plant_id: plantId,
        user_id: user.id,
        role: "user",
        content,
        photo_id: photo?.id ?? null,
        model: null,
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, optimistic]);

      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) throw new Error("Not signed in");

        const res = await fetch(CHAT_FUNCTION_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            plantId,
            content,
            photoId: photo?.id ?? null,
            photoUrl: photo?.url ?? null,
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || `Chat error ${res.status}`);
        await refresh();
      } catch (err) {
        // Roll the optimistic message back so the user can retry.
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        throw err;
      } finally {
        setSending(false);
      }
    },
    [plantId, user, refresh],
  );

  return { messages, loading, sending, send, refresh };
}
