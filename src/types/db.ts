/**
 * Hand-maintained mirror of supabase/migrations. Regenerate with `supabase gen types
 * typescript` once a project is linked.
 */

import { type GalleryLayout } from "@/constants/gallery";
import type { LegacyProductId, PurchasableId } from "@/lib/tiers";

export type EventStatus = "active" | "expired" | "deleted";
export type MediaStatus = "pending" | "ready" | "deleted";
export type MediaKind = "photo" | "video";
export type MediaProcessing = "done" | "pending" | "failed";
export type MediaSource = "guest" | "cover";
export type ReviewState = "approved" | "held" | "reported";
export type ModerationLabelRecord = {
  name: string;
  confidence: number;
  parent?: string;
};
/**
 * Wider than what can be bought: `keep_forever` was withdrawn but rows still hold it.
 */
export type Product = PurchasableId | LegacyProductId;

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type EventRow = {
  id: string;
  owner_id: string;
  name: string;
  retention_from: string;
  tier: string;
  /** Legacy, and honoured for as long as a row has it set. */
  keep_forever: boolean;
  storage_quota_bytes: number;
  storage_used_bytes: number;
  expires_at: string | null;
  status: EventStatus;
  gallery_visible: boolean;
  require_approval: boolean;
  auto_scan: boolean;
  gallery_layout: GalleryLayout;
  theme: string;
  theme_custom: unknown;
  theme_font: string;
  cover_variant: string;
  cover_position: string;
  upload_variant: string;
  cover_media_id: string | null;
  link_opens: number;
  archive_key: string | null;
  archive_built_at: string | null;
  archive_size_bytes: number | null;
  archive_builds: number;
  warned_at_days: number | null;
  deleted_at: string | null;
  created_at: string;
};

export type EventTokenRow = {
  id: string;
  event_id: string;
  token_hash: string;
  token_cipher: string | null;
  label: string | null;
  revoked: boolean;
  created_at: string;
};

export type MediaRow = {
  id: string;
  event_id: string;
  /** Filled by a trigger from events.owner_id, so it is never part of an insert. */
  owner_id: string;
  media_key: string;
  /**
   * Null on a video, whose poster frame does this job, and on rows before migration
   * 0016.
   */
  thumb_key: string | null;
  poster_key: string | null;
  size_bytes: number;
  thumb_size_bytes: number;
  poster_size_bytes: number;
  media_format: string | null;
  thumb_format: string | null;
  duration_seconds: number | null;
  processing: MediaProcessing;
  mime_type: string;
  kind: MediaKind;
  width: number | null;
  height: number | null;
  uploader_fingerprint: string | null;
  // Has a database default of 'guest', so an insert may leave it out.
  source: MediaSource;
  review_state: ReviewState;
  moderation_labels: ModerationLabelRecord[] | null;
  moderated_at: string | null;
  reported_at: string | null;
  report_count: number;
  status: MediaStatus;
  created_at: string;
  taken_at: string | null;
  // `taken_at`, or `created_at` when there is none. Generated; see 0024.
  sort_taken_at: string;
};

export type ReservedMedia = {
  kind: MediaKind;
  mime_type: string;
  media_format: string | null;
  thumb_format: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  processing: MediaProcessing;
  uploader_fingerprint: string | null;
  taken_at?: string | null;
};

export type UploadReservationRow = {
  id: string;
  event_id: string;
  owner_id: string;
  media_key: string;
  thumb_key: string | null;
  poster_key: string | null;
  size_bytes: number;
  thumb_size_bytes: number;
  poster_size_bytes: number;
  media: ReservedMedia;
  created_at: string;
};

export type PurchaseStatus = "paid" | "refunded" | "expired" | "failed";

export type PurchaseRow = {
  id: string;
  event_id: string | null;
  owner_id: string | null;
  provider: string;
  provider_txn_id: string;
  order_id: string | null;
  subscription_id: string | null;
  product: Product;
  amount_cents: number | null;
  currency: string | null;
  status: PurchaseStatus;
  raw: unknown;
  created_at: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      events: Table<
        EventRow,
        Omit<
          EventRow,
          | "id"
          | "created_at"
          | "link_opens"
          | "archive_builds"
          // Have database defaults, so an insert may leave them out.
          | "gallery_layout"
          | "theme"
          | "theme_custom"
          | "theme_font"
          | "cover_variant"
          | "cover_position"
          | "upload_variant"
          | "require_approval"
          | "auto_scan"
        > &
          Partial<
            Pick<
              EventRow,
              | "id"
              | "created_at"
              | "gallery_layout"
              | "theme"
              | "theme_custom"
              | "theme_font"
              | "cover_variant"
              | "cover_position"
              | "upload_variant"
              | "require_approval"
              | "auto_scan"
            >
          >
      >;
      event_tokens: Table<
        EventTokenRow,
        Omit<EventTokenRow, "id" | "created_at" | "revoked"> &
          Partial<Pick<EventTokenRow, "revoked">>
      >;
      media: Table<
        MediaRow,
        Omit<
          MediaRow,
          | "id"
          | "created_at"
          // Derived by trigger from events.owner_id, so the type refuses it outright.
          | "owner_id"
          // Have database defaults, so an insert may leave them out.
          | "thumb_size_bytes"
          | "poster_size_bytes"
          | "processing"
          | "source"
          | "review_state"
          | "moderation_labels"
          | "moderated_at"
          | "reported_at"
          | "report_count"
          | "taken_at"
          // Generated from taken_at and created_at; see migration 0024.
          | "sort_taken_at"
        > &
          Partial<
            Pick<
              MediaRow,
              | "id"
              | "taken_at"
              | "thumb_size_bytes"
              | "poster_size_bytes"
              | "processing"
              | "source"
              | "review_state"
              | "moderation_labels"
              | "moderated_at"
              | "reported_at"
              | "report_count"
            >
          >
      >;
      upload_reservations: Table<
        UploadReservationRow,
        Omit<
          UploadReservationRow,
          "created_at" | "thumb_size_bytes" | "poster_size_bytes"
        > &
          Partial<
            Pick<UploadReservationRow, "thumb_size_bytes" | "poster_size_bytes">
          >
      >;
      purchases: Table<
        PurchaseRow,
        Omit<PurchaseRow, "id" | "created_at" | "status"> &
          Partial<Pick<PurchaseRow, "status">>
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      reserve_storage: {
        Args: { p_event: string; p_bytes: number };
        Returns: boolean;
      };
      release_storage: {
        Args: { p_event: string; p_bytes: number };
        Returns: undefined;
      };
      increment_link_opens: {
        Args: { p_event: string };
        Returns: undefined;
      };
      event_stats: {
        Args: { p_event: string };
        Returns: {
          photo_count: number;
          video_count: number;
          uploader_count: number;
          bytes: number;
        }[];
      };
      event_media_count: {
        Args: { p_event: string };
        // bigint, which supabase-js hands back as a number at these sizes.
        Returns: number;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
