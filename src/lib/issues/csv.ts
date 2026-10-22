import type { Comparison, Issue } from "@/lib/store/types";
import { displayId } from "@/lib/store/types";

/* CSV export (PRD Step 8). RFC 4180, UTF-8 with BOM so Excel opens accents correctly, CRLF line endings. */

export const CSV_COLUMNS = ["Project name", "Issue ID", "Issue title", "Description", "Severity", "Status", "Region coordinates", "Created date"] as const;

/**
 * Quotes a cell when needed and defuses spreadsheet formulas: a cell that starts with = + - @ or a tab/CR
 * is prefixed with an apostrophe so Excel and Sheets show it as text instead of running it.
 */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text) || /^\s|\s$/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function formatRegion(r: Issue["region"]): string {
  return `x ${r.x}, y ${r.y}, width ${r.width}, height ${r.height}`;
}

export function issuesToCsv(issues: readonly Issue[], comparisons: ReadonlyMap<string, Pick<Comparison, "projectName">>): string {
  const rows = issues.map((issue) => [
    comparisons.get(issue.comparisonId)?.projectName ?? "",
    displayId(issue),
    issue.title,
    issue.description,
    issue.severity,
    issue.status,
    formatRegion(issue.region),
    issue.createdAt,
  ]);
  return toCsv([CSV_COLUMNS, ...rows]);
}

export function slugify(text: string): string {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "design-qa"
  );
}

export function csvFileName(scope: string, date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  return `${slugify(scope)}-design-issues-${day}.csv`;
}
