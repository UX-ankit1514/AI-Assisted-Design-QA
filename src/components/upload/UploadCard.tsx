"use client";

import { CircleAlert, ClipboardPaste, ImageUp, RefreshCw, Trash2 } from "lucide-react";
import { useId, useRef, useState, type DragEvent, type ClipboardEvent, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import type { UploadedImage } from "@/lib/engine/inspect";
import { ACCEPT_ATTRIBUTE, formatBytes, type FileProblem } from "@/lib/engine/validate";
import { cn } from "@/lib/cn";

/*
 * Screenshot uploader (PRD §7 Screen 1): large drop area, browse, or paste (Figma "Copy as PNG" → ⌘V).
 * Shows filename, preview, dimensions and size, with Replace and Remove.
 */

interface UploadCardProps {
  /** "design" or "build" — used for test ids and pasted file names. */
  slot: "design" | "build";
  step: number;
  title: string;
  hint: string;
  image: UploadedImage | null;
  problem: FileProblem | null;
  busy: boolean;
  disabled: boolean;
  isSample: boolean;
  /** Highlights the card when its dimensions don't match the other one. */
  mismatch: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}

export function UploadCard({ slot, step, title, hint, image, problem, busy, disabled, isSample, mismatch, onFile, onRemove }: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const titleId = useId();
  const statusId = useId();

  function browse() {
    if (!disabled) inputRef.current?.click();
  }

  function takeFirst(files: FileList | null | undefined) {
    const file = files?.[0];
    if (file) onFile(file);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (!disabled) takeFirst(event.dataTransfer.files);
  }

  function onPaste(event: ClipboardEvent) {
    if (disabled) return;
    const file = [...event.clipboardData.items].find((item) => item.kind === "file")?.getAsFile();
    if (file) {
      event.preventDefault();
      onFile(file);
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      browse();
    }
  }

  return (
    <section aria-labelledby={titleId} data-testid={`upload-${slot}`} className="flex min-w-0 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={titleId} className="flex items-baseline gap-2 text-p2 font-semibold text-ink">
          <span aria-hidden className="flex size-6 shrink-0 items-center justify-center self-center rounded-full bg-arnique-200 text-p4 font-semibold text-arnique-900">
            {step}
          </span>
          {title}
        </h3>
        {isSample && image && <Badge tone="warning">Sample data</Badge>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid={`file-${slot}`}
        onChange={(event) => {
          takeFirst(event.target.files);
          event.target.value = "";
        }}
      />

      {image ? (
        <div className={cn("overflow-hidden rounded-card border bg-white", mismatch ? "border-ruby-500" : "border-line")} onPaste={onPaste}>
          <div className="checkerboard relative flex h-56 items-start justify-center overflow-hidden border-b border-line">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img src={image.url} alt={`Preview of ${image.file.name}`} className="w-full object-cover object-top" draggable={false} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-p3 font-medium text-ink" title={image.file.name}>
                {image.file.name}
              </p>
              <p className={cn("text-p4 tabular-nums", mismatch ? "font-medium text-ruby-700" : "text-muted")} data-testid={`dims-${slot}`}>
                {image.width} × {image.height} px · {formatBytes(image.file.size)} · {image.format.toUpperCase()}
              </p>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={browse}
                disabled={disabled}
                className="flex min-h-10 items-center gap-1.5 rounded-control px-3 text-p3 font-medium text-brand transition-colors hover:bg-arnique-100 disabled:text-dusk-500 disabled:hover:bg-transparent"
              >
                <RefreshCw aria-hidden className="size-4" />
                Replace
              </button>
              <button
                type="button"
                onClick={onRemove}
                disabled={disabled}
                aria-label={`Remove ${title.toLowerCase()}`}
                className="flex size-10 items-center justify-center rounded-control text-muted transition-colors hover:bg-ruby-100 hover:text-ruby-700 disabled:text-dusk-500 disabled:hover:bg-transparent"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled || undefined}
          aria-describedby={statusId}
          aria-label={`${title}: drop, paste or browse for an image`}
          onClick={browse}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "group flex h-[19.25rem] cursor-pointer flex-col items-center justify-center gap-3 rounded-card border-[1.5px] border-dashed px-6 text-center transition-colors",
            dragging ? "border-brand bg-arnique-100" : problem ? "border-ruby-500 bg-ruby-100/40" : "border-dusk-400 bg-white hover:border-arnique-600 hover:bg-arnique-100/60",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <span aria-hidden className="flex size-12 items-center justify-center rounded-tile bg-arnique-200 text-arnique-900 transition-transform group-hover:-translate-y-0.5">
            <ImageUp className="size-6" />
          </span>
          <div>
            <p className="text-p2 font-semibold text-ink">{busy ? "Checking image…" : dragging ? "Drop to upload" : "Drop a screenshot here"}</p>
            <p className="mt-1 text-p3 text-muted">
              or <span className="font-medium text-brand underline-offset-4 group-hover:underline">browse files</span>
            </p>
          </div>
          <p className="flex items-center gap-1.5 text-p4 text-muted">
            <ClipboardPaste aria-hidden className="size-3.5" />
            Click here, then paste with ⌘V / Ctrl+V
          </p>
          <p className="text-p4 text-dusk-600">{hint}</p>
        </div>
      )}

      <div id={statusId} aria-live="polite">
        {problem && (
          <p className="flex items-start gap-1.5 text-p3 text-ruby-700" data-testid={`error-${slot}`}>
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              {problem.message} <span className="text-ink">{problem.action}</span>
            </span>
          </p>
        )}
      </div>
    </section>
  );
}
