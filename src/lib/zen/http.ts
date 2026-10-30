import { isMockMcp } from "./integration-mode";
// Explicit production origins and same-origin browser POSTs; no wildcard CORS.
export function requestGuard(request: Request): Response | null {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  const deployed = process.env.VERCEL === "1";
  const allowed = new Set(
    [
      process.env.PUBLIC_APP_ORIGIN,
      process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
      process.env.VERCEL_PROJECT_PRODUCTION_URL &&
        `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    ].filter(Boolean),
  );
  let accepted = false;
  try {
    const local = ["127.0.0.1", "localhost", "[::1]"].includes(
      new URL(`http://${host}`).hostname,
    );
    accepted =
      deployed && isMockMcp()
        ? Boolean(
            origin && allowed.has(origin) && new URL(origin).host === host,
          )
        : local && (!origin || new URL(origin).host === host);
  } catch {
    accepted = false;
  }
  if (!accepted)
    return Response.json(
      { error: "This request came from a different site." },
      { status: 403 },
    );
  if (!request.headers.get("content-type")?.includes("application/json"))
    return Response.json(
      { error: "Expected a JSON request." },
      { status: 415 },
    );
  return null;
}
export async function readBody(request: Request) {
  if (Number(request.headers.get("content-length")) > 80000)
    throw new Error("Request too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Empty request.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 80000) {
        await reader.cancel();
        throw new Error("Request too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
