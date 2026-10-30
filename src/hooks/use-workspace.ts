"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  artifactSchema,
  chatSchema,
  type Artifact,
  type Conversation,
  type Message,
  type StreamEvent,
} from "@/lib/zen/schema";

import { buildConversationRequest } from "@/lib/zen/conversation-request";
import { createTextBuffer } from "@/lib/zen/buffering";
import { useConversationPersistence } from "./use-conversation-persistence";

const STORAGE_KEY = "zen.conversations.v1"; // gitleaks:allow -- localStorage namespace, not a credential.
function conversationTitle(text: string) {
  if (/yesterday/i.test(text) && /calls?/i.test(text))
    return "Understand yesterday’s calls";
  if (/number/i.test(text) && /poland|polish/i.test(text))
    return "Set up a Polish phone number";
  if (/alert/i.test(text) && /calls?/i.test(text))
    return "Build an alert calling workflow";
  return text.length > 66
    ? `${text.slice(0, 63).replace(/\s+\S*$/, "")}…`
    : text;
}
const storageSchema = z.object({
  chats: z.array(chatSchema).max(20),
  activeId: z.string().nullable(),
});
export function useWorkspace(configured: boolean) {
  const [chats, setChats] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"live" | "demo">(
    configured ? "live" : "demo",
  );
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const pendingRef = useRef<{
    conversationId: string;
    messageId: string;
  } | null>(null);
  const textBufferRef = useRef<ReturnType<typeof createTextBuffer> | null>(
    null,
  );
  useConversationPersistence(STORAGE_KEY, { chats, activeId }, ready, busy);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = storageSchema.parse(JSON.parse(saved));
        // Synchronize external persisted state; unfinished streams never resume silently.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setChats(
          parsed.chats.map((c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.status === "streaming"
                ? { ...m, status: "stopped" as const }
                : m,
            ),
          })),
        );
        setActiveId(parsed.activeId);
      }
    } catch {
      toast.info(
        "Saved conversations couldn’t be restored. You can start a new chat.",
      );
    }
    setReady(true);
    return () => {
      textBufferRef.current?.flush();
      requestRef.current?.abort();
    };
  }, []);

  const updateMessage = useCallback(
    (
      conversationId: string,
      messageId: string,
      update: (message: Message) => Message,
    ) => {
      setChats((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                updatedAt: new Date().toISOString(),
                messages: c.messages.map((m) =>
                  m.id === messageId ? update(m) : m,
                ),
              }
            : c,
        ),
      );
    },
    [],
  );
  const stop = useCallback(() => {
    textBufferRef.current?.flush();
    textBufferRef.current = null;
    requestRef.current?.abort();
    const pending = pendingRef.current;
    if (pending)
      updateMessage(pending.conversationId, pending.messageId, (m) => ({
        ...m,
        status: "stopped",
      }));
    pendingRef.current = null;
    requestRef.current = null;
    setBusy(false);
    setActivity("");
  }, [updateMessage]);

  async function send(text: string) {
    text = text.trim();
    if (!text || requestRef.current) return;
    if (text.length > 4000) {
      setError("Please keep your message under 4,000 characters.");
      return;
    }
    const existing = chats.find((c) => c.id === activeId);
    if (existing && existing.messages.length >= 38) {
      setError(
        "This chat has reached its demo limit. Start a new chat to continue.",
      );
      return;
    }
    const conversationId = existing?.id ?? crypto.randomUUID();
    const user: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      sources: [],
      artifacts: [],
      status: "complete",
    };
    const assistant: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "",
      sources: [],
      artifacts: [],
      status: "streaming",
    };
    const history = [
      ...(existing?.messages ?? []).filter(
        (m) => m.status !== "error" && m.status !== "stopped",
      ),
      user,
    ];
    let payload;
    try {
      payload = buildConversationRequest(conversationId, mode, history);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please shorten your message.");
      return;
    }
    const conversation: Conversation = {
      id: conversationId,
      title: existing?.title ?? conversationTitle(text),
      messages: [...(existing?.messages ?? []), user, assistant],
      updatedAt: new Date().toISOString(),
    };
    setChats((prev) =>
      [conversation, ...prev.filter((c) => c.id !== conversationId)].slice(
        0,
        20,
      ),
    );
    setActiveId(conversationId);
    const controller = new AbortController();
    requestRef.current = controller;
    pendingRef.current = { conversationId, messageId: assistant.id };
    setBusy(true);
    setActivity(mode === "live" ? "Thinking" : "Running the offline demo…");
    setError(null);
    const textBuffer = createTextBuffer((text) => {
      if (controller.signal.aborted) return;
      updateMessage(conversationId, assistant.id, (m) => ({
        ...m,
        text: m.text + text,
      }));
    });
    textBufferRef.current = textBuffer;
    let receivedDone = false;
    const accept = (event: StreamEvent) => {
      if (controller.signal.aborted) return;
      if (event.type === "text") {
        textBuffer.push(event.text);
        setActivity("");
      }
      if (event.type !== "text") textBuffer.flush();
      if (event.type === "artifact")
        updateMessage(conversationId, assistant.id, (m) => ({
          ...m,
          artifacts: [...m.artifacts, artifactSchema.parse(event.artifact)],
        }));
      if (event.type === "sources")
        updateMessage(conversationId, assistant.id, (m) => ({
          ...m,
          sources: [...new Set([...m.sources, ...event.sources])],
        }));
      if (event.type === "status") setActivity(event.text);
      if (event.type === "error") throw new Error(event.message);
      if (event.type === "done") receivedDone = true;
    };
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "The conversation couldn’t start.");
      }
      if (!response.body) throw new Error("The response stream was empty.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          buffer += done
            ? decoder.decode()
            : decoder.decode(value, { stream: true });
          let index: number;
          while ((index = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, index);
            buffer = buffer.slice(index + 1);
            if (line.trim()) accept(JSON.parse(line));
          }
          if (done) break;
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      if (controller.signal.aborted) return;
      textBuffer.flush();
      if (!receivedDone)
        throw new Error("The conversation ended early. Try again.");
      updateMessage(conversationId, assistant.id, (m) => ({
        ...m,
        status: "complete",
      }));
    } catch (e) {
      textBuffer.flush();
      if (!controller.signal.aborted) {
        const message =
          e instanceof Error ? e.message : "The conversation could not finish.";
        setError(message);
        updateMessage(conversationId, assistant.id, (m) => ({
          ...m,
          status: "error",
        }));
      }
    } finally {
      textBuffer.flush();
      if (requestRef.current === controller) {
        textBufferRef.current = null;
        requestRef.current = null;
        pendingRef.current = null;
        setBusy(false);
        setActivity("");
      }
    }
  }
  function selectChat(id: string | null) {
    stop();
    setActiveId(id);
    setError(null);
  }
  function replaceArtifact(
    messageId: string,
    index: number,
    artifact: Artifact,
  ) {
    if (activeId)
      updateMessage(activeId, messageId, (m) => ({
        ...m,
        artifacts: m.artifacts.map((a, i) => (i === index ? artifact : a)),
      }));
  }
  function deleteChat(id: string) {
    if (id === activeId) selectChat(null);
    setChats((prev) => prev.filter((c) => c.id !== id));
  }
  return {
    chats,
    active: chats.find((c) => c.id === activeId),
    activeId,
    ready,
    mode,
    setMode,
    busy,
    activity,
    error,
    setError,
    send,
    stop,
    selectChat,
    deleteChat,
    replaceArtifact,
  };
}
