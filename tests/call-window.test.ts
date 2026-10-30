process.env.DEMO_SIGNING_SECRET = "test-only-preview-signing-secret";
import test from "node:test";
import assert from "node:assert/strict";
import { callWindow, localCallRange } from "../src/lib/zen/call-window";
import { artifactSchema, callInsightsInput } from "../src/lib/zen/schema";

test("last-30-day and last-7-day windows end now and preserve local calendar time across DST", () => {
  const now = new Date("2026-10-30T18:00:00Z");
  assert.deepEqual(callWindow("last_30_days", now), {
    date: "2026-09-30",
    timeZone: "Europe/Madrid",
    since: "2026-09-30T17:00:00Z",
    until: "2026-10-30T18:00:00Z",
  });
  const local = localCallRange(callWindow("last_30_days", now));
  assert.equal((local.match(/19:00/g) || []).length, 2);
  assert.ok(local.endsWith("Europe/Madrid"));
  assert.equal(callWindow("last_7_days", now).since, "2026-10-23T17:00:00Z");
  const spring = callWindow("last_7_days", new Date("2026-03-30T12:00:00Z"));
  assert.equal(spring.since, "2026-03-23T13:00:00Z");
});

test("yesterday remains a complete previous local day; live summaries require an explicit supported period", () => {
  const window = callWindow("yesterday", new Date("2026-10-30T18:00:00Z"));
  assert.equal(window.since, "2026-10-28T23:00:00Z");
  assert.equal(window.until, "2026-10-29T23:00:00Z");
  assert.equal(
    callInsightsInput.parse({ period: "last_30_days" }).direction,
    "outbound",
  );
  for (const input of [
    {},
    { period: "last_year" },
    { period: "yesterday", direction: "unknown" },
  ])
    assert.equal(callInsightsInput.safeParse(input).success, false);
  const restored = artifactSchema.parse({
    kind: "live-calls",
    ...window,
    total: 0,
    statuses: [],
    pages: 1,
    fetchedAt: "2026-10-30T18:00:00Z",
  });
  assert.ok(
    restored.kind === "live-calls" &&
      restored.period === "yesterday" &&
      restored.direction === "outbound",
  );
});
