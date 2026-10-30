import test from "node:test";
import assert from "node:assert/strict";
import { isMockMcp } from "../src/lib/zen/integration-mode";
import { mcpConfig, callMcp } from "../src/lib/zen/mcp";
import { withPreviewSession } from "../src/lib/zen/preview-session";
test("mock mode is the default even with a real key; Vercel cannot enable real MCP", async () => {
  const env = { ...process.env };
  const previous = globalThis.fetch;
  try {
    delete process.env.ZERNIO_MCP_MOCK;
    process.env.ZERNIO_API_KEY = "test-credential-must-not-be-forwarded";
    process.env.ZERNIO_ACCOUNT_MCP_ENABLED = "true";
    globalThis.fetch = async () => {
      throw new Error("Unexpected network");
    };
    assert.equal(isMockMcp(), true);
    await withPreviewSession(new Request("http://localhost"), async () => {
      assert.match(
        JSON.stringify(
          await callMcp("profiles_list", {}, new AbortController().signal),
        ),
        /Sample Default/,
      );
      return new Response();
    });
    process.env.ZERNIO_MCP_MOCK = "false";
    process.env.VERCEL = "1";
    assert.equal(isMockMcp(), true);
    await withPreviewSession(new Request("http://localhost"), async () => {
      assert.match(
        JSON.stringify(
          await callMcp("profiles_list", {}, new AbortController().signal),
        ),
        /Sample Default/,
      );
      return new Response();
    });
    delete process.env.VERCEL;
    assert.equal(isMockMcp(), false);
    delete process.env.ZERNIO_API_KEY;
    assert.equal(mcpConfig().account, false);
    await assert.rejects(
      callMcp("profiles_list", {}, new AbortController().signal),
    );
    process.env.ZERNIO_MCP_MOCK = "typo";
    assert.throws(isMockMcp);
  } finally {
    globalThis.fetch = previous;
    for (const k of Object.keys(process.env))
      if (!(k in env)) delete process.env[k];
    Object.assign(process.env, env);
  }
});
