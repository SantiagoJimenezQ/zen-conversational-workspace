import { isMockMcp } from "@/lib/zen/integration-mode";
import { Workspace } from "@/components/zen/workspace";
import { mcpConfig } from "@/lib/zen/mcp";
import { providerConfig } from "@/lib/zen/openrouter";
import { HowItWorks } from "@/components/zen/how-it-works";

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
          ? "Zernio MCP is mocked. Live chat uses Jev + DeepSeek Flash via OpenRouter. No Zernio charges. Simulation state can reset."
          : integration.account
            ? "Local real-account mode · Zernio MCP uses your server-side key. Reviewed actions can incur provider charges."
            : "Local real-account mode · Add your Zernio key and enable account access in .env.local. No mock fallback."}{" "}
        <a
          href="https://github.com/SantiagoJimenezQ/zen-conversational-workspace"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-sm font-medium text-foreground underline underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          View source on GitHub
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <HowItWorks mock={mock} />
      </div>
      <Workspace
        configured={configured}
        model={model}
        integration={integration}
      />
    </>
  );
}
