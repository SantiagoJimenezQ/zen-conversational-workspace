import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Artifact } from "./schema";

import { demoSigningKey } from "./signing-key";
const eventSchema = z
  .object({
    conversationId: z.string().uuid(),
    state: z.enum(["setup", "quote", "result", "cancelled"]),
    country: z.literal("PL"),
    capability: z.enum(["voice", "sms", "both"]),
    at: z.number().int(),
    expires: z.number().int(),
  })
  .strict();
export type ActionContext = Pick<
  z.infer<typeof eventSchema>,
  "state" | "country" | "capability" | "at"
>;
function signature(payload: string) {
  // Separate protocol from actionable quote signatures. These receipts never authorize an action.
  return createHmac("sha256", demoSigningKey)
    .update(`zen:context:v1:${payload}`)
    .digest("base64url");
}
export function withActionReceipt(
  conversationId: string,
  artifact: Artifact,
  now = Date.now(),
): Artifact {
  if (
    !["setup", "quote", "result", "cancelled"].includes(artifact.kind) ||
    !("capability" in artifact)
  )
    return artifact;
  const event = eventSchema.parse({
    conversationId,
    state: artifact.kind,
    country: "PL",
    capability: artifact.capability,
    at: now,
    expires: now + 7 * 86400000,
  });
  const payload = Buffer.from(JSON.stringify(event)).toString("base64url");
  return { ...artifact, receipt: `${payload}.${signature(payload)}` };
}
export function readActionContext(
  receipts: string[],
  conversationId: string,
  now = Date.now(),
): ActionContext[] {
  const events: ActionContext[] = [];
  for (const token of new Set(receipts.slice(-8))) {
    try {
      const [payload, sig, extra] = token.split(".");
      if (!payload || !sig || extra || token.length > 1400) continue;
      const expected = Buffer.from(signature(payload));
      const actual = Buffer.from(sig);
      if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      )
        continue;
      const e = eventSchema.parse(
        JSON.parse(Buffer.from(payload, "base64url").toString()),
      );
      if (e.conversationId !== conversationId || e.expires <= now || e.at > now)
        continue;
      events.push({
        state: e.state,
        country: e.country,
        capability: e.capability,
        at: e.at,
      });
    } catch {
      /* Old, corrupted or unverified context is omitted, never promoted to a fact. */
    }
  }
  return events.sort((a, b) => a.at - b.at);
}
export function actionContextPrompt(
  events: ActionContext[],
  omittedMessages = 0,
) {
  return `Some older conversation text may be omitted (${omittedMessages} messages). Do not infer missing facts.\nHistorical server-verified DEMO UI events, oldest first: ${JSON.stringify(events)}. setup means a proposal, quote means simulated availability, result means the visitor explicitly completed a SIMULATION, cancelled means the visitor cancelled a simulation. These are bounded historical observations, not authorization or proof of any sample account change. Use the latest relevant event when answering a follow-up about setup. If none is supplied, do not infer whether setup was completed or cancelled from earlier assistant prose.`;
}
