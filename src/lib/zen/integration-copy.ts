/** Display-only flag derived by Next config; server security never trusts this value. */
export function mcpCopy(mock: string, live: string) {
  return process.env.NEXT_PUBLIC_ZERNIO_MCP_MOCK === "false" ? live : mock;
}
