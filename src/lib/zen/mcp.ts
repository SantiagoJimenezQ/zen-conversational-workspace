import "server-only";
import { isMockMcp } from "./integration-mode";
import * as live from "./mcp-live";
import * as mock from "./mcp-mock";
export { McpReadError } from "./mcp-live";
export type { RemoteTool, McpFailure } from "./mcp-live";
export function mcpConfig() {
  return isMockMcp() ? { docs: true, account: true } : live.mcpConfig();
}
export async function callMcp(...args: Parameters<typeof live.callMcp>) {
  return isMockMcp() ? mock.callMcp(...args) : live.callMcp(...args);
}
