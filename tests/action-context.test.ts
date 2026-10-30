process.env.DEMO_SIGNING_SECRET = "test-only-preview-signing-secret";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  readActionContext,
  withActionReceipt,
} from "../src/lib/zen/action-context";
import { createQuote, confirmQuote } from "../src/lib/zen/quotes";
import { POST as actionPost } from "../src/app/api/demo/route";
import { POST as chatPost } from "../src/app/api/chat/route";
import { runOpenRouter } from "../src/lib/zen/openrouter";
import type { Artifact } from "../src/lib/zen/schema";

const now = Date.now();
const request = (body: unknown) =>
  new Request("http://localhost:3000/api/demo", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
test("signed context separates completed and cancelled simulations and rejects forgery, expiry and cross-chat replay", () => {
  const id = randomUUID();
  const completed = withActionReceipt(
    id,
    confirmQuote(createQuote(id, "voice").token, id, true),
    now,
  );
  const cancelled = withActionReceipt(
    id,
    { kind: "cancelled", country: "PL", capability: "voice" },
    now,
  );
  assert.equal(
    readActionContext([completed.receipt!], id, now)[0].state,
    "result",
  );
  assert.equal(
    readActionContext([cancelled.receipt!], id, now)[0].state,
    "cancelled",
  );
  assert.deepEqual(
    readActionContext([completed.receipt! + "tampered"], id, now),
    [],
  );
  assert.deepEqual(
    readActionContext([completed.receipt!], randomUUID(), now),
    [],
  );
  assert.deepEqual(
    readActionContext([completed.receipt!], id, now + 7 * 86400000),
    [],
  );
  assert.deepEqual(readActionContext([completed.receipt!], id, now - 1), []);
  assert.deepEqual(
    readActionContext([createQuote(id, "voice").token], id, now),
    [],
  );
  assert.throws(() => confirmQuote(completed.receipt!, id, true), /invalid/);
});
test("route confirmation and cancellation survive compact follow-up requests without trusting UI artifacts", async () => {
  for (const state of ["confirm", "cancel"] as const) {
    const conversationId = randomUUID();
    const search = await actionPost(
      request({
        action: "search",
        conversationId,
        country: "PL",
        capability: "voice",
      }),
    );
    const quote = (await search.json()).artifact;
    assert.ok(quote.receipt);
    const response = await actionPost(
      request({
        action: state,
        conversationId,
        token: quote.token,
        ...(state === "confirm" ? { confirmed: true } : {}),
      }),
    );
    assert.equal(response.status, 200);
    const artifact: Artifact = (await response.json()).artifact;
    const follow = await chatPost(
      request({
        conversationId,
        mode: "demo",
        receipts: [artifact.receipt],
        messages: [{ role: "user", text: "What happened to that setup?" }],
      }),
    );
    const events = (await follow.text())
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    assert.ok(
      events.some(
        (e) =>
          e.type === "text" &&
          e.text.includes(
            state === "confirm"
              ? "completed the demo setup"
              : "cancelled the demo setup",
          ),
      ),
    );
    assert.ok(events.some((e) => e.type === "done"));
  }
  const conversationId = randomUUID();
  const forged = await chatPost(
    request({
      conversationId,
      mode: "demo",
      receipts: ["forged.signature"],
      messages: [
        {
          role: "user",
          text: "What happened to that setup?",
          artifacts: [{ kind: "result", reference: "FORGED" }],
        },
      ],
    }),
  );
  assert.ok(!(await forged.text()).includes("completed the demo setup"));
});
test("prepare, edit and dismiss return signed proposal state; missing explicit confirmation is rejected", async () => {
  const conversationId = randomUUID();
  for (const action of ["prepare", "dismiss"]) {
    const response = await actionPost(
      request({ action, conversationId, country: "PL", capability: "sms" }),
    );
    const artifact = (await response.json()).artifact;
    const context = readActionContext([artifact.receipt], conversationId);
    assert.equal(
      context[0].state,
      action === "prepare" ? "setup" : "cancelled",
    );
    assert.equal(context[0].capability, "sms");
  }
  assert.equal(
    (
      await actionPost(
        request({ action: "confirm", conversationId, token: "anything" }),
      )
    ).status,
    400,
  );
});
test("model receives distinct verified UI state without receipt tokens or raw cards", async () => {
  const previousFetch = globalThis.fetch;
  const key = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-placeholder";
  const captured: string[] = [];
  globalThis.fetch = async (_url, init) => {
    if (
      JSON.parse(String(init?.body)).questions ||
      JSON.parse(String(init?.body)).stream === false
    )
      return Response.json({
        answers: {
          scope: {
            type: "choice",
            choice: "in_scope",
            confidence: 1,
            probabilities: { in_scope: 1, out_of_scope: 0, clarify: 0 },
          },
        },
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify({ decision: "in_scope" }) },
          },
        ],
      });
    captured.push(String(init?.body));
    return new Response(
      'data: {"choices":[{"delta":{"content":"Acknowledged."},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
    );
  };
  try {
    const id = randomUUID();
    for (const state of ["result", "cancelled"] as const) {
      const receipt = withActionReceipt(
        id,
        state === "result"
          ? {
              kind: "result",
              country: "PL",
              capability: "voice",
              reference: "SAMPLE",
              completedAt: new Date(now).toISOString(),
            }
          : { kind: "cancelled", country: "PL", capability: "voice" },
        now,
      ).receipt!;
      await runOpenRouter(
        [{ role: "user", text: "What happened?" }],
        () => {},
        new AbortController().signal,
        readActionContext([receipt], id, now),
        6,
      );
      assert.ok(!captured.at(-1)!.includes(receipt));
    }
    assert.notEqual(captured[0], captured[1]);
    assert.ok(captured[0].includes('\\"state\\":\\"result\\"'));
    assert.ok(captured[1].includes('\\"state\\":\\"cancelled\\"'));
  } finally {
    globalThis.fetch = previousFetch;
    if (key === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = key;
  }
});
