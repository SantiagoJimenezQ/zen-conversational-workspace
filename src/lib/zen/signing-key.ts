import "server-only";
import { randomBytes } from "node:crypto";

// Route bundles share the fallback within one local process. Serverless deployments
// require a configured key so independently started instances verify the same receipts.
const local = globalThis as typeof globalThis & {
  __zenDemoSigningKey?: Buffer;
};
const configured = process.env.DEMO_SIGNING_SECRET;
if (process.env.VERCEL === "1" && (!configured || configured.length < 32)) {
  throw new Error(
    "The demo signing secret must be configured before deployment.",
  );
}
export const demoSigningKey = configured
  ? Buffer.from(configured)
  : (local.__zenDemoSigningKey ??= randomBytes(32));
