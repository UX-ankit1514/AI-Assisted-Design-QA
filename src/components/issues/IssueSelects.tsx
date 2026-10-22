"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { statusOptions } from "@/lib/issues/workflow";
import { cn } from "@/lib/cn";
import { qaStore } from "@/lib/store/qa-store";
import { SEVERITIES, type Issue } from "@/lib/store/types";
import { Dot, SEVERITY_STYLE, STATUS_STYLE } from "./badges";

const trigger = "h-10 w-full min-w-36 bg-white text-p3 data-[size=sm]:h-9";

/* Status picker that only offers valid moves — Verified only appears once an issue is Fixed. */
export function StatusSelect({ issue, size = "default", className }: { issue: Issue; size?: "sm" | "default"; className?: string }) {
  return (
    <Select value={issue.status} onValueChange={(value) => qaStore.setStatus(issue.id, value as Issue["status"])}>
      <SelectTrigger size={size} aria-label={`Status of ${issue.title}`} className={cn(trigger, className)} data-testid="status-select">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statusOptions(issue.status).map((status) => (
          <SelectItem key={status} value={status}>
            <Dot className={STATUS_STYLE[status].dot} />
            {status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SeveritySelect({ issue, size = "default", className }: { issue: Issue; size?: "sm" | "default"; className?: string }) {
  return (
    <Select value={issue.severity} onValueChange={(value) => qaStore.edit(issue.id, { severity: value as Issue["severity"] })}>
      <SelectTrigger size={size} aria-label={`Severity of ${issue.title}`} className={cn(trigger, className)} data-testid="severity-select">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SEVERITIES.map((severity) => (
          <SelectItem key={severity} value={severity}>
            <Dot className={SEVERITY_STYLE[severity].dot} />
            {severity}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
