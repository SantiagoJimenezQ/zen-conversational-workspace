import "server-only";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoints = {
  docs: "https://docs.zernio.com/api/mcp",
  account: "https://mcp.zernio.com/mcp",
} as const;
// This is the entire remote capability surface. Never expose call_tool/search_tools,
// accept a model-supplied server URL, or trust readOnlyHint as authorization.
const remoteTools = {
  search: "docs",
  get_page: "docs",
  accounts_list: "account",
  profiles_list: "account",
  "catalog:list": "account",
  "catalog:search": "account",
  "catalog:call": "account",
} as const;
export type RemoteTool = keyof typeof remoteTools;
export function mcpConfig() {
  return {
    docs: process.env.ZERNIO_DOCS_MCP_ENABLED !== "false",
    account:
      process.env.ZERNIO_ACCOUNT_MCP_ENABLED === "true" &&
      Boolean(process.env.ZERNIO_API_KEY?.trim()),
  };
}
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
    super("The Zernio MCP request could not finish.");
  }
}
/** A fresh SDK client per operation: no shared account sessions or cached credentials. */
export async function callMcp(
  name: RemoteTool,
  args: Record<string, unknown>,
  signal: AbortSignal,
  returnToolErrors = false,
) {
  if (!Object.hasOwn(remoteTools, name)) throw new McpReadError("not_allowed");
  const target = remoteTools[name];
  if (!mcpConfig()[target]) throw new McpReadError("not_configured");
  signal.throwIfAborted();
  const lifetime = new AbortController();
  const boundedSignal = AbortSignal.any([
    signal,
    lifetime.signal,
    AbortSignal.timeout(12000),
  ]);
  let responseTooLarge = false;
  const endpoint = endpoints[target];
  const key =
    target === "account" ? process.env.ZERNIO_API_KEY?.trim() : undefined;
  const client = new Client({ name: "zen-workspace-poc", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: {
      ...(key ? { headers: { Authorization: `Bearer ${key}` } } : {}),
      cache: "no-store",
      redirect: "error",
    },
    reconnectionOptions: {
      maxRetries: 0,
      initialReconnectionDelay: 1000,
      maxReconnectionDelay: 1000,
      reconnectionDelayGrowFactor: 1,
    },
    fetch: async (input, init) => {
      // Pin ALL requests, including the background SSE GET. Never follow auth redirects.
      const url = new URL(input.toString());
      if (url.href !== endpoint) throw new McpReadError("not_allowed");
      const response = await fetch(input, {
        ...init,
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.any([
          boundedSignal,
          ...(init?.signal ? [init.signal] : []),
        ]),
      });
      if ([401, 403, 402, 429].includes(response.status)) {
        await response.body?.cancel();
        throw new McpReadError(
          response.status === 402
            ? "billing_required"
            : response.status === 429
              ? "rate_limited"
              : "authentication",
        );
      }
      if (!response.body) return response;
      let size = 0;
      const body = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            size += chunk.byteLength;
            if (size > 512 * 1024) {
              responseTooLarge = true;
              controller.error(new McpReadError("response_too_large"));
              lifetime.abort();
              return;
            }
            controller.enqueue(chunk);
          },
        }),
      );
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    },
  });
  try {
    await client.connect(transport, { signal: boundedSignal, timeout: 12000 });
    const options = { signal: boundedSignal, timeout: 12000 };
    const result =
      name === "catalog:list"
        ? {
            content: [],
            structuredContent: await client.listTools(args, options),
          }
        : await client.callTool(
            {
              name:
                name === "catalog:search"
                  ? "search_tools"
                  : name === "catalog:call"
                    ? "call_tool"
                    : name,
              arguments: args,
            },
            undefined,
            options,
          );
    if (result.isError && !returnToolErrors)
      throw new McpReadError("unavailable");
    return CallToolResultSchema.parse(result);
  } catch (error) {
    if (signal.aborted) signal.throwIfAborted();
    if (responseTooLarge) throw new McpReadError("response_too_large");
    if (boundedSignal.aborted) throw new McpReadError("timeout");
    // Do not surface remote bodies, exception messages, headers or key fragments.
    throw error instanceof McpReadError
      ? error
      : new McpReadError("unavailable");
  } finally {
    lifetime.abort();
    await client.close().catch(() => {});
  }
}
