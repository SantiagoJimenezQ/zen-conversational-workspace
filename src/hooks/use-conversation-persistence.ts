"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createDeferredWriter } from "@/lib/zen/buffering";
import type { Conversation } from "@/lib/zen/schema";

type Snapshot = { chats: Conversation[]; activeId: string | null };
export function useConversationPersistence(
  key: string,
  snapshot: Snapshot,
  ready: boolean,
  busy: boolean,
) {
  const [writer] = useState(() => {
    let warned = false;
    return createDeferredWriter<Snapshot>((value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        if (!warned)
          toast.error(
            "Browser storage is full. This conversation may not be saved.",
          );
        warned = true;
      }
    });
  });
  useEffect(() => {
    if (!ready) return;
    writer.schedule({
      chats: snapshot.chats.slice(0, 20),
      activeId: snapshot.activeId,
    });
    if (!busy) writer.flush();
  }, [snapshot.chats, snapshot.activeId, ready, busy, writer]);
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === "hidden") writer.flush();
    };
    window.addEventListener("pagehide", writer.flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", writer.flush);
      document.removeEventListener("visibilitychange", hidden);
      writer.flush();
    };
  }, [writer]);
}
