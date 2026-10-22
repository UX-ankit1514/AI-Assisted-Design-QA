import { PIPELINE_ERROR_COPY, PipelineError, processComparison, type PipelineErrorCode, type PipelineOutput, type PipelineStage } from "./pipeline";
import type { Sensitivity } from "./types";

type WorkerMessage =
  | { type: "stage"; stage: PipelineStage }
  | { type: "progress"; fraction: number }
  | { type: "done"; output: PipelineOutput }
  | { type: "error"; code: PipelineErrorCode; message: string };

/**
 * Runs a comparison in a Web Worker, falling back to the main thread if workers aren't available.
 * Screenshots never leave the browser (AC-10).
 */
export function runComparison(
  design: Blob,
  build: Blob,
  sensitivity: Sensitivity,
  onStage: (stage: PipelineStage) => void,
  onProgress: (fraction: number) => void = () => {},
): Promise<PipelineOutput> {
  let worker: Worker;
  try {
    worker = new Worker(new URL("./compare.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return processComparison(design, build, sensitivity, onStage, onProgress);
  }

  return new Promise((resolve, reject) => {
    let started = false;
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === "stage") {
        started = true;
        onStage(message.stage);
        return;
      }
      if (message.type === "progress") {
        onProgress(message.fraction);
        return;
      }
      worker.terminate();
      if (message.type === "done") resolve(message.output);
      else reject(new PipelineError(message.code, message.message || PIPELINE_ERROR_COPY[message.code]));
    };
    worker.onerror = (event) => {
      event.preventDefault();
      worker.terminate();
      // A worker that failed to load never started; run the same job on the main thread instead.
      if (!started) processComparison(design, build, sensitivity, onStage, onProgress).then(resolve, reject);
      else reject(new PipelineError("unknown", PIPELINE_ERROR_COPY.unknown));
    };
    worker.postMessage({ design, build, sensitivity });
  });
}
