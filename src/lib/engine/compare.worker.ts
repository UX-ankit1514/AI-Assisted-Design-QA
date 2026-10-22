import { PipelineError, processComparison } from "./pipeline";
import type { Sensitivity } from "./types";

/* Runs the comparison off the main thread so a 12 MP pair doesn't freeze the page. */

export interface WorkerRequest {
  design: Blob;
  build: Blob;
  sensitivity: Sensitivity;
}

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: unknown) => void;
};

scope.onmessage = async (event) => {
  const { design, build, sensitivity } = event.data;
  try {
    let reported = -1;
    const output = await processComparison(
      design,
      build,
      sensitivity,
      (stage) => scope.postMessage({ type: "stage", stage }),
      (fraction) => {
        // Whole percents only — enough for the progress label without flooding the main thread.
        const percent = Math.floor(fraction * 100);
        if (percent !== reported) {
          reported = percent;
          scope.postMessage({ type: "progress", fraction });
        }
      },
    );
    scope.postMessage({ type: "done", output });
  } catch (error) {
    const code = error instanceof PipelineError ? error.code : "unknown";
    const message = error instanceof PipelineError ? error.message : "";
    scope.postMessage({ type: "error", code, message });
  }
};
