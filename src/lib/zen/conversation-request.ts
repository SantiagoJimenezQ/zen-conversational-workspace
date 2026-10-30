import type { ChatRequest, Message } from "./schema";

// Below the route's 80 KB ceiling, measured as UTF-8 including JSON escaping and receipts.
export const MAX_CHAT_BYTES = 64000;
export function buildConversationRequest(
  conversationId: string,
  mode: ChatRequest["mode"],
  messages: Message[],
): ChatRequest {
  const usable = messages.filter(
    (m) => m.status !== "error" && m.status !== "stopped",
  );
  const receipts = [
    ...new Set(
      usable.flatMap((m) =>
        m.artifacts.flatMap((a) => (a.receipt ? [a.receipt] : [])),
      ),
    ),
  ].slice(-8);
  const payload: ChatRequest = {
    conversationId,
    mode,
    messages: usable.slice(-40).map(({ role, text }) => ({ role, text })),
    receipts,
    omittedMessages: Math.max(0, usable.length - 40),
    operationIds: [
      ...new Set(
        usable.flatMap((m) =>
          m.artifacts.flatMap((a) =>
            a.kind === "mcp-operation" ? [a.operationId] : [],
          ),
        ),
      ),
    ].slice(-8),
  };
  const bytes = () =>
    new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  while (
    payload.messages.length > 1 &&
    (bytes() > MAX_CHAT_BYTES || payload.messages[0].role !== "user")
  ) {
    payload.messages.shift();
    payload.omittedMessages++;
  }
  if (bytes() > MAX_CHAT_BYTES)
    throw new Error("This message is too large. Please shorten it.");
  return payload;
}
