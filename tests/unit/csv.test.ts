import { describe, expect, it } from "vitest";
import { CSV_COLUMNS, csvCell, csvFileName, issuesToCsv, slugify, toCsv } from "@/lib/issues/csv";
import { cleanDescription, cleanProjectName, cleanTitle, TEXT_LIMITS } from "@/lib/issues/sanitize";
import { makeIssue } from "./helpers/issues";

describe("CSV formatting (AC-09)", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a, b")).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line 1\nline 2")).toBe('"line 1\nline 2"');
    expect(csvCell(42)).toBe("42");
  });

  it("defuses spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-cmd")).toBe("'-cmd");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("starts with a BOM and uses CRLF line endings", () => {
    const csv = toCsv([["a", "b"], ["1", "2"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿a,b\r\n1,2\r\n");
  });

  it("exports the PRD columns with the current issue data", () => {
    const issue = makeIssue({
      reviewState: "Confirmed",
      bugNumber: 12,
      title: "Hero heading, smaller than design",
      description: "Check the font size.\nAnd the spacing.",
      severity: "High",
      status: "In Progress",
      region: { x: 40, y: 96, width: 484, height: 44 },
    });
    const csv = issuesToCsv([issue], new Map([["cmp-1", { projectName: "Arnifi Homepage QA" }]]));
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe(CSV_COLUMNS.join(","));
    expect(lines[1]).toBe(
      'Arnifi Homepage QA,BUG-12,"Hero heading, smaller than design","Check the font size.\nAnd the spacing.",High,In Progress,"x 40, y 96, width 484, height 44",2026-10-22T10:00:00.000Z',
    );
  });

  it("builds a readable file name", () => {
    expect(slugify("Arnifi Homepage QA — v2!")).toBe("arnifi-homepage-qa-v2");
    expect(slugify("***")).toBe("design-qa");
    expect(csvFileName("Arnifi Homepage QA", new Date("2026-10-22T09:00:00Z"))).toBe("arnifi-homepage-qa-design-issues-2026-10-22.csv");
  });
});

describe("text sanitising", () => {
  it("strips control characters and bidi overrides", () => {
    expect(cleanTitle("Hero\u0000 heading‮")).toBe("Hero heading");
  });

  it("keeps paragraphs in descriptions but not in titles", () => {
    expect(cleanDescription("  one\r\n\r\n\r\n\r\ntwo  ")).toBe("one\n\ntwo");
    expect(cleanTitle("one\ntwo")).toBe("one two");
  });

  it("caps lengths", () => {
    expect(cleanProjectName("x".repeat(200))).toHaveLength(TEXT_LIMITS.projectName);
  });
});
