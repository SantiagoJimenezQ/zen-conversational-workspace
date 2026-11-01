import { z } from "zod";

export const sourceIdSchema = z.enum([
  "numbers",
  "voice",
  "calls",
  "agents",
  "provisioning",
]);
export type SourceId = z.infer<typeof sourceIdSchema>;
export const setupInput = z
  .object({
    country: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .describe(
        "Two-letter ISO country code, such as PL for Poland or US for United States.",
      ),
    capability: z.enum(["voice", "sms", "both"]),
  })
  .strict();
export const setupSchema = z.object({
  kind: z.literal("setup"),
  country: z.string(),
  capability: z.enum(["voice", "sms", "both"]),
});
export const callSchema = z.object({
  id: z.string(),
  at: z.string(),
  channel: z.enum(["pstn", "whatsapp"]),
  status: z.enum(["completed", "unanswered", "failed"]),
  direction: z.enum(["outbound", "inbound"]),
  reason: z.string().optional(),
});
export const insightSchema = z.object({
  kind: z.literal("insight"),
  date: z.string(),
  timeZone: z.string(),
  since: z.string(),
  until: z.string(),
  total: z.number(),
  completed: z.number(),
  unanswered: z.number(),
  failed: z.number(),
  pstn: z.number(),
  whatsapp: z.number(),
  calls: z.array(callSchema),
});
export const quoteSchema = z.object({
  kind: z.literal("quote"),
  country: z.literal("PL"),
  capability: z.enum(["voice", "sms", "both"]),
  monthlyCents: z.number(),
  token: z.string(),
  expiresAt: z.string(),
});
export const resultSchema = z.object({
  kind: z.literal("result"),
  reference: z.string(),
  country: z.literal("PL"),
  capability: z.enum(["voice", "sms", "both"]),
  completedAt: z.string(),
});
export const liveReferenceSchema = z.object({
  title: z.string().max(180),
  url: z
    .string()
    .max(1200)
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        url.hostname === "docs.zernio.com" &&
        !url.username &&
        !url.password &&
        !url.port
      );
    }),
  excerpt: z.string().max(1000),
});
export const documentationSchema = z.object({
  kind: z.literal("documentation"),
  references: z.array(liveReferenceSchema).min(1).max(6),
  fetchedAt: z.string().datetime(),
});
export const accountReadSchema = z.object({
  kind: z.literal("account-read"),
  resource: z.enum(["accounts", "profiles"]),
  rows: z
    .array(
      z.object({ label: z.string().max(160), detail: z.string().max(160) }),
    )
    .max(50),
  count: z.number().int().nonnegative(),
  truncated: z.boolean(),
  fetchedAt: z.string().datetime(),
});
export type LiveReference = z.infer<typeof liveReferenceSchema>;
export type AccountRead = z.infer<typeof accountReadSchema>;
export const mcpResultSchema = z.object({
  kind: z.literal("mcp-result"),
  tool: z.string().max(150),
  title: z.string().max(250),
  argsJson: z.string().max(24000),
  output: z.string().max(24000),
  fetchedAt: z.string().datetime(),
});
export const mcpOperationSchema = z.object({
  kind: z.literal("mcp-operation"),
  operationId: z.string().uuid(),
  tool: z.string().max(150),
  title: z.string().max(250),
  argsJson: z.string().max(24000),
  status: z.enum([
    "pending",
    "blocked",
    "running",
    "succeeded",
    "accepted",
    "failed",
    "unknown",
  ]),
  costCents: z.number().int().nonnegative().nullable(),
  recurringCents: z.number().int().nonnegative(),
  remainingCents: z.number().int().nonnegative(),
  reason: z.string().optional(),
  output: z.string().max(24000).optional(),
  updatedAt: z.string().datetime(),
});
export const livePhoneSchema = z.object({
  kind: z.literal("live-phone"),
  country: z.string().max(2),
  capability: z.enum(["voice", "sms", "both"]),
  numberType: z.string().max(30),
  monthlyCents: z.number().int().nonnegative(),
  needsKyc: z.boolean(),
  inStock: z.boolean(),
  numbers: z.array(z.string().max(30)).max(10),
  fetchedAt: z.string().datetime(),
});
export const callPeriodSchema = z.enum([
  "yesterday",
  "last_7_days",
  "last_30_days",
]);
export const callDirectionSchema = z.enum(["outbound", "inbound", "all"]);
export const callInsightsInput = z
  .object({
    period: callPeriodSchema,
    direction: callDirectionSchema.default("outbound"),
  })
  .strict();
export type CallPeriod = z.infer<typeof callPeriodSchema>;
export type CallDirection = z.infer<typeof callDirectionSchema>;
export const liveCallsSchema = z.object({
  kind: z.literal("live-calls"),
  period: callPeriodSchema.default("yesterday"),
  direction: callDirectionSchema.default("outbound"),
  date: z.string(),
  timeZone: z.string(),
  since: z.string(),
  until: z.string(),
  total: z.number().int().nonnegative(),
  statuses: z.array(
    z.object({ status: z.string(), count: z.number().int().nonnegative() }),
  ),
  pages: z.number().int(),
  fetchedAt: z.string().datetime(),
});
export const artifactSchema = z
  .discriminatedUnion("kind", [
    setupSchema,
    insightSchema,
    quoteSchema,
    resultSchema,
    documentationSchema,
    accountReadSchema,
    mcpResultSchema,
    mcpOperationSchema,
    livePhoneSchema,
    liveCallsSchema,
    z.object({
      kind: z.literal("cancelled"),
      country: z.literal("PL"),
      capability: z.enum(["voice", "sms", "both"]),
    }),
    z.object({
      kind: z.literal("discovery"),
      topic: z.enum(["voice", "social"]),
      title: z.string(),
      description: z.string(),
      references: z.array(liveReferenceSchema).max(6).optional(),
      fetchedAt: z.string().datetime().optional(),
    }),
  ])
  .and(z.object({ receipt: z.string().max(1400).optional() }));
export type Artifact = z.infer<typeof artifactSchema>;
export type Insight = z.infer<typeof insightSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export const messageSchema = z.object({
  id: z.string().max(100),
  role: z.enum(["user", "assistant"]),
  text: z.string().max(16000),
  sources: z.array(sourceIdSchema).default([]),
  artifacts: z.array(artifactSchema).max(10).default([]),
  status: z.enum(["complete", "streaming", "stopped", "error"]).optional(),
});
export type Message = z.infer<typeof messageSchema>;
export const chatSchema = z.object({
  id: z.string().max(100),
  title: z.string().max(160),
  messages: z.array(messageSchema).max(100),
  updatedAt: z.string(),
});
export type Conversation = z.infer<typeof chatSchema>;
// Transport only model input, never UI cards, call rows, quote tokens or display status.
export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().max(16000),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export const chatRequest = z
  .object({
    conversationId: z.string().uuid(),
    mode: z.enum(["live", "demo"]),
    messages: z.array(chatMessageSchema).min(1).max(40),
    receipts: z.array(z.string().max(1400)).max(8).default([]),
    operationIds: z.array(z.string().uuid()).max(8).default([]).optional(),
    omittedMessages: z.number().int().min(0).max(100).default(0),
  })
  .strict();
export type ChatRequest = z.infer<typeof chatRequest>;
export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "artifact"; artifact: Artifact }
  | { type: "sources"; sources: SourceId[] }
  | { type: "status"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };
