import type { MediaKind } from "@/lib/db/types";
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

/** The subset of the request body that decides what gets stored. */
export interface Describable {
  size: number;
  type: string;
  compressed?: { size: number; format: string } | null;
  needsServer?: boolean;
}

/**
 * What this upload is, from the best evidence available rather than from the
 * MIME type alone.
 *
 * The MIME type a file picker reports is not reliable and never was. Android
 * and Windows commonly report nothing at all for HEIC, some pickers say
 * `image/jpg`, and a file dragged in from a file manager can arrive with an
 * empty type on every platform. Refusing those was refusing photographs: the
 * browser had already decoded them and handed us a WebP to store, and the
 * request was turned away on a header describing a file we were not going to
 * upload anyway.
 *
 * So a compressed rendition settles it. The browser cannot produce one without
 * having decoded an image, and the source type is not used past this point.
 */
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
  /** Send the compressed copy rather than the file off the disk. */
  useCompressed: boolean;
}

/**
 * The one object this upload keeps.
 *
 * A photo is stored compressed whenever the browser managed it - the phone
 * never uploads the 4 MB original at all, which is a quarter of the storage and
 * a quarter of the wait on venue wifi. Nobody is asked to choose, because "keep
 * every original byte" is a setting whose only effect is a bill four times
 * larger for a difference nobody can see on a screen.
 *
 * The exception is a file the browser could not decode, chiefly HEIC outside
 * Safari. That goes up as it came off the phone and the worker replaces the
 * object with a compressed JPEG a minute later.
 */
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

  /*
   * The passthrough path falls back to the type the extension implies. It signs
   * a policy condition and is written onto the object, so an empty string here
   * would sign a URL nothing can be posted to and store a photo the gallery
   * then serves as `application/octet-stream`.
   */
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
