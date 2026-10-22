"use client";

import { Button, ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { Comparison } from "@/lib/store/types";

/* Noisy-comparison and export-failure states (PRD §13), shown above the viewer. */
export function WorkspaceNotices({ comparison, exportError, onRetryExport, onReveal }: { comparison: Comparison; exportError: boolean; onRetryExport: () => void; onReveal: () => void }) {
  const misaligned = comparison.warnings.find((w) => w.code === "possible-misalignment");
  const broad = comparison.warnings.find((w) => w.code === "broad-difference");
  const limit = comparison.warnings.find((w) => w.code === "region-limit");
  if (!misaligned && !broad && !limit && !exportError) return null;

  return (
    <div className="flex flex-col gap-2 border-b border-line bg-white px-4 py-3 md:px-6" data-testid="workspace-notices">
      {exportError && (
        <Notice
          tone="error"
          role="alert"
          title="The CSV couldn't be downloaded"
          action={
            <Button size="m" variant="tertiary" onClick={onRetryExport}>
              Try Again
            </Button>
          }
        >
          Your browser blocked the download. Check that downloads are allowed for this site, then try again.
        </Notice>
      )}
      {misaligned && (
        <Notice
          tone="warning"
          role="status"
          title={comparison.regionsRevealed ? "These screenshots may not be aligned" : "The screenshots look misaligned"}
          action={
            comparison.regionsRevealed ? undefined : (
              <>
                <Button size="m" variant="secondary" onClick={onReveal}>
                  Review Regions Anyway
                </Button>
                <ButtonLink href="/" size="m" variant="tertiary">
                  Recapture and Compare Again
                </ButtonLink>
              </>
            )
          }
        >
          <span data-testid="misalignment-warning">{misaligned.message}</span>
          {!comparison.regionsRevealed && ` We've held back the ${comparison.candidateCount} highlighted regions so they aren't mistaken for bugs.`}
        </Notice>
      )}
      {broad && (
        <Notice tone="warning" role="status" title="Most of the image is different">
          {broad.message}
        </Notice>
      )}
      {limit && (
        <Notice tone="info" role="status">
          {limit.message}
        </Notice>
      )}
    </div>
  );
}
