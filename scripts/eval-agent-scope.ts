import { mkdir, writeFile } from "node:fs/promises";
import { checkScope, scopeConfig } from "../src/lib/zen/agent-policy";
import { scopeCases } from "../tests/fixtures/scope-cases";

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
  const model = process.env.SCOPE_EVAL_MODEL?.trim() || scopeConfig().model;
  const results = [];
  for (const entry of scopeCases) {
    const start = performance.now();
    const actual = await checkScope(
      entry.messages,
      { key, model },
      new AbortController().signal,
    );
    const latencyMs = Math.round(performance.now() - start);
    const passed = actual === entry.expected;
    results.push({
      id: entry.id,
      expected: entry.expected,
      actual,
      passed,
      latencyMs,
    });
    console.log(
      `${passed ? "PASS" : "FAIL"} ${entry.id}: ${actual} (${latencyMs} ms)`,
    );
  }
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    `artifacts/agent-scope-eval-${model.replaceAll(/[^a-zA-Z0-9.-]/g, "-")}.json`,
    JSON.stringify({ at: new Date().toISOString(), model, results }, null, 2),
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
