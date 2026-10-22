import { readDimensions } from "./decode";
import { checkDimensions, checkFile, readHeaderSize, type FileProblem, type ImageFormat } from "./validate";

/* Upload-time checks (PRD Stage A): real format, size, decodability and pixel limits — before anything is compared. */

export interface UploadedImage {
  file: File;
  /** Object URL for the preview; revoke it when the image is replaced or removed. */
  url: string;
  width: number;
  height: number;
  format: ImageFormat;
}

export type InspectResult = { ok: true; image: UploadedImage } | { ok: false; problem: FileProblem };

/** Enough bytes to reach a JPEG's frame header past large EXIF/ICC blocks. */
const HEADER_BYTES = 256 * 1024;

export async function inspectImage(file: File): Promise<InspectResult> {
  const head = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  const check = checkFile(file, head);
  if (!check.ok) return check;

  // Reject oversized images from the header alone, before an expensive decode.
  const declared = readHeaderSize(head, check.format);
  const early = declared && checkDimensions(declared.width, declared.height);
  if (early) return { ok: false, problem: early };

  let size: { width: number; height: number };
  try {
    size = await readDimensions(file);
  } catch {
    return {
      ok: false,
      problem: { code: "unreadable", message: "This image couldn't be opened — it may be damaged.", action: "Export or capture it again, then upload the new file." },
    };
  }
  const problem = checkDimensions(size.width, size.height);
  if (problem) return { ok: false, problem };

  return { ok: true, image: { file, url: URL.createObjectURL(file), width: size.width, height: size.height, format: check.format } };
}

/** A pasted clipboard image has no useful name; give it one so the file list stays readable. */
export function nameClipboardFile(file: File, slot: string): File {
  if (file.name && file.name !== "image.png") return file;
  const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
  return new File([file], `${slot}-pasted.${ext}`, { type: file.type || "image/png", lastModified: Date.now() });
}
