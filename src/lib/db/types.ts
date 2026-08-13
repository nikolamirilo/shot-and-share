/**
 * Hand-maintained mirror of supabase/migrations. Regenerate with
 * `supabase gen types typescript` once a project is linked; until then this is
 * the contract the application codes against.
 */

import type { GalleryLayout } from "@/lib/gallery";
import type { PurchasableId, TierId } from "@/lib/tiers";

export type EventStatus = "active" | "expired" | "deleted";
export type MediaStatus = "pending" | "ready" | "deleted";
export type MediaKind = "photo" | "video";
export type MediaProcessing = "done" | "pending" | "failed";
/**
 * Who put the file there. A guest's upload is a photograph of the party; a
 * cover is decoration the host chose, so it is kept out of the gallery, the
 * slideshow, the ZIP and the photo counts. See migration 0013.
 */
export type MediaSource = "guest" | "cover";
/**
 * What the `purchases.product` column records. Historical rows only, so it is
 * the purchasable set and nothing wider.
 */
export type Product = PurchasableId;

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
  event_date: string;
  tier: TierId;
  keep_forever: boolean;
  storage_quota_bytes: number;
  storage_used_bytes: number;
  expires_at: string | null;
  status: EventStatus;
  gallery_visible: boolean;
  gallery_layout: GalleryLayout;
  theme: string;
  theme_custom: unknown;
  theme_font: string;
  cover_variant: string;
  upload_variant: string;
  welcome_message: string | null;
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
  /**
   * Denormalised from events.owner_id and filled by a trigger, so it is never
   * part of an insert. It is what the host RLS policies compare against, and
   * what lets a media row build its own storage keys without a join.
   */
  owner_id: string;
  /**
   * The one stored object: the compressed photo, or the video. Its extension
   * can change when the worker replaces a format the browser could not read,
   * so it is read from here rather than assumed.
   */
  media_key: string;
  /** A video's poster frame. Always null for a photo. */
  poster_key: string | null;
  size_bytes: number;
  poster_size_bytes: number;
  media_format: string | null;
  duration_seconds: number | null;
  processing: MediaProcessing;
  mime_type: string;
  kind: MediaKind;
  width: number | null;
  height: number | null;
  uploader_fingerprint: string | null;
  uploader_name: string | null;
  /** Has a database default of 'guest', so an insert may leave it out. */
  source: MediaSource;
  status: MediaStatus;
  created_at: string;
};

/**
 * The half of a media row that cannot be derived from the reservation's own
 * columns, parked in jsonb until the bytes actually land.
 *
 * It is deliberately not the whole media row: the keys and the byte counts live
 * in real columns because the nightly sweep reads them without knowing anything
 * about what is inside here.
 */
export type ReservedMedia = {
  kind: MediaKind;
  mime_type: string;
  media_format: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  processing: MediaProcessing;
  uploader_fingerprint: string | null;
  uploader_name: string | null;
};

/**
 * Bytes promised to a guest and not yet delivered.
 *
 * One row exists for the seconds between "we signed you a URL and charged your
 * host's quota for it" and "the object is in the bucket". Confirm turns it into
 * a media row; the nightly sweep turns an abandoned one back into free quota.
 */
export type UploadReservationRow = {
  id: string;
  event_id: string;
  owner_id: string;
  media_key: string;
  poster_key: string | null;
  size_bytes: number;
  poster_size_bytes: number;
  media: ReservedMedia;
  created_at: string;
};

export type PurchaseRow = {
  id: string;
  event_id: string | null;
  owner_id: string | null;
  provider: string;
  provider_txn_id: string;
  product: Product;
  amount_cents: number | null;
  currency: string | null;
  status: string;
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
          | "upload_variant"
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
              | "upload_variant"
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
          // Derived by trigger from events.owner_id. Supplying it would be
          // ignored, so the type refuses it outright.
          | "owner_id"
          | "poster_size_bytes"
          | "processing"
          | "source"
        > &
          Partial<
            Pick<MediaRow, "id" | "poster_size_bytes" | "processing" | "source">
          >
      >;
      upload_reservations: Table<
        UploadReservationRow,
        Omit<UploadReservationRow, "created_at" | "poster_size_bytes"> &
          Partial<Pick<UploadReservationRow, "poster_size_bytes">>
      >;
      purchases: Table<
        PurchaseRow,
        Omit<PurchaseRow, "id" | "created_at">
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
        /** bigint, which supabase-js hands back as a number at these sizes. */
        Returns: number;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
