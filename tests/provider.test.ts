process.env.ZERNIO_MCP_MOCK = "false";
import test from "node:test";
import assert from "node:assert/strict";
import { runOpenRouter } from "../src/lib/zen/openrouter";
import type { Message, StreamEvent } from "../src/lib/zen/schema";

const messages: Message[] = [
  {
    id: "sample-user",
    role: "user",
    text: "How many calls yesterday?",
    artifacts: [],
    sources: [],
  },
];
function sse(events: unknown[]) {
  return new Response(
    events
      .map((e) => `data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`)
      .join(""),
    { headers: { "content-type": "text/event-stream" } },
  );
}
test("provider loop validates a structured tool call and streams prose", async () => {
  const fetchBefore = globalThis.fetch;
  const keyBefore = process.env.OPENROUTER_API_KEY;
  const docsBefore = process.env.ZERNIO_DOCS_MCP_ENABLED;
  process.env.ZERNIO_DOCS_MCP_ENABLED = "false";
  process.env.OPENROUTER_API_KEY = "test-placeholder";
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.questions || body.stream === false)
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
    calls++;
    return calls === 1
      ? sse([
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "sample-tool",
                      function: {
                        name: "discover_capabilities",
                        arguments: '{"useCase":"voice',
                      },
                    },
                  ],
                },
              },
            ],
          },
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    { index: 0, function: { arguments: ' calls"}' } },
                  ],
                },
                finish_reason: "tool_calls",
              },
            ],
          },
          "[DONE]",
        ])
      : sse([
          {
            choices: [
              {
                delta: { content: "Here are the calculated sample calls." },
                finish_reason: "stop",
              },
            ],
          },
          "[DONE]",
        ]);
  };
  try {
    const events: StreamEvent[] = [];
    await runOpenRouter(
      messages,
      (e) => events.push(e),
      new AbortController().signal,
    );
    assert.equal(calls, 2);
    assert.ok(
      events.some(
        (e) => e.type === "artifact" && e.artifact.kind === "discovery",
      ),
    );
    assert.ok(
      events.some((e) => e.type === "text" && e.text.includes("calculated")),
    );
  } finally {
    globalThis.fetch = fetchBefore;
    if (docsBefore === undefined) delete process.env.ZERNIO_DOCS_MCP_ENABLED;
    else process.env.ZERNIO_DOCS_MCP_ENABLED = docsBefore;
    if (keyBefore === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = keyBefore;
  }
});
test("provider mid-stream errors are failures, not empty successes", async () => {
  const fetchBefore = globalThis.fetch;
  const keyBefore = process.env.OPENROUTER_API_KEY;
  const docsBefore = process.env.ZERNIO_DOCS_MCP_ENABLED;
  process.env.ZERNIO_DOCS_MCP_ENABLED = "false";
  process.env.OPENROUTER_API_KEY = "test-placeholder";
  globalThis.fetch = async (_url, init) =>
    JSON.parse(String(init?.body)).questions ||
    JSON.parse(String(init?.body)).stream === false
      ? Response.json({
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
        })
      : sse([{ error: { code: "server_error" }, choices: [] }]);
  try {
    await assert.rejects(
      runOpenRouter(messages, () => {}, new AbortController().signal),
      /interrupted/,
    );
  } finally {
    globalThis.fetch = fetchBefore;
    if (docsBefore === undefined) delete process.env.ZERNIO_DOCS_MCP_ENABLED;
    else process.env.ZERNIO_DOCS_MCP_ENABLED = docsBefore;
    if (keyBefore === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = keyBefore;
  }
});
