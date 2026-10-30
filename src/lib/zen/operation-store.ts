import "server-only";
import { previewState } from "./preview-session";
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
export async function ledgerTransaction<T>(
  change: (ledger: Ledger) => T | Promise<T>,
): Promise<T> {
  const state = previewState();
  const previous = state.queue;
  let release!: () => void;
  state.queue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    if (state.ledger.operations.length >= 200)
      throw new Error(
        "This simulation has reached its action limit. Start a fresh session later.",
      );
    return await change(state.ledger);
  } finally {
    release();
  }
}
