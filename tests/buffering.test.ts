process.env.ZERNIO_MCP_MOCK = "false";
import test from "node:test";
import assert from "node:assert/strict";
import {
  createDeferredWriter,
  createTextBuffer,
} from "../src/lib/zen/buffering";

test("stream chunks batch without losing text, and stop flushes once", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const rendered: string[] = [];
  const buffer = createTextBuffer((text) => rendered.push(text));
  for (let i = 0; i < 100; i++) buffer.push("a");
  assert.equal(rendered.length, 0);
  t.mock.timers.tick(50);
  assert.deepEqual(rendered, ["a".repeat(100)]);
  buffer.push("final partial text");
  buffer.flush();
  buffer.flush();
  t.mock.timers.tick(500);
  assert.deepEqual(rendered, ["a".repeat(100), "final partial text"]);
});
test("persistence serializes only the latest snapshot after the idle delay", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const writes: string[] = [];
  const writer = createDeferredWriter((v: { text: string }) =>
    writes.push(JSON.stringify(v)),
  );
  for (let i = 0; i < 100; i++) writer.schedule({ text: `version-${i}` });
  assert.equal(writes.length, 0);
  t.mock.timers.tick(349);
  assert.equal(writes.length, 0);
  t.mock.timers.tick(1);
  assert.deepEqual(writes, ['{"text":"version-99"}']);
  t.mock.timers.tick(2000);
  assert.equal(writes.length, 1);
});
test("continuous streams checkpoint and completion, stop or pagehide flush without a stale later write", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const writes: string[] = [];
  const writer = createDeferredWriter((value: string) => writes.push(value));
  for (let i = 0; i < 15; i++) {
    writer.schedule(`partial-${i}`);
    t.mock.timers.tick(100);
  }
  assert.deepEqual(writes, ["partial-14"]);
  writer.schedule("stopped");
  writer.flush();
  writer.schedule("complete");
  writer.flush();
  writer.flush();
  t.mock.timers.tick(2000);
  assert.deepEqual(writes, ["partial-14", "stopped", "complete"]);
});
