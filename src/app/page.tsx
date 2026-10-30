import { Workspace } from "@/components/zen/workspace";
import { mcpConfig } from "@/lib/zen/mcp";
import { providerConfig } from "@/lib/zen/openrouter";

export const dynamic = "force-dynamic";
export default function Home() {
  const { configured, model } = providerConfig();
  return (
    <>
      <div
        role="note"
        className="border-b bg-muted px-4 py-2 text-center text-sm"
      >
        Zernio MCP is mocked. AI is live: Jev + DeepSeek Flash via OpenRouter.
        No Zernio charges. Simulation state can reset.
      </div>
      <Workspace
        configured={configured}
        model={model}
        integration={mcpConfig()}
      />
    </>
  );
}
