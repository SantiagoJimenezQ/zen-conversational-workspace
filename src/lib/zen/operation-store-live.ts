import "server-only";
import {
  mkdir,
  open,
  readFile,
  stat,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
export type Operation = {
  id: string;
  conversationId: string;
  owner: string;
  tool: string;
  title: string;
  args: Record<string, unknown>;
  status:
    | "pending"
    | "blocked"
    | "running"
    | "succeeded"
    | "accepted"
    | "failed"
    | "unknown";
  createdAt: string;
  updatedAt: string;
  costCents: number | null;
  recurringCents: number;
  reason?: string;
  output?: string;
};
export type Ledger = {
  version: 1;
  limitCents: number;
  operations: Operation[];
};
export function committedCents(ledger: Ledger) {
  return ledger.operations
    .filter((o) =>
      ["running", "succeeded", "accepted", "unknown"].includes(o.status),
    )
    .reduce((sum, o) => sum + (o.costCents ?? 0), 0);
}
/** Single-machine durable transactions. Reserve before network I/O; never hold a lock during a provider request. */
export async function ledgerTransaction<T>(
  change: (ledger: Ledger) => T | Promise<T>,
): Promise<T> {
  const dir =
    process.env.ZEN_STATE_DIR || path.join(process.cwd(), ".zen-state");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const lock = path.join(dir, "actions.lock");
  let handle;
  for (let i = 0; i < 60; i++) {
    try {
      handle = await open(lock, "wx", 0o600);
      await handle.writeFile(JSON.stringify({ pid: process.pid }));
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const age = Date.now() - (await stat(lock)).mtimeMs;
        const owner = JSON.parse(await readFile(lock, "utf8"));
        if (age > 30000 && Number.isSafeInteger(owner.pid)) {
          try {
            process.kill(owner.pid, 0);
          } catch (dead) {
            if ((dead as NodeJS.ErrnoException).code === "ESRCH")
              await unlink(lock).catch(() => {});
          }
        }
      } catch {
        /* A competing transaction may have just released its lock. */
      }
      await new Promise((r) => setTimeout(r, 25));
    }
  }
  if (!handle)
    throw new Error("Another action is updating the local ledger. Try again.");
  const file = path.join(dir, "actions.json");
  try {
    let ledger: Ledger;
    try {
      ledger = JSON.parse(await readFile(file, "utf8"));
      if (
        ledger.version !== 1 ||
        !Array.isArray(ledger.operations) ||
        !Number.isSafeInteger(ledger.limitCents) ||
        ledger.limitCents < 0 ||
        ledger.operations.some(
          (o) =>
            !o ||
            ![
              "pending",
              "blocked",
              "running",
              "succeeded",
              "failed",
              "accepted",
              "unknown",
            ].includes(o.status) ||
            (o.costCents !== null &&
              (!Number.isSafeInteger(o.costCents) || o.costCents < 0)) ||
            (["running", "succeeded", "accepted", "unknown"].includes(
              o.status,
            ) &&
              o.costCents === null),
        )
      )
        throw new Error("Invalid operation ledger.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      ledger = { version: 1, limitCents: 500, operations: [] };
    }
    // This demo's authorized cap cannot be increased through an API request or a changed env value.
    ledger.limitCents = Math.min(500, ledger.limitCents);
    const value = await change(ledger);
    const tmp = path.join(dir, `actions-${process.pid}-${Date.now()}.tmp`);
    await writeFile(tmp, JSON.stringify(ledger), { mode: 0o600 });
    await rename(tmp, file);
    return value;
  } finally {
    await handle.close();
    await unlink(lock).catch(() => {});
  }
}
