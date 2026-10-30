import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
/** Generated Workspace tools sometimes return Python literals. Parse data, never eval code. */
export function parseProviderText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    /* Try the provider's literal representation. */
  }
  if (!/^[\[{]/.test(text.trim()) || text.length > 512 * 1024) return text;
  let out = "";
  for (let i = 0; i < text.length;) {
    const c = text[i];
    if (c === "'" || c === '"') {
      const quote = c;
      let value = "";
      let ended = false;
      i++;
      while (i < text.length) {
        const char = text[i++];
        if (char === quote) {
          ended = true;
          break;
        }
        if (char !== "\\") {
          value += char;
          continue;
        }
        const next = text[i++];
        if (next === undefined) return text;
        const simple: Record<string, string> = {
          n: "\n",
          r: "\r",
          t: "\t",
          b: "\b",
          f: "\f",
          v: "\v",
          "\\": "\\",
          "'": "'",
          '"': '"',
        };
        if (Object.hasOwn(simple, next)) value += simple[next];
        else if (["u", "x", "U"].includes(next)) {
          const size = next === "x" ? 2 : next === "U" ? 8 : 4;
          const hex = text.slice(i, i + size);
          if (!new RegExp(`^[0-9a-fA-F]{${size}}$`).test(hex)) return text;
          const point = parseInt(hex, 16);
          if (point > 0x10ffff) return text;
          value += String.fromCodePoint(point);
          i += size;
        } else value += `\\${next}`;
      }
      if (!ended) return text;
      out += JSON.stringify(value);
    } else if (/[A-Za-z_]/.test(c) && !/[eE]/.test(c)) {
      const token = /^[A-Za-z_]+/.exec(text.slice(i))?.[0];
      if (!token || !["None", "True", "False"].includes(token)) return text;
      out += token === "None" ? "null" : token === "True" ? "true" : "false";
      i += token.length;
    } else if (/[\s\[\]{},:0-9.+eE-]/.test(c)) {
      out += c;
      i++;
    } else return text;
  }
  try {
    return JSON.parse(out);
  } catch {
    return text;
  }
}
export function providerPayload(result: CallToolResult): unknown {
  let value: unknown = result.structuredContent;
  if (!value)
    value = result.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  if (value && typeof value === "object" && "result" in value)
    value = value.result;
  return typeof value === "string" ? parseProviderText(value) : value;
}
export function safeOutput(value: unknown, depth = 0): unknown {
  if (depth > 12) return "[depth limit]";
  if (typeof value === "string") {
    let clean = value;
    for (const key of [
      process.env.ZERNIO_API_KEY,
      process.env.OPENROUTER_API_KEY,
      process.env.PUBLIC_DEMO_OPENROUTER_API_KEY,
    ])
      if (key && key.length > 8) clean = clean.split(key).join("[redacted]");
    clean = clean.replace(
      /((?:api[_ -]?key|access[_ -]?token|client[_ -]?secret|password)\s*[:=]\s*)[^\s,;]+/gi,
      "$1[redacted]",
    );
    return clean
      .replace(
        /(?:sk[-_](?:or[-_])?[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{12,})/g,
        "[redacted]",
      )
      .slice(0, 16000);
  }
  if (Array.isArray(value))
    return value.slice(0, 200).map((v) => safeOutput(v, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 200)
        .map(([k, v]) => [
          k,
          /secret|token|password|authorization|api.?key|private.?key|client.?secret|^key$/i.test(
            k,
          )
            ? "[redacted]"
            : safeOutput(v, depth + 1),
        ]),
    );
  return value;
}
export function outputText(value: unknown) {
  const safe = safeOutput(value);
  const text =
    typeof safe === "string"
      ? safe
      : (JSON.stringify(safe, null, 2) ?? "No result content.");
  return text.length > 24000
    ? text.slice(0, 23900) +
        "\n[display truncated; provider result may contain additional records]"
    : text;
}
