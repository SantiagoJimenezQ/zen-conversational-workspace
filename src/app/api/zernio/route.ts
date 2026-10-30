import { withPreviewSession } from "@/lib/zen/preview-session";
import { accountScope } from "@/lib/zen/mcp-catalog";
import { z } from "zod";
import { callPeriodSchema, callDirectionSchema } from "@/lib/zen/schema";
import { requestGuard, readBody } from "@/lib/zen/http";
import { mcpConfig } from "@/lib/zen/mcp";
import { automaticReads, catalogTools } from "@/lib/zen/mcp-catalog";
import {
  approveOperation,
  cancelOperation,
  getOperation,
  prepareOperation,
  realToolRead,
} from "@/lib/zen/operations";
import { committedCents, ledgerTransaction } from "@/lib/zen/operation-store";
import {
  phoneSearch,
  reviewPhone,
  liveCallInsights,
} from "@/lib/zen/telephony";
const args = z.record(z.string(), z.unknown());
const requestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("catalog"),
      query: z.string().max(200).default(""),
    })
    .strict(),
  z
    .object({
      action: z.literal("prepare"),
      conversationId: z.string().uuid(),
      tool: z.string().max(150),
      args,
    })
    .strict(),
  z
    .object({ action: z.literal("read"), tool: z.string().max(150), args })
    .strict(),
  z
    .object({
      action: z.literal("confirm"),
      conversationId: z.string().uuid(),
      id: z.string().uuid(),
      confirmed: z.literal(true),
      approveRecurring: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      action: z.enum(["status", "cancel"]),
      conversationId: z.string().uuid(),
      id: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("phone-search"),
      country: z.string().min(2).max(60),
      capability: z.enum(["voice", "sms", "both"]),
      numberType: z.string().max(30).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("phone-review"),
      conversationId: z.string().uuid(),
      country: z.string().length(2),
      capability: z.enum(["voice", "sms", "both"]),
      numberType: z.string().max(30),
      phoneNumber: z.string().max(30).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("calls"),
      period: callPeriodSchema.default("yesterday"),
      direction: callDirectionSchema.default("outbound"),
    })
    .strict(),
  z.object({ action: z.literal("activity") }).strict(),
]);
export const runtime = "nodejs";
export const maxDuration = 90;
async function handle(request: Request) {
  const rejected = requestGuard(request);
  if (rejected) return rejected;
  if (!mcpConfig().account)
    return Response.json(
      { error: "Configure ZERNIO_API_KEY and local account access first." },
      { status: 503 },
    );
  let input;
  try {
    input = requestSchema.parse(await readBody(request));
  } catch {
    return Response.json(
      { error: "Invalid MCP operation request." },
      { status: 400 },
    );
  }
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(80000)]);
  try {
    if (input.action === "catalog")
      return Response.json(
        { tools: await catalogTools(input.query, signal) },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (input.action === "activity")
      return Response.json(
        await ledgerTransaction((l) => ({
          limitCents: l.limitCents,
          committedCents: committedCents(l),
          operations: l.operations
            .filter((o) => o.owner === accountScope())
            .slice(-30)
            .map((o) => ({
              id: o.id,
              conversationId: o.conversationId,
              tool: o.tool,
              status: o.status,
              at: o.updatedAt,
              costCents: o.costCents,
            })),
        })),
        { headers: { "Cache-Control": "no-store" } },
      );
    let artifact;
    if (input.action === "prepare")
      artifact = automaticReads.has(input.tool)
        ? await realToolRead(input.tool, input.args, signal)
        : await prepareOperation(
            input.conversationId,
            input.tool,
            input.args,
            signal,
          );
    if (input.action === "read")
      artifact = await realToolRead(input.tool, input.args, signal);
    if (input.action === "confirm")
      artifact = await approveOperation(
        input.id,
        input.conversationId,
        input.approveRecurring,
        signal,
      );
    if (input.action === "status")
      artifact = await getOperation(input.id, input.conversationId);
    if (input.action === "cancel")
      artifact = await cancelOperation(input.id, input.conversationId);
    if (input.action === "phone-search")
      artifact = await phoneSearch(
        input.country,
        input.capability,
        input.numberType,
        signal,
      );
    if (input.action === "phone-review")
      artifact = await reviewPhone(
        input.conversationId,
        input.country,
        input.capability,
        input.numberType,
        input.phoneNumber,
        signal,
      );
    if (input.action === "calls")
      artifact = await liveCallInsights(signal, input.period, input.direction);
    return Response.json(
      { artifact },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error &&
      !/sk-|Bearer|token|fetch|JSON|Unexpected|network/i.test(error.message)
        ? error.message
        : "The provider operation could not finish. Check its status before retrying a write.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const rejected = requestGuard(request);
  if (rejected) return rejected;
  return withPreviewSession(request, () => handle(request));
}
