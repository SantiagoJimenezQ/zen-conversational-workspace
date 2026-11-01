import "server-only";
import { randomUUID } from "node:crypto";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  accountScope,
  automaticReads,
  invokeCatalogTool,
  resolveTool,
  validateToolArguments,
} from "./mcp-catalog";
import { outputText, providerPayload } from "./mcp-payload";
import {
  committedCents,
  ledgerTransaction,
  type Operation,
} from "./operation-store";
import type { Artifact } from "./schema";
export function mutation(tool: Tool) {
  return !automaticReads.has(tool.name);
}
function object(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
export async function priceOperation(
  tool: Tool,
  args: Record<string, unknown>,
  signal: AbortSignal,
): Promise<{ cents: number | null; recurring: number; reason?: string }> {
  if (
    /api_keys|(?:^|_)(?:oauth|password|permission|invite|treasury|payout|topup)(?:_|$)/i.test(
      tool.name,
    ) ||
    /"[^"\n]*(?:secret|password|authorization|access_token|api_key)[^"\n]*"\s*:/i.test(
      JSON.stringify(args),
    )
  )
    return {
      cents: null,
      recurring: 0,
      reason:
        "This credential, access-management or financial operation needs its dedicated Zernio interface; it is outside the $5 demo action policy.",
    };
  if (tool.name === "phone_numbers_purchase_phone_number") {
    if (args.connect_whatsapp !== false || args.wants_whatsapp === true)
      return {
        cents: null,
        recurring: 0,
        reason:
          "Set connect_whatsapp=false and omit wants_whatsapp for a number-only quote. WhatsApp setup and future usage need their own verified cost review.",
      };
    const country =
      typeof args.country === "string" ? args.country.toUpperCase() : "US";
    const result = await invokeCatalogTool(
      "phone_numbers_list_phone_number_countries",
      {},
      signal,
    );
    if (result.isError)
      throw new Error("The live country price could not be verified.");
    const payload = providerPayload(result);
    const countries =
      object(payload) && Array.isArray(payload.countries)
        ? payload.countries
        : [];
    const row = countries.find((c) => object(c) && c.code === country);
    const types = object(row) && Array.isArray(row.types) ? row.types : [];
    if (typeof args.number_type !== "string")
      return {
        cents: null,
        recurring: 0,
        reason:
          "Choose an explicit number_type so the approved price matches exactly what is purchased.",
      };
    const chosen = types.find(
      (t) => object(t) && t.numberType === args.number_type,
    );
    if (
      object(chosen) &&
      args.wants_sms === true &&
      chosen.smsAvailable !== true
    )
      return {
        cents: null,
        recurring: 0,
        reason:
          "The selected number type does not support SMS. Choose a voice-only setup or a type with verified SMS support.",
      };
    const cents = object(chosen) ? chosen.monthlyCents : undefined;
    if (typeof cents !== "number" || !Number.isSafeInteger(cents) || cents < 0)
      return {
        cents: null,
        recurring: 0,
        reason:
          "A current, type-specific USD price is required before purchasing.",
      };
    if (!object(chosen) || chosen.inStock !== true)
      return {
        cents: null,
        recurring: cents,
        reason:
          "The selected number type is not currently in stock. No pre-order is placed automatically.",
      };
    if (chosen.needsKyc === true && args.phone_number)
      return {
        cents: null,
        recurring: cents,
        reason:
          "This regulated type requires KYC and does not allow an exact-number purchase before verification.",
      };
    return { cents, recurring: cents };
  }
  if (automaticReads.has(tool.name)) return { cents: 0, recurring: 0 };
  // Published normal API features have no per-request charge. Paid product families need a verified estimate.
  const billable =
    /phone.*purchase|imessage.*(?:order|register)|(?:voice|calling).*create|sms|verify_|(?:ad_|ads_|ad_campaign)|treasury|payout|credit|topup|billing|subscription|(?:twitter|^x_)|tools_|messages?_send|broadcast|sequences|workflows_.*(?:activate|start|run|publish|enable)/i.test(
      tool.name,
    ) ||
    /\b(?:billed|charges?|credits?|paid|fees?|metered|per.minute|costs?)\b/i.test(
      tool.description || "",
    ) ||
    /(?:twitter|\bx\b)/i.test(JSON.stringify(args));
  const normalFree =
    /^(profiles_|account_groups_|queue_|tracking_tags_|webhooks_|validate_|media_)/.test(
      tool.name,
    ) || ["zernio_overview", "docs_search"].includes(tool.name);
  const social =
    /^(posts_|analytics_|comments_|mentions_|accounts_|contacts_)/.test(
      tool.name,
    );
  if (social && !billable) {
    const accounts = await invokeCatalogTool("accounts_list", {}, signal);
    const text = providerPayload(accounts);
    if (
      accounts.isError ||
      typeof text !== "string" ||
      /^.*(?:^|\n)- (?:twitter|x):/i.test(text)
    )
      return {
        cents: null,
        recurring: 0,
        reason:
          "A non-X target and its API charges must be verified before this action can be priced.",
      };
  }
  return billable || (!normalFree && !social)
    ? {
        cents: null,
        recurring: 0,
        reason:
          "This operation can incur provider charges or future usage. A bounded, verified quote is required; it cannot bypass the $5 demo cap.",
      }
    : { cents: 0, recurring: 0 };
}
export function operationArtifact(op: Operation, remaining: number): Artifact {
  return {
    kind: "mcp-operation",
    operationId: op.id,
    tool: op.tool,
    title: op.title,
    argsJson: JSON.stringify(op.args, null, 2),
    status: op.status,
    costCents: op.costCents,
    recurringCents: op.recurringCents,
    remainingCents: Math.max(0, remaining),
    reason: op.reason,
    output: op.output,
    updatedAt: op.updatedAt,
  };
}
export async function prepareOperation(
  conversationId: string,
  name: string,
  args: Record<string, unknown>,
  signal: AbortSignal,
) {
  const tool = await resolveTool(name, signal);
  validateToolArguments(tool, args);
  if (
    /"[^"\n]*(?:secret|password|authorization|access_token|api_key)[^"\n]*"\s*:/i.test(
      JSON.stringify(args),
    )
  )
    throw new Error(
      "Credentials must use a dedicated secure setup flow, not a stored tool action.",
    );
  const quote = await priceOperation(tool, args, signal);
  const now = new Date().toISOString();
  const op: Operation = {
    id: randomUUID(),
    conversationId,
    owner: accountScope(),
    tool: name,
    title: tool.title || name,
    args: structuredClone(args),
    status: quote.cents === null ? "blocked" : "pending",
    createdAt: now,
    updatedAt: now,
    costCents: quote.cents,
    recurringCents: quote.recurring,
    reason: quote.reason,
  };
  if (name === "phone_numbers_purchase_phone_number") {
    op.args.purchase_intent_id = op.id;
    op.args.allow_multiple = false;
  }
  return ledgerTransaction((ledger) => {
    const remaining = ledger.limitCents - committedCents(ledger);
    if (op.costCents !== null && op.costCents > remaining) {
      op.status = "blocked";
      op.reason = "This action exceeds the remaining $5 demo budget.";
    }
    if (ledger.operations.length >= 5000)
      throw new Error("The local action ledger is full.");
    ledger.operations.push(op);
    return operationArtifact(op, remaining);
  });
}
export async function approveOperation(
  id: string,
  conversationId: string,
  approveRecurring: boolean,
  signal: AbortSignal,
) {
  const pending = await ledgerTransaction((ledger) =>
    ledger.operations.find(
      (o) =>
        o.id === id &&
        o.conversationId === conversationId &&
        o.owner === accountScope(),
    ),
  );
  if (!pending)
    throw new Error(
      "This action does not belong to this conversation/account.",
    );
  if (pending.status !== "pending") return getOperation(id, conversationId);
  if (Date.now() - Date.parse(pending.createdAt) > 10 * 60000)
    throw new Error("This approval expired. Prepare a fresh action.");
  if (pending.recurringCents > 0 && !approveRecurring)
    throw new Error(
      "Acknowledge the recurring subscription before purchasing.",
    );
  const tool = await resolveTool(pending.tool, signal);
  validateToolArguments(tool, pending.args);
  const quote = await priceOperation(tool, pending.args, signal);
  if (
    quote.cents === null ||
    quote.cents !== pending.costCents ||
    quote.recurring !== pending.recurringCents
  )
    throw new Error(
      "The current price or prerequisites changed. Prepare a fresh action.",
    );
  const reserved = await ledgerTransaction((ledger) => {
    const op = ledger.operations.find((o) => o.id === id)!;
    if (op.status !== "pending") return false;
    if (
      op.costCents === null ||
      committedCents(ledger) + op.costCents > ledger.limitCents
    )
      throw new Error("The $5 demo budget would be exceeded.");
    op.status = "running";
    op.updatedAt = new Date().toISOString();
    return true;
  });
  if (!reserved) return getOperation(id, conversationId);
  try {
    const result = await invokeCatalogTool(pending.tool, pending.args, signal);
    const payload = providerPayload(result);
    const failed =
      result.isError === true ||
      (object(payload) &&
        (payload.error != null ||
          (typeof payload.status === "number" && payload.status >= 400)));
    await ledgerTransaction((ledger) => {
      const op = ledger.operations.find((o) => o.id === id)!;
      const code = object(payload)
        ? (payload.code ?? payload.status_code ?? payload.status)
        : undefined;
      const certainRejection =
        typeof code === "number"
          ? [400, 401, 402, 403, 404, 409, 422].includes(code)
          : typeof code === "string" &&
            /PAYMENT_REQUIRED|INVALID_ARGUMENT|INSUFFICIENT|NOT_FOUND|UNAVAILABLE|VELOCITY/.test(
              code,
            );
      const awaiting =
        object(payload) &&
        typeof payload.status === "string" &&
        [
          "kyc_required",
          "pending",
          "processing",
          "requires_action",
          "pending_regulatory",
        ].includes(payload.status);
      op.status = failed
        ? pending.costCents && !certainRejection
          ? "unknown"
          : "failed"
        : awaiting
          ? "accepted"
          : "succeeded";
      op.output = outputText(payload);
      op.updatedAt = new Date().toISOString();
      if (op.status === "failed") op.costCents = 0;
    });
  } catch {
    // A disconnected writer may already have succeeded. Keep its budget reserved; never auto-retry.
    await ledgerTransaction((ledger) => {
      const op = ledger.operations.find((o) => o.id === id)!;
      op.status = "unknown";
      op.reason =
        "The provider outcome is uncertain. Refresh the provider resource before attempting another action; do not blindly retry.";
      op.updatedAt = new Date().toISOString();
    });
  }
  return getOperation(id, conversationId);
}
export async function getOperation(id: string, conversationId: string) {
  return ledgerTransaction((ledger) => {
    const op = ledger.operations.find(
      (o) =>
        o.id === id &&
        o.conversationId === conversationId &&
        o.owner === accountScope(),
    );
    if (!op) throw new Error("Action not found for this conversation/account.");
    return operationArtifact(op, ledger.limitCents - committedCents(ledger));
  });
}
export async function cancelOperation(id: string, conversationId: string) {
  return ledgerTransaction((ledger) => {
    const op = ledger.operations.find(
      (o) =>
        o.id === id &&
        o.conversationId === conversationId &&
        o.owner === accountScope(),
    );
    if (!op || op.status !== "pending")
      throw new Error("Only a pending action can be cancelled.");
    op.status = "blocked";
    op.reason = "Cancelled before execution.";
    op.updatedAt = new Date().toISOString();
    return operationArtifact(op, ledger.limitCents - committedCents(ledger));
  });
}
export async function realToolRead(
  name: string,
  args: Record<string, unknown>,
  signal: AbortSignal,
): Promise<Artifact> {
  if (name === "usage_get_usage" && args.reconcile === true)
    throw new Error(
      "Billing reconciliation requires the dedicated billing interface.",
    );
  if (!automaticReads.has(name))
    throw new Error("This tool requires an explicit reviewed action.");
  const result = await invokeCatalogTool(name, args, signal);
  if (result.isError)
    throw new Error(
      "Zernio could not complete this read. Check account permissions and prerequisites.",
    );
  return {
    kind: "mcp-result",
    tool: name,
    title: (await resolveTool(name, signal)).title || name,
    argsJson: JSON.stringify(args),
    output: outputText(providerPayload(result)),
    fetchedAt: new Date().toISOString(),
  };
}
export async function operationContext(ids: string[], conversationId: string) {
  void ids; // The server ledger is authoritative; UI submissions are not evidence of an action.
  return ledgerTransaction((ledger) =>
    ledger.operations
      .filter(
        (o) =>
          o.conversationId === conversationId && o.owner === accountScope(),
      )
      .map((o) => ({
        tool: o.tool,
        status: o.status,
        at: o.updatedAt,
        result: o.output?.slice(0, 1800),
        costCents: o.costCents,
      }))
      .slice(-8),
  );
}
