-- ---------------------------------------------------------------------------
-- When a photograph was taken, as well as when it arrived.
--
-- A guest who uploads their camera roll the morning after puts the first dance
-- at the top of the wall, above the speeches that were uploaded live. Sorting
-- by the moment the shutter went off puts the evening back in order.
--
-- The browser reads the date out of the photo's EXIF before it compresses it
-- (compression strips the metadata), and falls back to the file's modified
-- time. It is the guest's device talking, so it is a hint for ordering and
-- nothing more - nothing is decided on it.
--
-- `sort_taken_at` exists so paging has one column to walk: rows written before
-- this migration, and files with no date in them, sort by their arrival time.
-- ---------------------------------------------------------------------------

alter table public.media
  add column if not exists taken_at timestamptz;

alter table public.media
  add column if not exists sort_taken_at timestamptz
  generated always as (coalesce(taken_at, created_at)) stored;

-- The gallery's "time taken" order, on the same predicate as media_gallery_idx.
-- The id breaks ties: a burst of shots shares its second, and a cursor on the
-- timestamp alone would skip the rest of the burst at a page boundary.
create index if not exists media_gallery_taken_idx
  on public.media (event_id, sort_taken_at desc, id desc)
  where status = 'ready' and source = 'guest';

-- Photos and videos are separate tabs now, each paged on its own.
create index if not exists media_gallery_kind_idx
  on public.media (event_id, kind, created_at desc)
  where status = 'ready' and source = 'guest';
