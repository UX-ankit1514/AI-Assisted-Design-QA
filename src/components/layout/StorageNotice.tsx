"use client";

import { HardDrive, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { qaStore } from "@/lib/store/qa-store";
import { useQaState } from "@/lib/store/hooks";

/* Persistence states (PRD §13): storage unavailable, or a save that failed. */
export function StorageNotice() {
  const { persistence, saveError } = useQaState();
  const [hideMemory, setHideMemory] = useState(false);

  if (saveError) {
    return (
      <Banner icon={TriangleAlert} onClose={() => qaStore.dismissSaveError()} closeLabel="Dismiss save warning">
        {saveError}
      </Banner>
    );
  }
  if (persistence === "memory" && !hideMemory) {
    return (
      <Banner icon={HardDrive} onClose={() => setHideMemory(true)} closeLabel="Dismiss storage notice">
        This browser isn&apos;t allowing local storage, so comparisons only last until you refresh or close this tab. Export your issues as CSV
        before you leave.
      </Banner>
    );
  }
  return null;
}

function Banner({ icon: Icon, children, onClose, closeLabel }: { icon: typeof HardDrive; children: React.ReactNode; onClose: () => void; closeLabel: string }) {
  return (
    <div role="status" className="flex items-start gap-3 border-b border-tang-200 bg-tang-100 px-4 py-2.5 text-p3 text-tang-800 md:px-6">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1">{children}</p>
      <button type="button" onClick={onClose} aria-label={closeLabel} className="-my-1.5 flex size-8 shrink-0 items-center justify-center rounded-control hover:bg-tang-200">
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
