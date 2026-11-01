process.env.ZERNIO_MCP_MOCK = "true";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { POST } from "../src/app/api/chat/route";
import {
  previewState,
  withPreviewSession,
} from "../src/lib/zen/preview-session";
import { executeLiveTool } from "../src/lib/zen/mcp-tools";
import { invokeCatalogTool } from "../src/lib/zen/mcp-catalog";
import { providerPayload } from "../src/lib/zen/mcp-payload";

test("Polish sample number search, review and explicit confirmation work through the deployed operation route without network access", async (t) => {
  const previous = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previous;
  });
  globalThis.fetch = async () => {
    throw new Error("Unexpected network");
  };
  let cookie = "";
  async function post(body: unknown, session = cookie) {
    const response = await POST(
      new Request("http://localhost/api/chat?operation=1", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          cookie: session,
        },
        body: JSON.stringify(body),
      }),
    );
    if (session === cookie)
      cookie = response.headers.get("set-cookie")?.split(";")[0] || cookie;
    return { status: response.status, data: await response.json() };
  }
  const conversationId = randomUUID();
  const search = await post({
    action: "phone-search",
    country: "Poland",
    capability: "voice",
  });
  assert.equal(search.status, 200);
  assert.equal(search.data.artifact.country, "PL");
  assert.equal(search.data.artifact.monthlyCents, 400);
  assert.ok(search.data.artifact.numbers.length > 0);
  assert.ok(
    search.data.artifact.numbers.every((number: string) =>
      number.startsWith("+48"),
    ),
  );
  const phoneNumber = search.data.artifact.numbers[0];
  const review = await post({
    action: "phone-review",
    conversationId,
    country: "PL",
    capability: "voice",
    numberType: "local",
    phoneNumber,
  });
  assert.equal(review.status, 200);
  assert.equal(review.data.artifact.status, "pending");
  assert.equal(review.data.artifact.costCents, 400);
  const args = JSON.parse(review.data.artifact.argsJson);
  assert.equal(args.profile_id, "sample-default");
  assert.equal(args.country, "PL");
  assert.equal(args.phone_number, phoneNumber);
  const confirmation = {
    action: "confirm",
    conversationId,
    id: review.data.artifact.operationId,
    confirmed: true,
    approveRecurring: true,
  };
  assert.equal(
    (await post({ ...confirmation, approveRecurring: false })).status,
    400,
  );
  assert.equal((await post({ ...confirmation, confirmed: false })).status, 400);
  assert.equal(
    (await post({ ...confirmation, conversationId: randomUUID() })).status,
    400,
  );
  assert.equal((await post(confirmation, "")).status, 400);
  const completed = await post(confirmation);
  assert.equal(completed.status, 200);
  assert.equal(completed.data.artifact.status, "succeeded");
  assert.match(completed.data.artifact.output, /Simulated purchase only/);
  assert.equal((await post(confirmation)).data.artifact.status, "succeeded");
  await withPreviewSession(
    new Request("http://localhost", { headers: { cookie } }),
    async () => {
      assert.deepEqual(previewState().numbers, [phoneNumber]);
      return new Response();
    },
  );
  const refreshed = await post({
    action: "status",
    conversationId,
    id: confirmation.id,
  });
  assert.equal(refreshed.data.artifact.status, "succeeded");
});

test("mock inventory respects country and capability, and model tools describe sample provenance honestly", async (t) => {
  const previous = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previous;
  });
  globalThis.fetch = async () => {
    throw new Error("Unexpected network");
  };
  await withPreviewSession(new Request("http://localhost"), async () => {
    const signal = new AbortController().signal;
    const pl = await executeLiveTool(
      "prepare_phone_setup",
      { country: "PL", capability: "voice" },
      signal,
      randomUUID(),
    );
    assert.equal(pl.artifact?.kind, "live-phone");
    assert.match(pl.explanation || "", /Sample/);
    const sms = await executeLiveTool(
      "prepare_phone_setup",
      { country: "PL", capability: "both" },
      signal,
    );
    assert.ok(sms.error);
    assert.equal(sms.artifact, undefined);
    const unsupported = await executeLiveTool(
      "prepare_phone_setup",
      { country: "ZZ", capability: "voice" },
      signal,
    );
    assert.ok(unsupported.error);
    assert.equal(unsupported.artifact, undefined);
    const us = await executeLiveTool(
      "prepare_phone_setup",
      { country: "US", capability: "both" },
      signal,
    );
    assert.equal(us.artifact?.kind, "live-phone");
    if (us.artifact?.kind === "live-phone")
      assert.deepEqual(us.artifact.numbers, ["+12025550101"]);
    const invalidInventory = providerPayload(
      await invokeCatalogTool(
        "phone_numbers_search_available_phone_numbers",
        { country: "ZZ", number_type: "local" },
        signal,
      ),
    );
    assert.deepEqual(invalidInventory, { numbers: [] });
    const profiles = await executeLiveTool(
      "get_workspace_profiles",
      {},
      signal,
    );
    assert.match(profiles.explanation || "", /sample workspace snapshot/);
    assert.equal(profiles.artifact?.kind, "account-read");
    const docs = await executeLiveTool(
      "search_documentation",
      { query: "voice setup" },
      signal,
    );
    assert.match(JSON.stringify(docs.data), /synthetic documentation/);
    return new Response();
  });
});
