import { type MediaKind } from "@/types/db";
import { classify } from "@/lib/media/accept";
import {
  IMAGE_EXT,
  IMAGE_MIME,
  type ImageFormat,
  VIDEO_MIME,
  type VideoFormat,
  imageFormatFromMime,
  normaliseMime,
  videoFormatFromMime,
} from "@/lib/media/formats";

export interface Describable {
  size: number;
  type: string;
  compressed?: { size: number; format: string } | null;
  needsServer?: boolean;
}

export function classifyUpload(
  file: Describable,
): { kind: MediaKind; ext: string } | null {
  const declared = classify(file.type);
  if (declared) return declared;

  if (file.compressed && !file.needsServer) {
    return {
      kind: "photo",
      ext: IMAGE_EXT[file.compressed.format as ImageFormat],
    };
  }

  return null;
}

export interface StoredObject {
  kind: MediaKind;
  ext: string;
  format: string;
  contentType: string;
  bytes: number;
  useCompressed: boolean;
}

export function decideStoredObject(
  file: Describable,
  classified: { kind: MediaKind; ext: string },
): StoredObject {
  const mime = normaliseMime(file.type);
  const useCompressed =
    classified.kind === "photo" &&
    Boolean(file.compressed) &&
    !file.needsServer;

  if (useCompressed) {
    const format = file.compressed!.format as ImageFormat;
    return {
      kind: classified.kind,
      ext: IMAGE_EXT[format],
      format,
      contentType: IMAGE_MIME[format],
      bytes: file.compressed!.size,
      useCompressed: true,
    };
  }

  const format =
    (classified.kind === "photo"
      ? imageFormatFromMime(mime)
      : videoFormatFromMime(mime)) ?? classified.ext;

  const contentType =
    mime ||
    (classified.kind === "photo"
      ? IMAGE_MIME[format as ImageFormat]
      : VIDEO_MIME[format as VideoFormat]) ||
    "application/octet-stream";

  return {
    kind: classified.kind,
    ext: classified.ext,
    format,
    contentType,
    bytes: file.size,
    useCompressed: false,
  };
}
