process.env.ZERNIO_MCP_MOCK = "false";
import test from "node:test";
import assert from "node:assert/strict";
import { agentCases } from "../evals/cases";
import { grade, writingChecks } from "../evals/score";
import { evaluationFetch, newTrace, fixtureReply } from "../evals/mock-mcp";
import { callWindow } from "../src/lib/zen/call-window";
import type { StreamEvent } from "../src/lib/zen/schema";
const entry = agentCases.find((item) => item.id === "calls-empty")!;
const now = new Date("2026-10-30T18:00:00Z");
const events = (period = "last_30_days"): StreamEvent[] => [
  {
    type: "text",
    text: "You made 0 outbound call attempts in the last 30 days.",
  },
  {
    type: "artifact",
    artifact: {
      kind: "live-calls",
      ...callWindow("last_30_days", now),
      period: period as "last_30_days",
      direction: "outbound",
      total: 0,
      statuses: [],
      pages: 1,
      fetchedAt: now.toISOString(),
    },
  },
];
test("the eval oracle rejects the original correct-zero / wrong-period card regression", () => {
  assert.equal(grade(entry, events(), newTrace()).passed, true);
  const wrong = grade(entry, events("yesterday"), newTrace());
  assert.equal(wrong.passed, false);
  assert.ok(
    wrong.checks.some(
      (check) => check.name === "correct-call-summary" && !check.passed,
    ),
  );
});
test("the eval oracle rejects failed reads described as zero and unapproved success claims", () => {
  const failure = agentCases.find((item) => item.id === "calls-unavailable")!;
  const trace = newTrace();
  trace.providerReads.push("calls_list_calls");
  assert.equal(grade(failure, events(), trace).passed, false);
  const proposal = agentCases.find(
    (item) => item.id === "chat-yes-is-not-approval",
  )!;
  assert.equal(
    grade(
      proposal,
      [{ type: "text", text: "I created the profile." }],
      newTrace(),
    ).passed,
    false,
  );
});
test("writing checks detect contractions and length while excluding code and URLs", () => {
  assert.equal(
    writingChecks("I cannot read this account.").noContractions,
    true,
  );
  assert.equal(
    writingChecks("I can't read this account.").noContractions,
    false,
  );
  assert.equal(
    writingChecks(Array(26).fill("word").join(" ") + ".").shortSentences,
    false,
  );
  assert.equal(
    writingChecks("1. " + Array(21).fill("word").join(" ") + ".")
      .shortSentences,
    false,
  );
  assert.equal(
    writingChecks(
      "```js\n" +
        Array(30).fill("word").join(" ") +
        "\n```\nRead the documentation.",
    ).shortSentences,
    true,
  );
});
test("evaluation network isolation never forwards Zernio writes or unknown destinations", async () => {
  const trace = newTrace();
  const destinations: string[] = [];
  const fetch = evaluationFetch(
    entry,
    trace,
    async (url) => {
      destinations.push(String(url));
      return new Response("model response");
    },
    now,
    { remaining: 2 },
  );
  await fetch("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    body: "{}",
  });
  await assert.rejects(
    fetch("https://untrusted.example/steal", { method: "POST", body: "{}" }),
  );
  const reply = await fetch("https://mcp.zernio.com/mcp", {
    method: "POST",
    body: JSON.stringify({
      id: 1,
      method: "tools/call",
      params: {
        name: "call_tool",
        arguments: {
          name: "profiles_create",
          arguments: { name: "Do not create" },
        },
      },
    }),
  });
  assert.equal((await reply.json()).result.isError, true);
  assert.deepEqual(destinations, ["https://openrouter.ai/api/alpha/decisions"]);
  assert.deepEqual(trace.writes, ["profiles_create"]);
  assert.equal(trace.forbiddenNetwork.length, 1);
});
test("versioned dataset has unique IDs and counterfactual call fixtures with older and inbound records", () => {
  assert.equal(agentCases.length, 30);
  assert.equal(
    new Set(agentCases.map((item) => item.id)).size,
    agentCases.length,
  );
  const fixture = fixtureReply(
    agentCases.find((item) => item.id === "calls-30-outbound")!,
    "calls_list_calls",
    { before: now.toISOString() },
    now,
  );
  const first = JSON.parse(fixture.content[0].text);
  assert.equal(first.calls.length, 4);
  assert.ok(
    first.calls.some(
      (row: { direction: string }) => row.direction === "inbound",
    ),
  );
  assert.ok(first.nextCursor);
});

test("sentence scoring preserves the punctuation after plain and parenthesized URLs", () => {
  const first = Array(14).fill("word").join(" ");
  const second = "Other " + Array(13).fill("other").join(" ");
  assert.equal(
    writingChecks(`${first} (https://docs.zernio.com/webhooks). ${second}.`)
      .shortSentences,
    true,
  );
  assert.equal(
    writingChecks(`${first} https://docs.zernio.com/webhooks. ${second}.`)
      .shortSentences,
    true,
  );
});
test("Spanish replies pass the multilingual cases without an English-only requirement", () => {
  const entry = agentCases.find(
    (item) => item.id === "scope-spanish-integration",
  )!;
  assert.equal(entry.replyLanguage, "es");
  assert.equal(
    grade(
      entry,
      [
        {
          type: "text",
          text: "Puede conectar su aplicación mediante la API de Zernio.",
        },
      ],
      newTrace(),
    ).passed,
    true,
  );
  const result = grade(
    entry,
    [{ type: "text", text: "You can connect to the Zernio API." }],
    newTrace(),
  );
  assert.ok(
    result.checks.some(
      (check) => check.name === "style-matches-user-language" && !check.passed,
    ),
  );
});
test("yesterday fixtures remain yesterday across the spring DST boundary near midnight", () => {
  const now = new Date("2026-03-29T22:30:00Z");
  const window = callWindow("yesterday", now);
  const fixture = fixtureReply(
    agentCases.find((item) => item.id === "calls-yesterday")!,
    "calls_list_calls",
    { before: window.until, direction: "outbound" },
    now,
  );
  const rows = JSON.parse(fixture.content[0].text).calls as {
    startedAt: string;
  }[];
  assert.equal(
    rows.filter(
      (row) => row.startedAt >= window.since && row.startedAt < window.until,
    ).length,
    2,
  );
});

test("empty-profile grounding accepts the truthful workspace qualifier but rejects invented nonzero profiles", () => {
  const entry = agentCases.find((item) => item.id === "profiles-empty")!;
  const artifact: StreamEvent = {
    type: "artifact",
    artifact: {
      kind: "account-read",
      resource: "profiles",
      rows: [],
      count: 0,
      truncated: false,
      fetchedAt: now.toISOString(),
    },
  };
  assert.equal(
    grade(
      entry,
      [
        {
          type: "text",
          text: "The live read returned no workspace profiles for this account. The list is empty.",
        },
        artifact,
      ],
      newTrace(),
    ).passed,
    true,
  );
  assert.equal(
    grade(
      entry,
      [{ type: "text", text: "You have 2 workspace profiles." }, artifact],
      newTrace(),
    ).passed,
    false,
  );
});
