import "server-only";
import { z } from "zod";
import { createQuote, confirmQuote, cancelQuote } from "@/lib/zen/quotes";
import { requestGuard, readBody } from "@/lib/zen/http";

import { withActionReceipt } from "@/lib/zen/action-context";

const actionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("prepare"),
      conversationId: z.string().uuid(),
      country: z.literal("PL"),
      capability: z.enum(["voice", "sms", "both"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("dismiss"),
      conversationId: z.string().uuid(),
      country: z.literal("PL"),
      capability: z.enum(["voice", "sms", "both"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("cancel"),
      conversationId: z.string().uuid(),
      token: z.string().max(2000),
    })
    .strict(),
  z
    .object({
      action: z.literal("search"),
      conversationId: z.string().uuid(),
      country: z.literal("PL"),
      capability: z.enum(["voice", "sms", "both"]),
      simulateFailure: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("confirm"),
      conversationId: z.string().uuid(),
      token: z.string().max(2000),
      confirmed: z.literal(true),
    })
    .strict(),
]);
export async function POST(request: Request) {
  const rejected = requestGuard(request);
  if (rejected) return rejected;
  let action;
  try {
    action = actionSchema.parse(await readBody(request));
  } catch {
    return Response.json(
      {
        error:
          "This demo action is invalid. Explicit confirmation is required.",
      },
      { status: 400 },
    );
  }
  if (action.action === "search" && action.simulateFailure)
    return Response.json(
      {
        error:
          "The demo inventory check failed. Your account is unchanged. Try again.",
      },
      { status: 503 },
    );
  try {
    const artifact =
      action.action === "prepare" || action.action === "dismiss"
        ? {
            kind:
              action.action === "prepare"
                ? ("setup" as const)
                : ("cancelled" as const),
            country: "PL" as const,
            capability: action.capability,
          }
        : action.action === "search"
          ? createQuote(action.conversationId, action.capability)
          : action.action === "cancel"
            ? cancelQuote(action.token, action.conversationId)
            : confirmQuote(
                action.token,
                action.conversationId,
                action.confirmed,
              );
    return Response.json(
      { artifact: withActionReceipt(action.conversationId, artifact) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "The demo action failed.",
      },
      { status: 409 },
    );
  }
}
