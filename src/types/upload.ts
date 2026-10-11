import type { Stages } from "@/lib/client/progress";

export type ItemStatus =
  | "waiting"
  | "preparing"
  | "uploading"
  | "done"
  | "failed"
  | "skipped";

/** One file in the upload queue, and how far along it is. */
export interface Item {
  key: string;
  file: File;
  status: ItemStatus;
  stages: Stages;
  error?: string;
}

/** Compressing, or sending. The queue does one kind at a time. */
export type Phase = "preparing" | "uploading";

export interface UploadQueueOptions {
  token: string;
  maxFileBytes: number;
  remainingBytes: number;
  onUploaded: () => void;
}

export interface FilePicker {
  inputRef: React.RefObject<HTMLInputElement | null>;
  open: () => void;
}
