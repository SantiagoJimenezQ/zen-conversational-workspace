import "server-only";
import { z } from "zod";
const metadata = z.object({
  data: z.object({
    limit: z.number().positive().max(10),
    limit_reset: z.null(),
    limit_remaining: z.number().positive(),
    is_management_key: z.literal(false).optional(),
    include_byok_in_limit: z.literal(true),
  }),
});
export function validPreviewBudget(value: unknown) {
  return metadata.safeParse(value).success;
}
export async function assertPreviewBudget(signal: AbortSignal) {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key)
    throw new Error("Live AI is unavailable. You can use the offline demo.");
  const response = await fetch("https://openrouter.ai/api/v1/key", {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
  });
  if (!response.ok)
    throw new Error(
      "The preview budget couldn’t be verified. Please try again or use the offline demo.",
    );
  const data: unknown = await response.json();
  if (!validPreviewBudget(data))
    throw new Error(
      "The live preview budget is unavailable. You can still explore the offline demo.",
    );
}
