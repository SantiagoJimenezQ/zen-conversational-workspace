import { isMockMcp } from "@/lib/zen/integration-mode";
import { Workspace } from "@/components/zen/workspace";
import { mcpConfig } from "@/lib/zen/mcp";
import { providerConfig } from "@/lib/zen/openrouter";

export const dynamic = "force-dynamic";
export default function Home() {
  const mock = isMockMcp();
  const integration = mcpConfig();
  const { configured, model } = providerConfig();
  return (
    <>
      <div
        role="note"
        className="border-b bg-muted px-4 py-2 text-center text-sm"
      >
        {mock
          ? "Zernio MCP is mocked. AI is live: Jev + DeepSeek Flash via OpenRouter. No Zernio charges. Simulation state can reset."
          : integration.account
            ? "Local real-account mode · Zernio MCP uses your server-side key. Reviewed actions can incur provider charges."
            : "Local real-account mode · Add your Zernio key and enable account access in .env.local. No mock fallback."}
      </div>
      <Workspace
        configured={configured}
        model={model}
        integration={integration}
      />
    </>
  );
}
