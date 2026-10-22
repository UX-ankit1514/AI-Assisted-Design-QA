import type { Metadata } from "next";
import { BugTracker } from "@/components/tracker/BugTracker";
import { parseStatus } from "@/lib/store/types";

export const metadata: Metadata = { title: "Design Issues" };

export default async function IssuesPage({ searchParams }: PageProps<"/issues">) {
  const { comparison, status } = await searchParams;
  return <BugTracker initialComparisonId={typeof comparison === "string" ? comparison : undefined} initialStatus={parseStatus(status)} />;
}
