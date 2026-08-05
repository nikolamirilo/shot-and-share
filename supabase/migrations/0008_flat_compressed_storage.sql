-- ---------------------------------------------------------------------------
-- One compressed object per upload, at the root of the bucket.
--
-- Two things change, and they are the same decision seen from two sides.
--
-- 1. The `u/` wrapper prefix goes. Owner folders now sit at the root:
--
--      {owner_id}/{event_id}/{media_id}.{ext}
--      {owner_id}/{event_id}/{media_id}-poster.{ext}
--      {owner_id}/{event_id}/archive/{event_id}.zip
--
--    The prefix existed to give the bucket a common root for lifecycle rules
--    and the IAM policy to filter on. Both express the same thing without it -
--    a lifecycle rule with no prefix filter covers the whole bucket, and the
--    IAM policy scopes on `${aws:PrincipalTag/owner}/*` instead. What the
--    prefix actually cost was a level of nesting in every path, in every log
--    line and in the console, for a host looking for their own event.
--
-- 2. An upload keeps one object, not four. There is no original, no display
--    copy and no thumbnail - the compressed photo *is* the photo. Three
--    renditions of the same picture is three times the storage bill for a
--    difference nobody looking at a phone can see, and it made the event folder
--    something a host could not read at a glance. The only second object is a
--    video's poster frame, which is not a copy of anything.
--
--    `events.media_quality` goes with them. A host choosing "keep every
--    original byte" was choosing to fill their event four times faster to buy
--    something they would never look at, and they were choosing it before the
--    event, when they had no way to judge it.
--
-- Written against a pre-launch database. Part 1 deletes data.
-- ---------------------------------------------------------------------------


-- --- 1. Pre-launch reset ----------------------------------------------------
--
-- Every existing object is keyed `u/{owner}/{event}/originals/…`, which cannot
-- satisfy the constraints added further down, and the renditions beside it no
-- longer have columns to live in. There is no production data, so the rows go
-- rather than being rewritten - the bytes they point at are purged from the
-- bucket separately by scripts/purge-legacy-prefix.mjs.
--
-- Phrased as "does not match the new layout" rather than "matches the old one"
-- so that re-running it after a partial migration is still correct.

delete from public.media m
 using public.events e
 where e.id = m.event_id
   and m.original_key not like
       e.owner_id::text || '/' || m.event_id::text || '/%';

-- A stale ZIP is derived data and is always rebuildable.
update public.events
   set archive_key        = null,
       archive_built_at   = null,
       archive_size_bytes = null
 where archive_key is not null
   and archive_key not like owner_id::text || '/' || id::text || '/%';


-- --- 2. One object per row --------------------------------------------------
--
-- `original_key` is renamed rather than kept, because after this migration it
-- never holds an original: a column whose name contradicts its contents is how
-- the next person reintroduces the bug.

alter table public.media
  drop constraint if exists media_keys_owner_scoped_check;

alter table public.media rename column original_key    to media_key;
alter table public.media rename column original_format to media_format;

alter table public.media
  drop column if exists thumb_key,
  drop column if exists display_key,
  drop column if exists thumb_size_bytes,
  drop column if exists display_size_bytes,
  drop column if exists thumb_format,
  drop column if exists display_format,
  drop column if exists original_replaced;

comment on column public.media.media_key is
  'The one stored object: the compressed photo, or the video. Its extension changes when the transcode worker replaces a format the browser could not read, so callers read it rather than rebuilding it.';

-- Recomputed rather than zeroed: correct whether or not anything survived, and
-- it has to happen after the rendition columns are gone since they were part of
-- the old sum.
update public.events e
   set storage_used_bytes = coalesce((
         select sum(m.size_bytes + m.poster_size_bytes)
           from public.media m
          where m.event_id = e.id
            and m.status <> 'deleted'
       ), 0);


-- --- 3. The key layout, as a constraint -------------------------------------
--
-- This is what makes "the bucket is guarded by application code" checkable. Any
-- path that builds a key for the wrong owner fails loudly at write time.
--
-- The prefix is spelled out rather than wrapped in a helper function: a CHECK
-- that calls a function can be silently invalidated by redefining the function,
-- because existing rows are not revalidated.

alter table public.media
  add constraint media_keys_owner_scoped_check check (
    media_key like owner_id::text || '/' || event_id::text || '/%'
    and (poster_key is null or
         poster_key like owner_id::text || '/' || event_id::text || '/%')
  );

alter table public.events
  drop constraint if exists events_archive_key_owner_scoped_check;
alter table public.events
  add constraint events_archive_key_owner_scoped_check check (
    archive_key is null or
    archive_key like owner_id::text || '/' || id::text || '/%'
  );


-- --- 4. The quality setting -------------------------------------------------

alter table public.events
  drop constraint if exists events_media_quality_check;
alter table public.events
  drop column if exists media_quality;
