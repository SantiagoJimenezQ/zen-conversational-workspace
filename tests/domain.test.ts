process.env.DEMO_SIGNING_SECRET = "test-only-preview-signing-secret";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  calculateInsights,
  demoCalls,
  getDemoInsights,
  yesterdayWindow,
} from "../src/lib/zen/fixtures";
import { executeTool } from "../src/lib/zen/tools";
import { createQuote, confirmQuote, cancelQuote } from "../src/lib/zen/quotes";
import { demoResponse } from "../src/lib/zen/demo";
import { readSse } from "../src/lib/zen/sse";
import { requestGuard } from "../src/lib/zen/http";
import type { Message } from "../src/lib/zen/schema";

const now = new Date("2026-10-30T12:00:00Z");
test("cancelled quotes cannot later be confirmed", () => {
  const id = randomUUID();
  const quote = createQuote(id, "voice", now);
  assert.equal(cancelQuote(quote.token, id, now).kind, "cancelled");
  assert.throws(() => confirmQuote(quote.token, id, true, now), /cancelled/);
});
test("account insight calculates outbound attempts and excludes inbound and next-day rows", () => {
  const insight = calculateInsights(demoCalls(now), yesterdayWindow(now));
  assert.equal(insight.date, "2026-10-29");
  assert.equal(insight.total, 24);
  assert.equal(insight.completed, 19);
  assert.equal(insight.unanswered, 3);
  assert.equal(insight.failed, 2);
  assert.equal(insight.pstn + insight.whatsapp, 24);
  assert.equal(
    insight.completed + insight.unanswered + insight.failed,
    insight.total,
  );
  assert.ok(insight.calls.every((c) => c.direction === "outbound"));
  assert.deepEqual(insight, getDemoInsights(now));
});
test("yesterday uses the account timezone, including 23- and 25-hour days", () => {
  const spring = yesterdayWindow(new Date("2026-03-30T10:00:00Z"));
  const autumn = yesterdayWindow(new Date("2026-10-26T10:00:00Z"));
  assert.equal(
    (Date.parse(spring.until) - Date.parse(spring.since)) / 3600000,
    23,
  );
  assert.equal(
    (Date.parse(autumn.until) - Date.parse(autumn.since)) / 3600000,
    25,
  );
  assert.equal(
    yesterdayWindow(new Date("2026-10-29T23:30:00Z")).date,
    "2026-10-29",
  );
});
test("tools reject invalid arguments, unknown tools and unsupported demo scope", () => {
  assert.equal(executeTool("toString", {}).error, "unknown_tool");
  assert.equal(executeTool("__proto__", {}).error, "unknown_tool");
  assert.equal(executeTool("purchase_number", {}).error, "unknown_tool");
  assert.equal(
    executeTool("prepare_phone_setup", { country: "PL", capability: "fax" })
      .error,
    "invalid_arguments",
  );
  assert.equal(
    executeTool("get_call_insights", { period: "last_month" }).error,
    "invalid_arguments",
  );
  assert.equal(
    executeTool("prepare_phone_setup", { country: "FR", capability: "voice" })
      .error,
    "outside_demo_scope",
  );
  assert.equal(
    executeTool("prepare_phone_setup", {
      country: "PL",
      capability: "voice",
      confirmed: true,
    }).error,
    "invalid_arguments",
  );
  assert.equal(
    executeTool("prepare_phone_setup", {
      country: "Poland",
      capability: "voice",
    }).artifact?.kind,
    "setup",
  );
});
test("demo confirmation requires consent, correct conversation, untampered and unexpired quote", () => {
  const chat = randomUUID();
  const quote = createQuote(chat, "voice", now);
  assert.throws(
    () => confirmQuote(quote.token, chat, false, now),
    /explicitly/,
  );
  assert.throws(
    () => confirmQuote(quote.token, randomUUID(), true, now),
    /different/,
  );
  assert.throws(
    () => confirmQuote(quote.token + "tampered", chat, true, now),
    /invalid/,
  );
  assert.throws(
    () =>
      confirmQuote(quote.token, chat, true, new Date(now.getTime() + 600001)),
    /expired/,
  );
  const result = confirmQuote(quote.token, chat, true, now);
  assert.equal(result.kind, "result");
  assert.deepEqual(
    confirmQuote(quote.token, chat, true, new Date(now.getTime() + 5000)),
    result,
  );
});
test("a chat yes cannot execute a purchase", () => {
  const messages: Message[] = [
    {
      id: "u1",
      role: "user",
      text: "Yes, buy the number now",
      artifacts: [],
      sources: [],
    },
  ];
  const events = demoResponse(messages, now);
  assert.ok(
    !events.some((e) => e.type === "artifact" && e.artifact.kind === "result"),
  );
  assert.ok(
    events.some(
      (e) =>
        e.type === "text" &&
        e.text.includes("cannot change your Workspace account"),
    ),
  );
});
test("same-origin boundary rejects cross-site JSON requests", () => {
  assert.equal(
    requestGuard(
      new Request("http://localhost:3000/api/chat", {
        method: "POST",
        headers: {
          host: "127.0.0.1:3000",
          origin: "http://127.0.0.1:3000",
          "content-type": "application/json",
        },
      }),
    ),
    null,
  );
  assert.equal(
    requestGuard(
      new Request("http://127.0.0.1:3000/api/chat", {
        method: "POST",
        headers: {
          host: "attacker.example",
          origin: "http://attacker.example",
          "content-type": "application/json",
        },
      }),
    )?.status,
    403,
  );
  assert.equal(
    requestGuard(
      new Request("http://127.0.0.1:3000/api/chat", {
        method: "POST",
        headers: {
          origin: "https://different.example",
          "content-type": "application/json",
        },
      }),
    )?.status,
    403,
  );
  assert.equal(
    requestGuard(
      new Request("http://127.0.0.1:3000/api/chat", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3000",
          "content-type": "application/json",
        },
      }),
    ),
    null,
  );
});
test("SSE parser handles comments, CRLF, split UTF-8 and multi-line data", async () => {
  const bytes = new TextEncoder().encode(
    ': heartbeat\r\n\r\ndata: {"text":"café"}\r\n\r\ndata: line one\ndata: line two\n\ndata: [DONE]\n\n',
  );
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const b of bytes) c.enqueue(new Uint8Array([b]));
      c.close();
    },
  });
  const data = [];
  for await (const value of readSse(stream)) data.push(value);
  assert.deepEqual(data, ['{"text":"café"}', "line one\nline two", "[DONE]"]);
});
test("SSE parser rejects a truncated final frame", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode('data: {"text":"unfinished"}'));
      c.close();
    },
  });
  await assert.rejects(async () => {
    for await (const data of readSse(stream)) void data;
  }, /Incomplete/);
});
