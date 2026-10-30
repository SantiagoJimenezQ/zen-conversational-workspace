import type { ChatMessage, StreamEvent } from "./schema";
import { executeTool } from "./tools";
import { scopeReplies } from "./agent-policy";

import type { ActionContext } from "./action-context";

// Explicitly labeled deterministic adapter for a credential-free rehearsal.
export function demoResponse(
  messages: ChatMessage[],
  now = new Date(),
  actions: ActionContext[] = [],
): StreamEvent[] {
  const user = messages.filter((m) => m.role === "user").at(-1)?.text ?? "";
  const context = messages.map((m) => m.text).join(" ");
  let name = "";
  let args: unknown;
  let text = "";
  const latest = actions.at(-1);
  if (
    /ignore.{0,40}(?:rules|instructions)|system prompt|pretend.{0,30}(?:unrestricted|another)|bypass.{0,30}(?:approval|budget)/i.test(
      user,
    )
  ) {
    text = scopeReplies.out_of_scope;
  } else if (
    latest &&
    /what.*(happen|setup|cancel|complete)|did.*(cancel|complete)|setup.*(status|happen)|what.*just.*(do|change)/i.test(
      user,
    )
  ) {
    const state = {
      setup: "prepared a proposal",
      quote: "checked simulated availability",
      result: "completed the demo setup",
      cancelled: "cancelled the demo setup",
    }[latest.state];
    text = `You ${state} for Poland (${latest.capability}). This was a simulation. No real number was purchased. No charge was made.`;
  } else if (
    /yesterday|failed calls|break.*channel|call.*(total|many|breakdown)/i.test(
      user,
    )
  ) {
    name = "get_call_insights";
    args = { period: "yesterday" };
    text =
      "This is yesterday’s outbound activity for the sample account. The total includes completed, unanswered, and failed attempts. You can inspect failed calls or view totals by channel.";
  } else if (
    /buy|purchase|send|delete|publish|place a call|call them now/i.test(user)
  ) {
    text =
      "The offline demo cannot change your Zernio account. It can simulate number setup. Review the details before you confirm a simulation. Use live mode for real account actions.";
  } else if (
    /number|poland|polish|just voice|voice only|both|sms too/i.test(user)
  ) {
    if (
      !/poland|polish|\bpl\b/i.test(context) ||
      (/number/i.test(user) && !/poland|polish|\bpl\b/i.test(user))
    )
      text =
        "Which country do you need a number from? The offline demo covers Poland. Use the official Zernio catalog to check other countries.";
    else if (!/voice|outbound call|sms|both/i.test(user))
      text = "Do you need SMS, voice calls, or both?";
    else {
      name = "prepare_phone_setup";
      args = {
        country: "PL",
        capability: /both|sms too/i.test(user)
          ? "both"
          : /sms/i.test(user) && !/voice/i.test(user)
            ? "sms"
            : "voice",
      };
      text =
        "Your Poland number search is ready. Check availability to explore the simulated options. Live stock and prices have not been checked.";
    }
  } else if (/alert|call|social|post|schedule|capabilit/i.test(user)) {
    name = "discover_capabilities";
    args = { useCase: user };
    text = /alert|call/i.test(user)
      ? "Zernio’s voice API supports calls from events in your app. First, select a caller number. Then, connect your event handler to the API. Which country do you need a number from?"
      : "Zernio connects supported platforms through one API. This card contains information from the official documentation. What do you want to do in Zernio?";
  } else
    text =
      "I can only help with Zernio. The offline demo covers its capabilities, Polish number setup, and yesterday’s sample calls. Use live mode for other Zernio requests.";
  const result = name ? executeTool(name, args, now) : undefined;
  return [
    { type: "text", text },
    ...(result?.artifact
      ? [{ type: "artifact" as const, artifact: result.artifact }]
      : []),
    { type: "sources", sources: result?.sources ?? [] },
    { type: "done" },
  ];
}
