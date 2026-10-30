"use client";
import { ChevronDown, ExternalLink } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { sources } from "@/lib/zen/sources";
import type { SourceId } from "@/lib/zen/schema";

export function SourceDisclosure({ ids }: { ids: SourceId[] }) {
  if (!ids.length) return null;
  return (
    <Collapsible className="source-disclosure">
      <CollapsibleTrigger>
        <ChevronDown />
        <span>
          {ids.length} {ids.length === 1 ? "source" : "sources"}
        </span>
        <span className="source-preview">
          ·{" "}
          {ids
            .slice(0, 2)
            .map((id) => sources[id].title)
            .join(" · ")}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="source-list">
          {ids.map((id) => (
            <a key={id} href={sources[id].url} target="_blank" rel="noreferrer">
              <span>
                {sources[id].title}
                <small>Official documentation · Curated 30 Oct 2026</small>
              </span>
              <ExternalLink />
            </a>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
