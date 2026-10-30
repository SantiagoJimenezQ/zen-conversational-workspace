import "server-only";
import { previewState } from "./preview-session";
import { ToolSchema, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv-provider.js";
import { callMcp, mcpConfig } from "./mcp";
import { providerPayload } from "./mcp-payload";
export function accountScope() {
  return previewState().id;
}
const cache = new Map<string, { at: number; tools: Map<string, Tool> }>();
function store() {
  if (!mcpConfig().account)
    throw new Error("Configure the Workspace account MCP on the server.");
  const key = accountScope();
  let entry = cache.get(key);
  if (!entry || Date.now() - entry.at > 60000) {
    cache.clear();
    entry = { at: Date.now(), tools: new Map() };
    cache.set(key, entry);
  }
  return entry;
}
const hidden = new Set(["call_tool", "search_tools"]);
export async function catalogTools(
  query: string,
  signal: AbortSignal,
): Promise<Tool[]> {
  const entry = store();
  let tools: unknown;
  if (query.trim())
    tools = providerPayload(
      await callMcp(
        "catalog:search",
        { query: query.trim().slice(0, 200) },
        signal,
      ),
    );
  else {
    const result = await callMcp("catalog:list", {}, signal);
    tools = (result.structuredContent as { tools?: unknown })?.tools;
  }
  if (!Array.isArray(tools))
    throw new Error("The MCP catalog could not be interpreted.");
  const parsed = tools
    .map((t) => ToolSchema.parse(t))
    .filter((t) => !hidden.has(t.name));
  for (const tool of parsed) entry.tools.set(tool.name, tool);
  return parsed;
}
export async function resolveTool(name: string, signal: AbortSignal) {
  if (hidden.has(name) || !/^[a-zA-Z0-9_.-]{1,150}$/.test(name))
    throw new Error(
      "Choose a specific catalog tool; generic nested dispatch is not allowed.",
    );
  const entry = store();
  if (!entry.tools.has(name)) await catalogTools("", signal);
  if (!entry.tools.has(name)) await catalogTools(name, signal);
  const tool = entry.tools.get(name);
  if (!tool)
    throw new Error(
      "The server did not offer that tool. Search the live catalog first.",
    );
  return tool;
}
export function validateToolArguments(
  tool: Tool,
  args: Record<string, unknown>,
) {
  if (
    JSON.stringify(args).length > 24000 ||
    /"(?:__proto__|constructor|prototype)"\s*:/.test(JSON.stringify(args))
  )
    throw new Error(
      "Tool arguments are too large or contain unsupported keys.",
    );
  const checked = new AjvJsonSchemaValidator().getValidator(tool.inputSchema)(
    args,
  );
  if (!checked.valid)
    throw new Error(
      `Check the required tool arguments: ${checked.errorMessage?.slice(0, 500)}`,
    );
}
export async function invokeCatalogTool(
  name: string,
  args: Record<string, unknown>,
  signal: AbortSignal,
) {
  const tool = await resolveTool(name, signal);
  validateToolArguments(tool, args);
  return callMcp("catalog:call", { name, arguments: args }, signal, true);
}
/** Auto-execution is reviewed separately from advisory provider annotations. Everything else needs UI approval. */
export const automaticReads = new Set([
  "accounts_list",
  "accounts_get",
  "profiles_list",
  "profiles_get",
  "usage_get_billing",
  "usage_get_usage_stats",
  "usage_get_usage",
  "phone_numbers_list_phone_number_countries",
  "phone_numbers_search_available_phone_numbers",
  "phone_numbers_list_phone_numbers",
  "phone_numbers_get_phone_number",
  "calls_list_calls",
  "calls_get_call",
  "voice_list_voice_calls",
]);
