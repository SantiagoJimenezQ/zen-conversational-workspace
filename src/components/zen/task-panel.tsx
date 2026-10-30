import { Check, ChevronDown, Circle, CircleCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Artifact } from "@/lib/zen/schema";

export function TaskPanel({
  artifact,
  onCollapse,
}: {
  artifact: Artifact;
  onCollapse?: () => void;
}) {
  const stage =
    artifact.kind === "result" ? 4 : artifact.kind === "quote" ? 2 : 1;
  const cancelled = artifact.kind === "cancelled";
  const label = cancelled
    ? "Cancelled"
    : stage === 4
      ? "Demo completed"
      : stage === 2
        ? "Ready for review"
        : "Ready to search";
  return (
    <section className="task-details" aria-label="Setup progress">
      <div className="task-label">
        <h2>Current task</h2>
        {onCollapse && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Collapse task panel"
            onClick={onCollapse}
          >
            <ChevronDown />
          </Button>
        )}
      </div>
      <p className="task-name">Polish phone number</p>
      <Badge variant="secondary">{label}</Badge>
      <dl className="task-properties">
        <div>
          <dt>Profile</dt>
          <dd>Default</dd>
        </div>
        <div>
          <dt>Country</dt>
          <dd>Poland</dd>
        </div>
      </dl>
      <Separator />
      <p className="progress-label">Progress</p>
      <ol className="task-steps">
        {[
          "Use case defined",
          "Check availability",
          "Review requirements",
          "Confirm selection",
        ].map((step, i) => (
          <li
            key={step}
            className={cn(
              i < stage && "step-complete",
              i === stage && !cancelled && "step-current",
            )}
            aria-current={i === stage && !cancelled ? "step" : undefined}
          >
            <span className="step-marker">
              {i < stage ? <CircleCheck /> : <Circle />}
              {i < stage && <Check className="step-check" />}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <Separator />
      <p className="task-note">
        {stage === 4
          ? "Demo completed. No real number was purchased."
          : cancelled
            ? "Setup cancelled. Nothing changed in your account."
            : "No number has been purchased."}
      </p>
    </section>
  );
}
