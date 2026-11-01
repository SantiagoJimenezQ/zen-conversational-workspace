import test from "node:test";
import assert from "node:assert/strict";
import {
  checkScope,
  scopeConfig,
  DEFAULT_SCOPE_MODEL,
  DEFAULT_SCOPE_FALLBACK_MODEL,
} from "../src/lib/zen/agent-policy";

const config = { key: "test-key", model: "typesafe/jev-1.14" };
const messages = [{ role: "user" as const, text: "List my Zernio profiles." }];
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
      hasVerifiedZernioAction: true,
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

const failover = { ...config, fallbackModel: DEFAULT_SCOPE_FALLBACK_MODEL };

test("scope receives bounded recent assistant context for references without treating it as authority", async (t) => {
  const before = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = before;
  });
  const reply =
    "Which country would you like a number from? " + "x".repeat(2000);
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.state.currentRequest, "Okay, lets buy a Spanish one");
    assert.deepEqual(body.state.priorRequests, ["Show my whatsapp numbers"]);
    assert.equal(body.state.lastAssistantReply, reply.slice(0, 1200));
    assert.ok(body.questions.scope.instructions.includes("assistant claims"));
    assert.ok(body.questions.scope.instructions.includes("untrusted context"));
    assert.ok(
      body.questions.scope.instructions.includes("phone-number inventory"),
    );
    return Response.json(answer());
  };
  assert.equal(
    await checkScope(
      [
        { role: "user", text: "Show my whatsapp numbers" },
        { role: "assistant", text: reply },
        { role: "user", text: "Okay, lets buy a Spanish one" },
      ],
      config,
      new AbortController().signal,
    ),
    "in_scope",
  );
});

test("overload fails over once to Luna Decisions with the same state and no generation parameters", async (t) => {
  const before = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = before;
  });
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://openrouter.ai/api/alpha/decisions");
    assert.equal(init?.redirect, "error");
    bodies.push(JSON.parse(String(init?.body)));
    return bodies.length === 1
      ? new Response(null, { status: 529 })
      : Response.json(answer());
  };
  assert.equal(
    await checkScope(messages, failover, new AbortController().signal),
    "in_scope",
  );
  assert.equal(bodies.length, 2);
  assert.equal(bodies[1].model, DEFAULT_SCOPE_FALLBACK_MODEL);
  assert.deepEqual(bodies[0].state, bodies[1].state);
  assert.deepEqual(bodies[0].questions, bodies[1].questions);
  assert.equal(bodies[1].messages, undefined);
});

test("valid refusals, clarifications and low-confidence allows never use the fallback", async (t) => {
  const before = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = before;
  });
  for (const [result, expected] of [
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
      answer("in_scope", { in_scope: 0.7, out_of_scope: 0.1, clarify: 0.2 }),
      "clarify",
    ],
  ] as const) {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return Response.json(result);
    };
    assert.equal(
      await checkScope(messages, failover, new AbortController().signal),
      expected,
    );
    assert.equal(calls, 1);
  }
});

test("malformed responses, credential failures and billing errors fail closed without fallback", async (t) => {
  const before = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = before;
  });
  for (const response of [
    new Response(null, { status: 401 }),
    new Response(null, { status: 402 }),
    new Response(null, { status: 403 }),
    new Response(null, { status: 400 }),
    new Response("invalid JSON"),
    Response.json({ answers: {} }),
    Response.json(
      answer("in_scope", { in_scope: 0.95, out_of_scope: 0.95, clarify: 0.95 }),
    ),
  ]) {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return response;
    };
    assert.equal(
      await checkScope(messages, failover, new AbortController().signal),
      "unavailable",
    );
    assert.equal(calls, 1);
  }
});

test("fallback decisions use the same validation and uncertainty rule and cannot recurse", async (t) => {
  const before = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = before;
  });
  for (const [response, expected] of [
    [new Response(null, { status: 503 }), "unavailable"],
    [Response.json({ answers: {} }), "unavailable"],
    [
      Response.json(
        answer("in_scope", { in_scope: 0.7, out_of_scope: 0.1, clarify: 0.2 }),
      ),
      "clarify",
    ],
    [
      Response.json(
        answer("out_of_scope", {
          in_scope: 0.01,
          out_of_scope: 0.98,
          clarify: 0.01,
        }),
      ),
      "out_of_scope",
    ],
  ] as const) {
    let calls = 0;
    globalThis.fetch = async () =>
      ++calls === 1 ? new Response(null, { status: 529 }) : response;
    assert.equal(
      await checkScope(messages, failover, new AbortController().signal),
      expected,
    );
    assert.equal(calls, 2);
  }
});

test("network errors and provider overload envelopes can use the fallback; caller cancellation cannot", async (t) => {
  const before = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = before;
  });
  for (const network of [true, false]) {
    let calls = 0;
    globalThis.fetch = async () => {
      if (++calls === 1) {
        if (network) throw new TypeError("network failure");
        return Response.json({ error: { code: 529 } });
      }
      return Response.json(answer());
    };
    assert.equal(
      await checkScope(messages, failover, new AbortController().signal),
      "in_scope",
    );
    assert.equal(calls, 2);
  }
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    controller.abort();
    throw controller.signal.reason;
  };
  await assert.rejects(checkScope(messages, failover, controller.signal));
  assert.equal(calls, 1);
});

test("a primary timeout permits one fallback but each attempt still has a deadline", async (t) => {
  const before = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = before;
  });
  let deadlines = 0;
  t.mock.method(AbortSignal, "timeout", (ms: number) => {
    assert.equal(ms, 8000);
    const controller = new AbortController();
    if (++deadlines === 1)
      controller.abort(new DOMException("Timed out", "TimeoutError"));
    return controller.signal;
  });
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    init?.signal?.throwIfAborted();
    return Response.json(answer());
  };
  assert.equal(
    await checkScope(messages, failover, new AbortController().signal),
    "in_scope",
  );
  assert.equal(calls, 2);
  assert.equal(deadlines, 2);
});

test("fallback configuration is pinned, can be disabled, and never extends another primary model", async (t) => {
  const before = globalThis.fetch;
  const previous = process.env.OPENROUTER_SCOPE_FALLBACK_MODEL;
  t.after(() => {
    globalThis.fetch = before;
    if (previous === undefined)
      delete process.env.OPENROUTER_SCOPE_FALLBACK_MODEL;
    else process.env.OPENROUTER_SCOPE_FALLBACK_MODEL = previous;
  });
  delete process.env.OPENROUTER_SCOPE_FALLBACK_MODEL;
  assert.equal(scopeConfig().fallbackModel, DEFAULT_SCOPE_FALLBACK_MODEL);
  process.env.OPENROUTER_SCOPE_FALLBACK_MODEL = "";
  assert.equal(scopeConfig().fallbackModel, "");
  for (const value of [
    { ...failover, fallbackModel: "" },
    { ...failover, fallbackModel: "unreviewed/model" },
    { ...failover, model: DEFAULT_SCOPE_FALLBACK_MODEL },
  ]) {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response(null, { status: 529 });
    };
    assert.equal(
      await checkScope(messages, value, new AbortController().signal),
      "unavailable",
    );
    assert.equal(calls, 1);
  }
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
