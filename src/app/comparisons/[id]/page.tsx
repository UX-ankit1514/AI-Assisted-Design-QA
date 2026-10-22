import type { Metadata } from "next";
import { Workspace } from "@/components/comparison/Workspace";

export const metadata: Metadata = { title: "Comparison" };

export default async function ComparisonPage({ params, searchParams }: PageProps<"/comparisons/[id]">) {
  const { id } = await params;
  const { issue } = await searchParams;
  return <Workspace id={id} initialIssueId={typeof issue === "string" ? issue : undefined} />;
}
