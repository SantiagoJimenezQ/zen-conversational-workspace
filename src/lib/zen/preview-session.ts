import "server-only";
import { isMockMcp } from "./integration-mode";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { demoSigningKey } from "./signing-key";
import type { Ledger } from "./operation-store";
export type PreviewState = {
  id: string;
  at: number;
  ledger: Ledger;
  queue: Promise<void>;
  profiles: { id: string; name: string }[];
  numbers: string[];
};
const context = new AsyncLocalStorage<PreviewState>();
const states = new Map<string, PreviewState>();
function signature(id: string) {
  return createHmac("sha256", demoSigningKey).update(id).digest("hex");
}
export function previewState() {
  const state = context.getStore();
  if (!state) throw new Error("A simulation session is required.");
  return state;
}
export async function withPreviewSession(
  request: Request,
  run: () => Promise<Response>,
) {
  if (!isMockMcp()) return run();
  const token =
    request.headers
      .get("cookie")
      ?.match(/(?:^|;\s*)zen_preview=([^;]+)/)?.[1] || "";
  let id = randomUUID() as string;
  const [candidate, sig] = token.split(".");
  if (
    /^[0-9a-f-]{36}$/.test(candidate || "") &&
    /^[0-9a-f]{64}$/.test(sig || "")
  ) {
    const expected = signature(candidate);
    if (timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
      id = candidate;
  }
  for (const [key, state] of states)
    if (Date.now() - state.at > 3600000) states.delete(key);
  if (!states.has(id) && states.size >= 100) {
    const oldest = states.keys().next().value;
    if (oldest) states.delete(oldest);
  }
  const state = states.get(id) || {
    id,
    at: Date.now(),
    ledger: { version: 1, limitCents: 500, operations: [] },
    queue: Promise.resolve(),
    profiles: [
      { id: "sample-default", name: "Sample Default" },
      { id: "sample-studio", name: "Sample Studio" },
    ],
    numbers: [],
  };
  state.at = Date.now();
  states.delete(id);
  states.set(id, state);
  const response = await context.run(state, run);
  response.headers.append(
    "Set-Cookie",
    `zen_preview=${id}.${signature(id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600${process.env.VERCEL === "1" ? "; Secure" : ""}`,
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
