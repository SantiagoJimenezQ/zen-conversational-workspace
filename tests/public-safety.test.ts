import test from "node:test";
import assert from "node:assert/strict";
import { validPreviewBudget, assertPreviewBudget } from "../src/lib/zen/budget";
import { admitPreview } from "../src/lib/zen/admission";
import { requestGuard } from "../src/lib/zen/http";

const capped = {
  limit: 10,
  limit_reset: null,
  limit_remaining: 10,
  include_byok_in_limit: true,
  is_management_key: false,
};
test("public AI requires an unexpired lifetime cap of at most ten dollars", () => {
  assert.equal(validPreviewBudget({ data: capped }), true);
  for (const change of [
    { limit: null },
    { limit: 11 },
    { limit: 0 },
    { limit_reset: "monthly" },
    { limit_remaining: 0 },
    { include_byok_in_limit: false },
    { is_management_key: true },
  ])
    assert.equal(validPreviewBudget({ data: { ...capped, ...change } }), false);
  assert.equal(validPreviewBudget({}), false);
});
test("unverifiable key policy fails closed before any model request", async () => {
  const before = globalThis.fetch;
  const key = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-placeholder";
  try {
    globalThis.fetch = async () =>
      Response.json({ data: { ...capped, limit: null } });
    await assert.rejects(assertPreviewBudget(new AbortController().signal));
    globalThis.fetch = async () => new Response(null, { status: 503 });
    await assert.rejects(assertPreviewBudget(new AbortController().signal));
    globalThis.fetch = async () => Response.json({ data: capped });
    await assert.doesNotReject(
      assertPreviewBudget(new AbortController().signal),
    );
  } finally {
    globalThis.fetch = before;
    if (key === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = key;
  }
});
test("instance admission bounds concurrency and repeated requests", () => {
  const request = (ip: string) =>
    new Request("https://demo.example/api/chat", {
      headers: { "x-vercel-forwarded-for": ip },
    });
  const first = admitPreview(request("192.0.2.1"), 1000);
  const second = admitPreview(request("192.0.2.2"), 1000);
  assert.ok(!(first instanceof Response) && !(second instanceof Response));
  assert.equal(
    (admitPreview(request("192.0.2.3"), 1000) as Response).status,
    429,
  );
  first.release();
  first.release();
  second.release();
  for (let i = 0; i < 5; i++) {
    const admission = admitPreview(request("192.0.2.4"), 1000);
    assert.ok(!(admission instanceof Response));
    admission.release();
  }
  assert.equal(
    (admitPreview(request("192.0.2.4"), 1000) as Response).status,
    429,
  );
  const next = admitPreview(request("192.0.2.4"), 61000);
  assert.ok(!(next instanceof Response));
  next.release();
});
test("production POSTs require an explicit same-site origin", () => {
  const prior = {
    VERCEL: process.env.VERCEL,
    PUBLIC_APP_ORIGIN: process.env.PUBLIC_APP_ORIGIN,
  };
  process.env.VERCEL = "1";
  process.env.PUBLIC_APP_ORIGIN = "https://demo.example";
  const check = (origin?: string, host = "demo.example") =>
    requestGuard(
      new Request("https://demo.example/api/chat", {
        method: "POST",
        headers: {
          host,
          "content-type": "application/json",
          ...(origin ? { origin } : {}),
        },
      }),
    );
  try {
    assert.equal(check("https://demo.example"), null);
    assert.equal(check()?.status, 403);
    assert.equal(check("https://evil.example")?.status, 403);
    assert.equal(check("https://demo.example", "evil.example")?.status, 403);
  } finally {
    for (const [name, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
