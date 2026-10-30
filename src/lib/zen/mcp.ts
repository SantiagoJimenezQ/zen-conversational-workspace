import "server-only";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Temporal } from "@js-temporal/polyfill";
import { previewState } from "./preview-session";
const schema = (
  name: string,
  properties: Record<string, unknown> = {},
  required: string[] = [],
) => ({
  name,
  description:
    (
      {
        profiles_list: "List all workspace profiles.",
        accounts_list: "List connected social accounts.",
        profiles_create:
          "Create a new workspace profile with the supplied name and optional description.",
        phone_numbers_list_phone_number_countries:
          "List supported phone-number countries and types, stock, KYC requirements and monthly USD prices.",
        phone_numbers_search_available_phone_numbers:
          "Search current phone-number inventory by country and number type.",
        phone_numbers_purchase_phone_number:
          "Purchase a phone number for a workspace profile. Requires billing. Billed at the current monthly number-type price. Use purchase_intent_id for idempotency and allow_multiple=false.",
        calls_list_calls:
          "List unified call history, newest first. Filter direction and upper time bound. Pass nextCursor as before for the next page.",
      } as Record<string, string>
    )[name] || name,
  inputSchema: {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  },
});
const mockTools = [
  schema("profiles_list"),
  schema("accounts_list"),
  schema(
    "profiles_create",
    {
      name: { type: "string", maxLength: 512 },
      description: { type: "string", maxLength: 512 },
    },
    ["name"],
  ),
  schema("phone_numbers_list_phone_number_countries"),
  schema("phone_numbers_search_available_phone_numbers", {
    country: { type: "string", maxLength: 512 },
    number_type: { type: "string", maxLength: 512 },
    sms: { type: "boolean" },
    limit: { type: "integer" },
  }),
  schema(
    "phone_numbers_purchase_phone_number",
    {
      profile_id: { type: "string", maxLength: 512 },
      country: { type: "string", maxLength: 512 },
      number_type: { type: "string", maxLength: 512 },
      connect_whatsapp: { type: "boolean" },
      wants_sms: { type: "boolean" },
      phone_number: { type: "string", maxLength: 512 },
      purchase_intent_id: { type: "string", maxLength: 512 },
      allow_multiple: { type: "boolean" },
    },
    ["profile_id"],
  ),
  schema("calls_list_calls", {
    before: { type: "string", maxLength: 512 },
    direction: { type: "string", maxLength: 512 },
    limit: { type: "integer" },
  }),
];

const result = (value: unknown, isError = false) => ({
  content: [
    {
      type: "text" as const,
      text: typeof value === "string" ? value : JSON.stringify(value),
    },
  ],
  ...(isError ? { isError: true } : {}),
});
export function fixtureReply(
  entry: { fixture: string },
  name: string,
  args: Record<string, unknown>,
  now: Date,
) {
  if (name === "profiles_list")
    return result(
      entry.fixture === "profiles-empty"
        ? "No profiles found."
        : "Found 2 profile(s):\n\n- Eval Default (default) (ID: eval-profile)\n- Eval Studio (ID: eval-studio)",
    );
  if (name === "accounts_list") return result("No accounts connected.");
  if (name === "phone_numbers_list_phone_number_countries")
    return result({
      countries: [
        {
          code: "US",
          name: "United States",
          types: [
            {
              numberType: "local",
              monthlyCents: entry.fixture === "expensive" ? 1300 : 300,
              inStock: entry.fixture !== "out-of-stock",
              needsKyc: false,
              callsAvailable: true,
              smsAvailable: true,
            },
          ],
        },
      ],
    });
  if (name === "phone_numbers_search_available_phone_numbers")
    return result({
      numbers:
        entry.fixture === "out-of-stock"
          ? []
          : [{ phoneNumber: "+12025550101" }],
    });
  if (name === "calls_list_calls") {
    if (entry.fixture === "unavailable")
      return result(
        "Synthetic provider unavailable. No records were retrieved.",
        true,
      );
    if (entry.fixture === "incomplete")
      return result({
        calls: [],
        nextCursor: new Date(
          Date.parse(String(args.before || now.toISOString())) - 1000,
        ).toISOString(),
      });
    if (entry.fixture === "empty")
      return result({ calls: [], nextCursor: null });
    const spec = [
      [1, "outbound"],
      [1, "outbound"],
      [1, "inbound"],
      [5, "outbound"],
      [5, "inbound"],
      [15, "outbound"],
      [15, "outbound"],
      [15, "outbound"],
      [15, "inbound"],
      [35, "outbound"],
      [35, "outbound"],
    ] as const;
    const rows = spec
      .map(([days, direction], index) => ({
        _id: `eval-call-${index}`,
        startedAt: new Date(
          Temporal.Instant.from(now.toISOString())
            .toZonedDateTimeISO("Europe/Madrid")
            .subtract({ days })
            .with({ hour: 12, minute: 0, second: 0, millisecond: 0 })
            .toInstant().epochMilliseconds +
            index * 60000,
        ).toISOString(),
        direction,
        status: "ended",
      }))
      .filter(
        (row) =>
          (!args.direction || args.direction === row.direction) &&
          (!args.before || row.startedAt < String(args.before)),
      )
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const page = rows.slice(0, 4);
    return result({
      calls: page,
      nextCursor: rows.length > page.length ? page.at(-1)!.startedAt : null,
    });
  }
  return result(
    "This synthetic tool is not implemented. No data was retrieved.",
    true,
  );
}

export type RemoteTool =
  | "search"
  | "get_page"
  | "accounts_list"
  | "profiles_list"
  | "catalog:list"
  | "catalog:search"
  | "catalog:call";
export type McpFailure =
  | "not_configured"
  | "not_allowed"
  | "authentication"
  | "billing_required"
  | "rate_limited"
  | "timeout"
  | "unavailable"
  | "invalid_result"
  | "response_too_large";
export class McpReadError extends Error {
  constructor(public readonly code: McpFailure) {
    super("The mock MCP request could not finish.");
  }
}
export function mcpConfig() {
  return { docs: true, account: true };
}
/** Mock-only adapter. There is deliberately no SDK transport, fetch or credential access. */
export async function callMcp(
  name: RemoteTool,
  args: Record<string, unknown>,
  signal: AbortSignal,
  returnToolErrors = false,
): Promise<CallToolResult> {
  void returnToolErrors;
  signal.throwIfAborted();
  const state = previewState();
  if (name === "catalog:list")
    return { content: [], structuredContent: { tools: mockTools } };
  if (name === "catalog:search")
    return result(
      mockTools.filter((t) =>
        String(args.query)
          .toLowerCase()
          .split(/\W+/)
          .some(
            (word) =>
              word.length > 2 &&
              (t.name + " " + t.description).toLowerCase().includes(word),
          ),
      ),
    );
  if (name === "search")
    return result([
      {
        title: "Sample voice workflow",
        url: "https://docs.zernio.com/calls/list-calls",
        content:
          "Synthetic documentation example: inspect workspace profiles, select a sample caller number, review a simulated action and inspect sample call history. No real calls or purchases are made.",
      },
    ]);
  if (name === "get_page")
    return result(
      "# Sample voice workflow\nThis is a mocked documentation response. Sample caller numbers and call records demonstrate setup and reporting. Confirmations change only simulation state.",
    );
  const tool = name === "catalog:call" ? String(args.name) : name;
  const params =
    name === "catalog:call"
      ? ((args.arguments || {}) as Record<string, unknown>)
      : args;
  if (tool === "profiles_list")
    return result(
      `Found ${state.profiles.length} profile(s):\n\n` +
        state.profiles.map((p) => `- ${p.name} (ID: ${p.id})`).join("\n"),
    );
  if (tool === "profiles_create") {
    if (state.profiles.length >= 50)
      throw new Error("This simulation has reached its profile limit.");
    const profile = {
      id: `sample-${crypto.randomUUID()}`,
      name: String(params.name),
    };
    state.profiles.push(profile);
    return result({
      simulated: true,
      profile,
      message: "Sample profile created. No external account changed.",
    });
  }
  if (tool === "phone_numbers_purchase_phone_number") {
    const number = String(params.phone_number || "+12025550101");
    state.numbers.push(number);
    return result({
      simulated: true,
      status: "active",
      phoneNumber: number,
      message: "Simulated purchase only. No charge or subscription.",
    });
  }
  return fixtureReply({ fixture: "normal" }, tool, params, new Date());
}
