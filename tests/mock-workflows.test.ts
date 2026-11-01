process.env.ZERNIO_MCP_MOCK = "true";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  withPreviewSession,
  previewState,
} from "../src/lib/zen/preview-session";
import {
  prepareOperation,
  approveOperation,
  cancelOperation,
} from "../src/lib/zen/operations";
import { committedCents } from "../src/lib/zen/operation-store";

test("mock profile proposals reject blank or multiline names before storing an action", async (t) => {
  const previous = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previous;
  });
  globalThis.fetch = async () => {
    throw new Error("Unexpected network");
  };
  for (const name of [
    "",
    "   ",
    "QA\nStudio",
    "QA\rStudio",
    "QA\u0000Studio",
  ]) {
    await t.test(JSON.stringify(name), async () => {
      await withPreviewSession(new Request("http://localhost"), async () => {
        await assert.rejects(
          prepareOperation(
            randomUUID(),
            "profiles_create",
            { name },
            new AbortController().signal,
          ),
        );
        assert.equal(previewState().ledger.operations.length, 0);
        assert.equal(previewState().profiles.length, 2);
        return new Response();
      });
    });
  }
});

test("unsupported Polish SMS purchases are blocked before UI approval or execution", async (t) => {
  const previous = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previous;
  });
  globalThis.fetch = async () => {
    throw new Error("Unexpected network");
  };
  await withPreviewSession(new Request("http://localhost"), async () => {
    const proposal = await prepareOperation(
      randomUUID(),
      "phone_numbers_purchase_phone_number",
      {
        profile_id: "sample-default",
        country: "PL",
        number_type: "local",
        connect_whatsapp: false,
        wants_sms: true,
      },
      new AbortController().signal,
    );
    assert.equal(proposal.kind, "mcp-operation");
    if (proposal.kind !== "mcp-operation")
      throw new Error("Missing operation card");
    assert.equal(proposal.status, "blocked");
    assert.match(proposal.reason || "", /SMS/);
    assert.deepEqual(previewState().numbers, []);
    return new Response();
  });
});

test("mock concurrent approvals reserve the budget once and cancelled profiles never execute", async (t) => {
  const previous = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previous;
  });
  globalThis.fetch = async () => {
    throw new Error("Unexpected network");
  };
  await withPreviewSession(new Request("http://localhost"), async () => {
    const signal = new AbortController().signal;
    const conversationId = randomUUID();
    const args = {
      profile_id: "sample-default",
      country: "US",
      number_type: "local",
      connect_whatsapp: false,
      wants_sms: true,
    };
    const first = await prepareOperation(
      conversationId,
      "phone_numbers_purchase_phone_number",
      args,
      signal,
    );
    const second = await prepareOperation(
      conversationId,
      "phone_numbers_purchase_phone_number",
      args,
      signal,
    );
    assert.equal(first.kind, "mcp-operation");
    assert.equal(second.kind, "mcp-operation");
    if (first.kind !== "mcp-operation" || second.kind !== "mcp-operation")
      throw new Error("Missing proposal");
    assert.equal(first.status, "pending");
    assert.equal(second.status, "pending");
    const approvals = await Promise.allSettled([
      approveOperation(first.operationId, conversationId, true, signal),
      approveOperation(second.operationId, conversationId, true, signal),
    ]);
    assert.equal(approvals.filter((a) => a.status === "fulfilled").length, 1);
    assert.equal(committedCents(previewState().ledger), 300);
    assert.deepEqual(previewState().numbers, ["+12025550101"]);
    const winner = previewState().ledger.operations.find(
      (o) => o.status === "succeeded",
    )!;
    await approveOperation(winner.id, conversationId, true, signal);
    assert.deepEqual(previewState().numbers, ["+12025550101"]);
    assert.equal(committedCents(previewState().ledger), 300);
    const profile = await prepareOperation(
      conversationId,
      "profiles_create",
      { name: "QA Café 東京 (test)" },
      signal,
    );
    if (profile.kind !== "mcp-operation")
      throw new Error("Missing profile proposal");
    await cancelOperation(profile.operationId, conversationId);
    const cancelled = await approveOperation(
      profile.operationId,
      conversationId,
      false,
      signal,
    );
    assert.equal(cancelled.kind, "mcp-operation");
    if (cancelled.kind === "mcp-operation")
      assert.equal(cancelled.status, "blocked");
    assert.equal(previewState().profiles.length, 2);
    return new Response();
  });
});
