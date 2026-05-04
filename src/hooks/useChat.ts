import { useCallback, useEffect, useState } from "react";
import { supabase, CHAT_FUNCTION_URL } from "@/lib/supabase";
import type { ChatMessage, PlantPhoto } from "@/lib/types";
import { useAuth } from "./useAuth";

const HISTORY_LIMIT = 200;

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
    // Fetch the most recent N descending so the SELECT bounds; flip on the
    // client for natural oldest-first display.
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("plant_id", plantId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    const rows = (data ?? []) as ChatMessage[];
    setMessages(rows.slice().reverse());
    setLoading(false);
  }, [plantId, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime updates so other devices stay in sync. Skip messages we already
  // have in state — the local optimistic merge covers our own sends, so this
  // handler only needs to pick up rows from other tabs/devices.
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
        (payload) => {
          const row = payload.new as ChatMessage;
          setMessages((curr) => {
            if (curr.some((m) => m.id === row.id)) return curr;
            return [...curr, row].sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime(),
            );
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [plantId]);

  const send = useCallback(
    async (content: string, photo?: PlantPhoto | null) => {
      if (!plantId || !user) return;
      if (!CHAT_FUNCTION_URL) {
        throw new Error("VITE_CHAT_FUNCTION_URL is not configured");
      }
      setSending(true);
      const optimisticId = `pending-${Date.now()}`;
      const optimistic: ChatMessage = {
        id: optimisticId,
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

        const userMessage = j.userMessage as ChatMessage | undefined;
        const assistantMessage = j.message as ChatMessage | undefined;

        // Swap the optimistic placeholder for the real records and append
        // the assistant reply — no extra SELECT roundtrip needed.
        setMessages((curr) => {
          const withoutOptimistic = curr.filter((x) => x.id !== optimisticId);
          const next = [...withoutOptimistic];
          if (userMessage && !next.some((x) => x.id === userMessage.id)) {
            next.push(userMessage);
          }
          if (
            assistantMessage &&
            !next.some((x) => x.id === assistantMessage.id)
          ) {
            next.push(assistantMessage);
          }
          return next.sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime(),
          );
        });
      } catch (err) {
        setMessages((m) => m.filter((x) => x.id !== optimisticId));
        throw err;
      } finally {
        setSending(false);
      }
    },
    [plantId, user],
  );

  return { messages, loading, sending, send, refresh };
}
