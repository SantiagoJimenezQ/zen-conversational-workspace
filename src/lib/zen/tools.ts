import { z } from "zod";
import { setupInput, type Artifact, type SourceId } from "./schema";
import { getDemoInsights } from "./fixtures";

const schemas = {
  discover_capabilities: z
    .object({ useCase: z.string().min(1).max(1000) })
    .strict(),
  prepare_phone_setup: setupInput,
  get_call_insights: z.object({ period: z.literal("yesterday") }).strict(),
};
const descriptions: Record<keyof typeof schemas, string> = {
  discover_capabilities:
    "Find documented Workspace capabilities for a customer outcome. Returns official sources and a capability card, never executes an account action.",
  prepare_phone_setup:
    "Prepare a phone number search card once country and voice/SMS requirements are clear. This does not search or buy. Only Poland is covered by the illustrative demo setup; other countries must be described as outside this prototype, not unsupported by Workspace.",
  get_call_insights:
    "Calculate yesterday's outbound sample-account calls in Europe/Madrid from deterministic fixtures. Use only when the user explicitly requests sample/demo totals, never to answer a sample account activity question. Only yesterday is supported by this demo.",
};
export const toolDefinitions = Object.entries(schemas).map(
  ([name, schema]) => ({
    type: "function",
    function: {
      name,
      description: descriptions[name as keyof typeof schemas],
      parameters: z.toJSONSchema(schema, { target: "draft-7" }),
    },
  }),
);
export type ToolResult = {
  artifact?: Artifact;
  sources: SourceId[];
  explanation: string;
  error?: string;
};
export function executeTool(
  name: string,
  input: unknown,
  now = new Date(),
): ToolResult {
  if (!Object.hasOwn(schemas, name))
    return {
      sources: [],
      explanation: "Tool not available.",
      error: "unknown_tool",
    };
  const parsed = schemas[name as keyof typeof schemas].safeParse(input);
  if (!parsed.success)
    return {
      sources: [],
      explanation:
        "Invalid tool arguments. Ask for the missing or supported values.",
      error: "invalid_arguments",
    };
  if (name === "get_call_insights")
    return {
      artifact: getDemoInsights(now),
      sources: ["calls"],
      explanation:
        "Calculated sample-account outbound attempts, not sample account data. All rows in the explicit date window are included. Completed/unanswered/failed are demo display categories. Offer to inspect failures or channel breakdown.",
    };
  if (name === "prepare_phone_setup") {
    const args = setupInput.parse(parsed.data);
    if (!/^(pl|poland|polska)$/i.test(args.country))
      return {
        sources: ["numbers"],
        explanation:
          "This prototype simulates Poland only. Do not claim Workspace does not support this country. Offer official availability documentation or the Poland simulation.",
        error: "outside_demo_scope",
      };
    return {
      artifact: { kind: "setup", country: "PL", capability: args.capability },
      sources: ["numbers", "voice", "provisioning"],
      explanation:
        "A search proposal is ready. Ask the user to click Check availability. The button performs a labeled simulation; no live stock, pricing or Polish prerequisites have been verified. No purchase has happened.",
    };
  }
  const text = (parsed.data as { useCase: string }).useCase;
  const voice = /call|phone|alert|voice|sms|number/i.test(text);
  return {
    artifact: {
      kind: "discovery",
      topic: voice ? "voice" : "social",
      title: voice ? "Event → voice call" : "One API for your social workflow",
      description: voice
        ? "Your app detects an event. Workspace’s voice API can place a call and report call events back to your app."
        : "Connect supported platforms, publish or schedule content, and read performance through Workspace’s tools.",
    },
    sources: voice ? ["voice", "numbers"] : ["agents"],
    explanation:
      "These capabilities are grounded in the included official documentation. No call has been placed. For alert calling, ask which country the caller number should be from and whether voice alone is enough.",
  };
}
