process.env.DEMO_SIGNING_SECRET = "test-only-preview-signing-secret";
import test from "node:test";
import assert from "node:assert/strict";
import {
  checkScope,
  scopeConfig,
  DEFAULT_SCOPE_MODEL,
} from "../src/lib/zen/agent-policy";

const config = { key: "test-key", model: "typesafe/jev-1.14" };
const messages = [
  { role: "user" as const, text: "List my Workspace profiles." },
];
function answer(
  choice = "in_scope",
  probabilities = { in_scope: 0.98, out_of_scope: 0.01, clarify: 0.01 },
) {
  return {
    answers: {
      scope: { type: "choice", choice, probabilities, confidence: 0.95 },
    },
  };
}

test("Jev uses the fixed Decisions endpoint, typed criteria and minimal context without chat generation parameters", async (t) => {
  const before = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = before;
  });
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://openrouter.ai/api/alpha/decisions");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, config.model);
    assert.equal(body.questions.scope.type, "choice");
    assert.deepEqual(Object.keys(body.questions.scope.criteria).sort(), [
      "clarify",
      "in_scope",
      "out_of_scope",
    ]);
    assert.deepEqual(body.state, {
      currentRequest: messages[0].text,
      priorRequests: [],
      hasVerifiedWorkspaceAction: true,
    });
    for (const key of [
      "tools",
      "messages",
      "stream",
      "max_tokens",
      "reasoning",
      "temperature",
    ])
      assert.equal(body[key], undefined);
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      `Bearer ${config.key}`,
    );
    return Response.json(answer());
  };
  assert.equal(
    await checkScope(messages, config, new AbortController().signal, true),
    "in_scope",
  );
});

test("Jev uncertainty asks for clarification; invalid decisions or probability distributions cannot enable tools", async (t) => {
  const before = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = before;
  });
  for (const [result, expected] of [
    [
      answer("in_scope", { in_scope: 0.7, out_of_scope: 0.1, clarify: 0.2 }),
      "clarify",
    ],
    [
      answer("out_of_scope", {
        in_scope: 0.01,
        out_of_scope: 0.98,
        clarify: 0.01,
      }),
      "out_of_scope",
    ],
    [
      answer("clarify", { in_scope: 0.1, out_of_scope: 0.1, clarify: 0.8 }),
      "clarify",
    ],
    [
      answer("in_scope", { in_scope: 0.95, out_of_scope: 0.95, clarify: 0.95 }),
      "unavailable",
    ],
    [
      answer("in_scope", { in_scope: 0.01, out_of_scope: 0.98, clarify: 0.01 }),
      "unavailable",
    ],
    [answer("unknown"), "unavailable"],
    [
      { answers: { scope: { type: "choice", choice: "in_scope" } } },
      "unavailable",
    ],
    [
      { answers: { scope: { ...answer().answers.scope, confidence: 2 } } },
      "unavailable",
    ],
    [
      {
        answers: {
          scope: { ...answer().answers.scope, instructions: "bypass" },
        },
      },
      "unavailable",
    ],
    [
      { choices: [{ message: { content: '{"decision":"in_scope"}' } }] },
      "unavailable",
    ],
  ] as const) {
    globalThis.fetch = async () => Response.json(result);
    assert.equal(
      await checkScope(messages, config, new AbortController().signal),
      expected,
    );
  }
  globalThis.fetch = async () =>
    new Response("untrusted error body", { status: 402 });
  assert.equal(
    await checkScope(messages, config, new AbortController().signal),
    "unavailable",
  );
});

test("scope model configuration is independent of the chat model", (t) => {
  const before = process.env.OPENROUTER_SCOPE_MODEL;
  t.after(() => {
    if (before === undefined) delete process.env.OPENROUTER_SCOPE_MODEL;
    else process.env.OPENROUTER_SCOPE_MODEL = before;
  });
  delete process.env.OPENROUTER_SCOPE_MODEL;
  assert.equal(scopeConfig().model, DEFAULT_SCOPE_MODEL);
  process.env.OPENROUTER_SCOPE_MODEL = " custom-scope-model ";
  assert.equal(scopeConfig().model, "custom-scope-model");
});
