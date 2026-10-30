process.env.ZERNIO_MCP_MOCK = "false";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  buildConversationRequest,
  MAX_CHAT_BYTES,
} from "../src/lib/zen/conversation-request";
import { chatRequest, type Message } from "../src/lib/zen/schema";
import { getDemoInsights } from "../src/lib/zen/fixtures";
import { readBody } from "../src/lib/zen/http";

const message = (role: Message["role"], text: string): Message => ({
  id: randomUUID(),
  role,
  text,
  artifacts: [],
  sources: [],
  status: "complete",
});
test("thirteen artifact-heavy turns fit the route without retransmitting UI records", async () => {
  const id = randomUUID();
  const messages: Message[] = [];
  for (let i = 0; i < 13; i++) {
    messages.push(
      message(
        "user",
        "Please inspect these sample call records. " + "a".repeat(2950),
      ),
    );
    const payload = buildConversationRequest(id, "demo", messages);
    const body = JSON.stringify(payload);
    assert.ok(new TextEncoder().encode(body).byteLength <= MAX_CHAT_BYTES);
    assert.deepEqual(
      chatRequest.parse(
        await readBody(
          new Request("http://localhost:3000/api/chat", {
            method: "POST",
            body,
          }),
        ),
      ),
      payload,
    );
    assert.ok(
      !body.includes('"artifacts"') &&
        !body.includes('"calls"') &&
        !body.includes('"sources"'),
    );
    messages.push({
      ...message("assistant", "Here is the calculated sample activity."),
      artifacts: [getDemoInsights()],
    });
  }
});
test("history budget accounts for UTF-8, JSON escaping and retains complete recent turns", () => {
  const messages = Array.from({ length: 39 }, (_, i) =>
    message(
      i % 2 ? "assistant" : "user",
      `${i}:` + '🧪\n"'.repeat(i % 2 ? 2500 : 900),
    ),
  );
  const latest = messages.at(-1)!.text;
  const payload = buildConversationRequest(randomUUID(), "live", messages);
  assert.ok(
    new TextEncoder().encode(JSON.stringify(payload)).byteLength <=
      MAX_CHAT_BYTES,
  );
  assert.ok(payload.omittedMessages > 0);
  assert.equal(payload.messages[0].role, "user");
  assert.equal(payload.messages.at(-1)!.text, latest);
  assert.equal(
    payload.messages.length + payload.omittedMessages,
    messages.length,
  );
});
test("request excludes incomplete responses and caps unique receipt context", () => {
  const messages = Array.from({ length: 12 }, (_, i) => ({
    ...message("assistant", "Setup"),
    artifacts: [
      {
        kind: "cancelled" as const,
        country: "PL" as const,
        capability: "voice" as const,
        receipt: `receipt-${i}`,
      },
    ],
  }));
  messages[11].status = "error";
  const payload = buildConversationRequest(randomUUID(), "live", [
    ...messages,
    message("user", "What happened?"),
  ]);
  assert.equal(payload.receipts.length, 8);
  assert.equal(payload.receipts.at(-1), "receipt-10");
  assert.ok(!payload.receipts.includes("receipt-11"));
});
