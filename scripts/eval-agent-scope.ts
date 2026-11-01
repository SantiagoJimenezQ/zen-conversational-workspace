import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { checkScope, scopeConfig } from "../src/lib/zen/agent-policy";
import { scopeCases } from "../tests/fixtures/scope-cases";
import { demoScopeCases } from "../tests/fixtures/demo-scope-cases";

async function main() {
  // Explicit opt-in network evaluation. No Zernio reads or actions are performed.
  try {
    process.loadEnvFile(".env.local");
  } catch {
    /* CI can supply environment directly. */
  }
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key)
    throw new Error(
      "Configure OPENROUTER_API_KEY before running this opt-in evaluation.",
    );
  const configured = scopeConfig();
  const model = process.env.SCOPE_EVAL_MODEL?.trim() || configured.model;
  const fallbackModel =
    model === configured.model ? configured.fallbackModel : undefined;
  const forceOutage = process.argv.includes("--force-primary-outage");
  if (forceOutage && !fallbackModel)
    throw new Error(
      "Forced outage requires the configured primary and fallback.",
    );
  const sourceHash = createHash("sha256");
  for (const file of [
    "src/lib/zen/agent-policy.ts",
    "tests/fixtures/scope-cases.ts",
    "tests/fixtures/demo-scope-cases.ts",
    "scripts/eval-agent-scope.ts",
  ])
    sourceHash.update(await readFile(file));
  const cases = [...scopeCases, ...demoScopeCases];
  const modelFetch = globalThis.fetch;
  const attempts: { model: string; status: number; simulated: boolean }[] = [];
  globalThis.fetch = async (url, init) => {
    if (
      ![
        "https://openrouter.ai/api/alpha/decisions",
        "https://openrouter.ai/api/v1/chat/completions",
      ].includes(String(url))
    )
      throw new Error("Unexpected eval destination.");
    if (attempts.length >= cases.length * 2)
      throw new Error("Scope eval request ceiling exceeded.");
    const request = JSON.parse(String(init?.body));
    const simulated = forceOutage && request.model === model;
    const response = simulated
      ? new Response(null, { status: 529 })
      : await modelFetch(url, { ...init, redirect: "error" });
    attempts.push({ model: request.model, status: response.status, simulated });
    return response;
  };
  const results = [];
  try {
    for (const entry of cases) {
      const start = performance.now();
      const before = attempts.length;
      const actual = await checkScope(
        entry.messages,
        { key, model, fallbackModel },
        AbortSignal.timeout(20000),
      );
      const latencyMs = Math.round(performance.now() - start);
      const passed = actual === entry.expected;
      results.push({
        id: entry.id,
        expected: entry.expected,
        actual,
        passed,
        latencyMs,
        attempts: attempts.slice(before),
      });
      console.log(
        `${passed ? "PASS" : "FAIL"} ${entry.id}: ${actual} (${latencyMs} ms)`,
      );
    }
  } finally {
    globalThis.fetch = modelFetch;
  }
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    `artifacts/agent-scope-eval-zen-scope-v6-${model.replaceAll(/[^a-zA-Z0-9.-]/g, "-")}${forceOutage ? "-forced-outage" : ""}-${Date.now()}.json`,
    JSON.stringify(
      {
        datasetVersion: "zen-scope-v6",
        sourceHash: sourceHash.digest("hex"),
        at: new Date().toISOString(),
        model,
        fallbackModel,
        forceOutage,
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    `${results.filter((result) => result.passed).length}/${results.length} scope cases passed.`,
  );
  if (results.some((result) => !result.passed)) process.exitCode = 1;
}
void main().catch(() => {
  console.error(
    "Scope evaluation could not finish. Check server credentials and local file access.",
  );
  process.exitCode = 1;
});
