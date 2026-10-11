import "server-only";

import { hasS3 } from "@/lib/env";
import { localDriver } from "@/lib/storage/local";
import { s3Driver } from "@/lib/storage/s3";
import type { StorageDriver } from "@/lib/storage/types";

export const storage: StorageDriver = hasS3 ? s3Driver : localDriver;

export type { PresignedUpload, StorageDriver } from "@/lib/storage/types";
