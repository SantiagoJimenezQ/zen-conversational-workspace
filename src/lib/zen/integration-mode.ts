import "server-only";
/** Server-owned feature flag. Public Vercel deployments always use synthetic tools. */
export function isMockMcp() {
  if (process.env.VERCEL === "1") return true;
  const value = process.env.ZERNIO_MCP_MOCK;
  if (value !== undefined && value !== "true" && value !== "false")
    throw new Error("ZERNIO_MCP_MOCK must be true or false.");
  const mock = value !== "false";
  const display = process.env.NEXT_PUBLIC_ZERNIO_MCP_MOCK;
  if (display && display !== (mock ? "true" : "false"))
    throw new Error(
      "Restart development or rebuild after changing ZERNIO_MCP_MOCK.",
    );
  return mock;
}
