import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { withPreviewSession } from "../src/lib/zen/preview-session";
import { callMcp } from "../src/lib/zen/mcp";
import { prepareOperation, approveOperation } from "../src/lib/zen/operations";
process.env.DEMO_SIGNING_SECRET = "test-only-preview-session-secret";
const signal = new AbortController().signal;
const request = (cookie = "") =>
  new Request("http://localhost/api/zernio", { headers: { cookie } });
test("mock tools and confirmed writes never use the network and are isolated by signed visitor session", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Unexpected network");
  };
  const conversation = randomUUID();
  let operation = "";
  try {
    const first = await withPreviewSession(request(), async () => {
      const before = await callMcp("profiles_list", {}, signal);
      assert.ok(JSON.stringify(before).includes("Sample Default"));
      const proposal = await prepareOperation(
        conversation,
        "profiles_create",
        { name: "Visitor A" },
        signal,
      );
      assert.equal(proposal.kind, "mcp-operation");
      if (proposal.kind !== "mcp-operation")
        throw new Error("Missing review card");
      operation = proposal.operationId;
      assert.ok(
        !JSON.stringify(await callMcp("profiles_list", {}, signal)).includes(
          "Visitor A",
        ),
      );
      assert.equal(
        (await approveOperation(operation, conversation, false, signal)).kind,
        "mcp-operation",
      );
      assert.ok(
        JSON.stringify(await callMcp("profiles_list", {}, signal)).includes(
          "Visitor A",
        ),
      );
      return new Response();
    });
    const cookie = first.headers.get("set-cookie")!.split(";")[0];
    await withPreviewSession(request(cookie), async () => {
      assert.ok(
        JSON.stringify(await callMcp("profiles_list", {}, signal)).includes(
          "Visitor A",
        ),
      );
      await assert.rejects(
        approveOperation(operation, randomUUID(), false, signal),
      );
      return new Response();
    });
    for (const value of ["", cookie + "forged"])
      await withPreviewSession(request(value), async () => {
        assert.ok(
          !JSON.stringify(await callMcp("profiles_list", {}, signal)).includes(
            "Visitor A",
          ),
        );
        await assert.rejects(
          approveOperation(operation, conversation, false, signal),
        );
        const catalog = await callMcp("catalog:list", {}, signal);
        assert.ok(catalog.structuredContent);
        return new Response();
      });
  } finally {
    globalThis.fetch = previous;
  }
});

import { POST as chatPost } from "../src/app/api/chat/route";
import { POST as operationPost } from "../src/app/api/zernio/route";
test("rejected browser origins receive no mock session cookie", async () => {
  for (const handler of [chatPost, operationPost]) {
    const response = await handler(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://unrelated.example",
        },
        body: "{}",
      }),
    );
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("set-cookie"), null);
  }
});
test("session capacity evicts old sample state rather than denying every new visitor", async () => {
  for (let i = 0; i < 105; i++) {
    const response = await withPreviewSession(
      request(),
      async () => new Response(),
    );
    assert.equal(response.status, 200);
  }
});
