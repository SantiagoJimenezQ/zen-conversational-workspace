import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Quote, Artifact } from "./schema";

// Configured keys work across instances; the local fallback lasts for one server process.
import { demoSigningKey as signingKey } from "./signing-key";
const revoked = new Map<string, number>();
const claimsSchema = z
  .object({
    conversationId: z.string().uuid(),
    country: z.literal("PL"),
    capability: z.enum(["voice", "sms", "both"]),
    monthlyCents: z.literal(800),
    issuedAt: z.number(),
    expires: z.number(),
    nonce: z.string(),
  })
  .strict();
function signature(payload: string) {
  return createHmac("sha256", signingKey).update(payload).digest("base64url");
}
export function createQuote(
  conversationId: string,
  capability: "voice" | "sms" | "both",
  now = new Date(),
): Quote {
  const issuedAt = now.getTime();
  const claims = claimsSchema.parse({
    conversationId,
    country: "PL",
    capability,
    monthlyCents: 800,
    issuedAt,
    expires: issuedAt + 10 * 60 * 1000,
    nonce: randomBytes(12).toString("hex"),
  });
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return {
    kind: "quote",
    country: "PL",
    capability,
    monthlyCents: 800,
    token: `${payload}.${signature(payload)}`,
    expiresAt: new Date(claims.expires).toISOString(),
  };
}
function readClaims(
  token: string,
  conversationId: string,
  now = new Date(),
  checkExpiry = true,
) {
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra)
    throw new Error("This demo quote is invalid. Check availability again.");
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(sig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("This demo quote is invalid. Check availability again.");
  const parsed = claimsSchema.safeParse(
    JSON.parse(Buffer.from(payload, "base64url").toString()),
  );
  if (!parsed.success || parsed.data.conversationId !== conversationId)
    throw new Error("This demo quote belongs to a different conversation.");
  for (const [nonce, expires] of revoked)
    if (expires <= now.getTime()) revoked.delete(nonce);
  if (revoked.has(parsed.data.nonce))
    throw new Error("This demo setup was cancelled. Check availability again.");
  if (checkExpiry && parsed.data.expires <= now.getTime())
    throw new Error("This demo quote expired. Check availability again.");
  return parsed.data;
}
export function cancelQuote(
  token: string,
  conversationId: string,
  now = new Date(),
): Artifact {
  const claims = readClaims(token, conversationId, now, false);
  revoked.set(claims.nonce, claims.expires);
  return { kind: "cancelled", country: "PL", capability: claims.capability };
}
export function confirmQuote(
  token: string,
  conversationId: string,
  confirmed: boolean,
  now = new Date(),
): Artifact {
  if (!confirmed)
    throw new Error("Confirm the demo setup explicitly before continuing.");
  const claims = readClaims(token, conversationId, now);
  // Deterministic receipt makes repeat confirmation idempotent. No external API exists here.
  return {
    kind: "result",
    country: "PL",
    capability: claims.capability,
    reference: `ZEN-${claims.nonce.slice(0, 8).toUpperCase()}`,
    completedAt: new Date(claims.issuedAt).toISOString(),
  };
}
