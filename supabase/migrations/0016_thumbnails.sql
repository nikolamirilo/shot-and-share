-- ---------------------------------------------------------------------------
-- Two objects per photo: the full-size copy, and a thumbnail.
--
-- Migration 0008 collapsed an upload down to one object, on the grounds that
-- three renditions of the same picture is three times the storage bill for a
-- difference nobody looking at a phone can see. That reasoning still holds for
-- storing a full-size copy, a display copy and a thumbnail. It does not hold
-- for a 25 KB thumbnail, and the single object was doing two jobs badly:
--
--   - It was capped at 2560px on its longest edge, which throws away about 60%
--     of a 12MP photo, permanently. A host who wants to print big or crop in
--     on one face cannot.
--   - The gallery grid loaded that full-size copy for every tile. A wall of
--     fifty photos pulled fifty full-size images through the image optimiser.
--
-- So the full copy stops being shrunk and starts being the download, and a
-- small WebP thumbnail beside it becomes what the grid loads. Two objects, not
-- four, and the second one is 1-2% of the first.
--
-- Objects now sit in folders:
--
--   {owner_id}/{event_id}/full/{media_id}.{ext}
--   {owner_id}/{event_id}/thumb/{media_id}.{ext}
--
-- Nothing is rewritten. Rows written before this keep their flat key and a
-- null thumb_key, and every read path falls back to the full copy when there
-- is no thumbnail - which is also exactly what happens for the seconds between
-- a photo being confirmed and its thumbnail landing.
-- ---------------------------------------------------------------------------


-- --- 1. The thumbnail -------------------------------------------------------

alter table public.media
  add column if not exists thumb_key        text,
  add column if not exists thumb_size_bytes bigint not null default 0,
  add column if not exists thumb_format     text;

comment on column public.media.thumb_key is
  'Small copy for the gallery grid. Null on rows written before migration 0016, and on video - a clip''s poster frame already does this job.';

alter table public.upload_reservations
  add column if not exists thumb_key        text,
  add column if not exists thumb_size_bytes bigint not null default 0;


-- --- 2. The tenant boundary, extended ---------------------------------------
--
-- Same rule the other keys already carry: a thumbnail whose key points into
-- another host's folder fails at write time rather than being uploaded there.
-- The prefix is spelled out rather than wrapped in a helper function - a CHECK
-- that calls a function can be silently invalidated by redefining the function,
-- because existing rows are not revalidated.

alter table public.media
  drop constraint if exists media_keys_owner_scoped_check;
alter table public.media
  add constraint media_keys_owner_scoped_check check (
    media_key like owner_id::text || '/' || event_id::text || '/%'
    and (thumb_key is null or
         thumb_key like owner_id::text || '/' || event_id::text || '/%')
    and (poster_key is null or
         poster_key like owner_id::text || '/' || event_id::text || '/%')
  );

alter table public.upload_reservations
  drop constraint if exists upload_reservations_keys_owner_scoped_check;
alter table public.upload_reservations
  add constraint upload_reservations_keys_owner_scoped_check check (
    media_key like owner_id::text || '/' || event_id::text || '/%'
    and (thumb_key is null or
         thumb_key like owner_id::text || '/' || event_id::text || '/%')
    and (poster_key is null or
         poster_key like owner_id::text || '/' || event_id::text || '/%')
  );


-- --- 3. The usage counter ---------------------------------------------------
--
-- Recomputed rather than adjusted: correct whether or not any thumbnails exist
-- yet, and it has to include the new column now that quota charges for it.

update public.events e
   set storage_used_bytes = coalesce((
         select sum(m.size_bytes + m.thumb_size_bytes + m.poster_size_bytes)
           from public.media m
          where m.event_id = e.id
            and m.status <> 'deleted'
       ), 0);
