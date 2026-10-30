process.env.ZERNIO_MCP_MOCK = "false";
import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  prepareOperation,
  approveOperation,
  getOperation,
  operationContext,
} from "../src/lib/zen/operations";
import {
  ledgerTransaction,
  committedCents,
} from "../src/lib/zen/operation-store";
import { liveCallInsights } from "../src/lib/zen/telephony";
import { yesterdayWindow } from "../src/lib/zen/fixtures";
import { parseProviderText, safeOutput } from "../src/lib/zen/mcp-payload";
const signal = () => new AbortController().signal;
const schema = (
  name: string,
  properties: Record<string, unknown> = {},
  required: string[] = [],
) => ({
  name,
  title: name,
  description: "Provider operation.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  },
});
const tools = [
  schema("profiles_create", { name: { type: "string" } }, ["name"]),
  schema("profiles_list"),
  schema("phone_numbers_list_phone_number_countries"),
  schema(
    "phone_numbers_purchase_phone_number",
    {
      country: { type: "string" },
      profile_id: { type: "string" },
      number_type: { type: "string" },
      purchase_intent_id: { type: "string" },
      allow_multiple: { type: "boolean" },
      connect_whatsapp: { type: "boolean" },
    },
    ["profile_id"],
  ),
  schema("calls_list_calls", {
    direction: { type: "string" },
    before: { type: "string" },
    limit: { type: "integer" },
  }),
  schema("unpriced_paid_action"),
];
async function fake(
  t: TestContext,
  options: {
    price?: number;
    failWrite?: boolean;
    calls?: (args: Record<string, unknown>) => unknown;
  } = {},
) {
  const env = {
    key: process.env.ZERNIO_API_KEY,
    enabled: process.env.ZERNIO_ACCOUNT_MCP_ENABLED,
    dir: process.env.ZEN_STATE_DIR,
  };
  const dir = await mkdtemp(path.join(tmpdir(), "zen-actions-test-"));
  process.env.ZERNIO_API_KEY = "fake-operation-key";
  process.env.ZERNIO_ACCOUNT_MCP_ENABLED = "true";
  process.env.ZEN_STATE_DIR = dir;
  const before = globalThis.fetch;
  let writes = 0;
  globalThis.fetch = async (_url, init) => {
    if (init?.method === "GET") return new Response(null, { status: 405 });
    const b = JSON.parse(init?.body as string);
    if (b.method?.startsWith("notifications/"))
      return new Response(null, { status: 202 });
    let result: unknown;
    if (b.method === "initialize")
      result = {
        protocolVersion: b.params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: "fake", version: "1" },
      };
    else if (b.method === "tools/list") result = { tools };
    else if (b.params.name === "search_tools")
      result = { content: [{ type: "text", text: JSON.stringify(tools) }] };
    else {
      const { name, arguments: args } = b.params.arguments;
      let data: unknown;
      if (name === "phone_numbers_list_phone_number_countries")
        data = {
          countries: [
            {
              code: "US",
              types: [
                {
                  numberType: "local",
                  monthlyCents: options.price ?? 300,
                  inStock: true,
                  needsKyc: false,
                },
              ],
            },
          ],
        };
      else if (name === "calls_list_calls")
        data = options.calls?.(args) ?? { calls: [], nextCursor: null };
      else if (name === "profiles_list")
        data = "Found 1 profile(s):\n\n- Test (ID: profile-one)";
      else {
        writes++;
        if (options.failWrite)
          throw new TypeError("network interrupted after send");
        data = { accepted: true, id: "real-provider-result" };
      }
      result = {
        content: [
          {
            type: "text",
            text: typeof data === "string" ? data : JSON.stringify(data),
          },
        ],
      };
    }
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: b.id, result }), {
      headers: { "content-type": "application/json" },
    });
  };
  t.after(async () => {
    globalThis.fetch = before;
    for (const [k, v] of [
      ["ZERNIO_API_KEY", env.key],
      ["ZERNIO_ACCOUNT_MCP_ENABLED", env.enabled],
      ["ZEN_STATE_DIR", env.dir],
    ]) {
      if (v === undefined) delete process.env[k!];
      else process.env[k!] = v;
    }
    await rm(dir, { recursive: true, force: true });
  });
  return { dir, writes: () => writes };
}
test("Python literal decoding never evaluates code, and structured secrets are redacted", () => {
  assert.deepEqual(
    parseProviderText(
      "{'calls': [], 'nextCursor': None, 'ok': True, 'text': 'Don\\'t change None'}",
    ),
    { calls: [], nextCursor: null, ok: true, text: "Don't change None" },
  );
  const code = "{'x': __import__('os').system('anything')}";
  assert.equal(parseProviderText(code), code);
  assert.deepEqual(
    safeOutput({
      accessToken: "secret",
      nested: { password: "private" },
      id: "resource-id",
    }),
    {
      accessToken: "[redacted]",
      nested: { password: "[redacted]" },
      id: "resource-id",
    },
  );
});
test("a proposal does not execute; one durable approval executes exactly once and survives rereading", async (t) => {
  const f = await fake(t);
  const conversation = randomUUID();
  const card = await prepareOperation(
    conversation,
    "profiles_create",
    { name: "Test" },
    signal(),
  );
  assert.equal(card.kind, "mcp-operation");
  if (card.kind !== "mcp-operation") return;
  assert.equal(card.status, "pending");
  assert.equal(f.writes(), 0);
  const [a, b] = await Promise.all([
    approveOperation(card.operationId, conversation, false, signal()),
    approveOperation(card.operationId, conversation, false, signal()),
  ]);
  assert.equal(f.writes(), 1);
  assert.ok(
    a.kind === "mcp-operation" && ["running", "succeeded"].includes(a.status),
  );
  assert.ok(b.kind === "mcp-operation");
  const saved = await getOperation(card.operationId, conversation);
  assert.ok(saved.kind === "mcp-operation" && saved.status === "succeeded");
  assert.equal(
    (await operationContext([card.operationId], conversation)).length,
    1,
  );
  assert.equal(
    (await operationContext([card.operationId], randomUUID())).length,
    0,
  );
  await assert.rejects(
    approveOperation(card.operationId, randomUUID(), false, signal()),
  );
});
test("the $5 budget reserves atomically and cannot be bypassed by concurrent $3 purchases", async (t) => {
  const f = await fake(t);
  const id = randomUUID();
  const implicitAddon = await prepareOperation(
    id,
    "phone_numbers_purchase_phone_number",
    { country: "US", profile_id: "profile-one", number_type: "local" },
    signal(),
  );
  assert.ok(
    implicitAddon.kind === "mcp-operation" &&
      implicitAddon.status === "blocked",
  );
  const args = {
    country: "US",
    profile_id: "profile-one",
    number_type: "local",
    connect_whatsapp: false,
  };
  const a = await prepareOperation(
    id,
    "phone_numbers_purchase_phone_number",
    args,
    signal(),
  );
  const b = await prepareOperation(
    id,
    "phone_numbers_purchase_phone_number",
    args,
    signal(),
  );
  if (a.kind !== "mcp-operation" || b.kind !== "mcp-operation")
    return assert.fail();
  await assert.rejects(
    approveOperation(a.operationId, id, false, signal()),
    /recurring/,
  );
  const results = await Promise.allSettled([
    approveOperation(a.operationId, id, true, signal()),
    approveOperation(b.operationId, id, true, signal()),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(f.writes(), 1);
  assert.equal(await ledgerTransaction((l) => committedCents(l)), 300);
  const c = await prepareOperation(
    id,
    "phone_numbers_purchase_phone_number",
    args,
    signal(),
  );
  assert.ok(c.kind === "mcp-operation" && c.status === "blocked");
});
test("unpriced tools and over-budget country prices do not execute", async (t) => {
  const f = await fake(t, { price: 1300 });
  const id = randomUUID();
  const paid = await prepareOperation(
    id,
    "phone_numbers_purchase_phone_number",
    {
      country: "US",
      profile_id: "p",
      number_type: "local",
      connect_whatsapp: false,
    },
    signal(),
  );
  assert.ok(paid.kind === "mcp-operation" && paid.status === "blocked");
  const unknown = await prepareOperation(
    id,
    "unpriced_paid_action",
    {},
    signal(),
  );
  assert.ok(unknown.kind === "mcp-operation" && unknown.status === "blocked");
  if (unknown.kind === "mcp-operation")
    await approveOperation(unknown.operationId, id, false, signal());
  assert.equal(f.writes(), 0);
});
test("uncertain paid outcomes retain the reservation and are never retried by a repeated confirmation", async (t) => {
  const f = await fake(t, { failWrite: true });
  const id = randomUUID();
  const op = await prepareOperation(
    id,
    "phone_numbers_purchase_phone_number",
    {
      country: "US",
      profile_id: "p",
      number_type: "local",
      connect_whatsapp: false,
    },
    signal(),
  );
  if (op.kind !== "mcp-operation") return assert.fail();
  const result = await approveOperation(op.operationId, id, true, signal());
  assert.ok(result.kind === "mcp-operation" && result.status === "unknown");
  await approveOperation(op.operationId, id, true, signal());
  assert.equal(f.writes(), 1);
  assert.equal(await ledgerTransaction((l) => committedCents(l)), 300);
  const file = JSON.parse(
    await readFile(path.join(f.dir, "actions.json"), "utf8"),
  );
  assert.equal(file.operations[0].status, "unknown");
});
test("real history counts the complete explicit date window across cursor pages, without fixture rows", async (t) => {
  const w = yesterdayWindow();
  const at = new Date(Date.parse(w.since) + 3600000).toISOString();
  let pages = 0;
  await fake(t, {
    calls: () =>
      ++pages === 1
        ? {
            calls: [
              {
                id: "one",
                startedAt: at,
                direction: "outbound",
                status: "ended",
              },
            ],
            nextCursor: at,
          }
        : {
            calls: [
              {
                id: "one",
                startedAt: at,
                direction: "outbound",
                status: "ended",
              },
              {
                id: "two",
                startedAt: at,
                direction: "outbound",
                status: "failed",
              },
              {
                id: "outside",
                startedAt: new Date(Date.parse(w.since) - 1).toISOString(),
                direction: "outbound",
                status: "ended",
              },
            ],
            nextCursor: null,
          },
  });
  const result = await liveCallInsights(signal());
  assert.ok(
    result.kind === "live-calls" && result.total === 2 && result.pages === 2,
  );
  if (result.kind === "live-calls")
    assert.deepEqual(result.statuses, [
      { status: "ended", count: 1 },
      { status: "failed", count: 1 },
    ]);
});

test("30-day live counts include older calls, filter the exact boundaries and keep direction across pages", async (t) => {
  const now = new Date("2026-10-30T18:00:00Z");
  const since = "2026-09-30T17:00:00Z";
  const requests: Record<string, unknown>[] = [];
  const row = (id: string, at: string, direction = "outbound") => ({
    _id: id,
    startedAt: at,
    direction,
    status: "ended",
  });
  await fake(t, {
    calls: (args) => {
      requests.push(args);
      return requests.length === 1
        ? {
            calls: [
              row("too-new", now.toISOString()),
              row("recent", "2026-10-29T12:00:00Z"),
              row("incoming", "2026-10-20T12:00:00Z", "inbound"),
            ],
            nextCursor: "2026-10-20T12:00:00Z",
          }
        : {
            calls: [
              row("recent", "2026-10-29T12:00:00Z"),
              row("older", "2026-10-05T12:00:00Z"),
              row("at-start", since),
              row("too-old", "2026-09-30T16:59:59Z"),
            ],
            nextCursor: "2026-09-01T00:00:00Z",
          };
    },
  });
  const result = await liveCallInsights(
    signal(),
    "last_30_days",
    "outbound",
    now,
  );
  assert.ok(
    result.kind === "live-calls" && result.total === 3 && result.pages === 2,
  );
  if (result.kind !== "live-calls") return;
  assert.equal(result.period, "last_30_days");
  assert.equal(result.direction, "outbound");
  assert.equal(result.since, since);
  assert.equal(result.until, "2026-10-30T18:00:00Z");
  assert.ok(requests.every((request) => request.direction === "outbound"));
  assert.equal(requests[0].before, result.until);
  assert.equal(requests[1].before, "2026-10-20T12:00:00Z");
});

test("all-direction summaries omit the provider direction filter and count inbound and outbound records", async (t) => {
  let filter: unknown = "not-called";
  await fake(t, {
    calls: (args) => {
      filter = args.direction;
      return {
        calls: [
          {
            id: "in",
            startedAt: "2026-10-20T12:00:00Z",
            direction: "inbound",
            status: "ended",
          },
          {
            id: "out",
            startedAt: "2026-10-20T12:00:00Z",
            direction: "outbound",
            status: "failed",
          },
        ],
        nextCursor: null,
      };
    },
  });
  const result = await liveCallInsights(
    signal(),
    "last_30_days",
    "all",
    new Date("2026-10-30T18:00:00Z"),
  );
  assert.equal(filter, undefined);
  assert.ok(
    result.kind === "live-calls" &&
      result.total === 2 &&
      result.direction === "all",
  );
});

test("the live model adapter and card refresh endpoint both preserve a 30-day all-call request", async (t) => {
  await fake(t);
  const { executeLiveTool, liveToolDefinitions } =
    await import("../src/lib/zen/mcp-tools");
  const { POST } = await import("../src/app/api/zernio/route");
  const definition = liveToolDefinitions().find(
    (tool) => tool.function.name === "get_call_insights",
  );
  assert.ok(
    JSON.stringify(definition?.function.parameters).includes("last_30_days"),
  );
  const tool = await executeLiveTool(
    "get_call_insights",
    { period: "last_30_days", direction: "all" },
    signal(),
  );
  assert.ok(
    tool.artifact?.kind === "live-calls" &&
      tool.artifact.period === "last_30_days" &&
      tool.artifact.direction === "all",
  );
  const response = await POST(
    new Request("http://localhost:3000/api/zernio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        action: "calls",
        period: "last_30_days",
        direction: "all",
      }),
    }),
  );
  assert.equal(response.status, 200);
  const { artifact } = await response.json();
  assert.equal(artifact.period, "last_30_days");
  assert.equal(artifact.direction, "all");
  assert.equal(artifact.total, 0);
});
