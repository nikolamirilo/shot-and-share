import "server-only";

import { hasS3 } from "@/lib/env";
import { localDriver } from "@/lib/storage/local";
import { s3Driver } from "@/lib/storage/s3";
import type { StorageDriver } from "@/lib/storage/types";

/**
 * S3 when it is configured, the filesystem otherwise. The rest of the
 * application never asks which one it got.
 */
export const storage: StorageDriver = hasS3 ? s3Driver : localDriver;

export type { PresignedUpload, StorageDriver } from "@/lib/storage/types";
