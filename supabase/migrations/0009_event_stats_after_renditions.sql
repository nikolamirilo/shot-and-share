-- ---------------------------------------------------------------------------
-- Repair event_stats() after 0008 removed the rendition columns.
--
-- 0008 dropped media.thumb_size_bytes. event_stats() - untouched since 0001 -
-- still summed `size_bytes + thumb_size_bytes`, so every call raised
--
--   ERROR: column "thumb_size_bytes" does not exist
--
-- and the dashboard's event page, which is its only caller, returned a 500.
--
-- The drop succeeded silently because Postgres does not record columns named
-- inside a `language sql` function body as dependencies of that function: the
-- body is re-parsed when it runs, not when the column disappears. A migration
-- that drops a column therefore has to go looking for its own callers, and
-- 0008 did not. The check is one query and belongs in the review of any future
-- column drop:
--
--   select p.proname
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.prosrc ~ '<column being dropped>';
--
-- The replacement sums what a media row is actually charged for now, which is
-- the same expression mediaBytes() uses in src/lib/media.ts: the one stored
-- object, plus a video's poster frame.
-- ---------------------------------------------------------------------------

create or replace function public.event_stats(p_event uuid)
returns table (
  photo_count    bigint,
  video_count    bigint,
  uploader_count bigint,
  bytes          bigint
)
language sql
stable
set search_path = public
as $$
  select
    count(*) filter (where kind = 'photo'),
    count(*) filter (where kind = 'video'),
    count(distinct uploader_fingerprint),
    coalesce(sum(size_bytes + poster_size_bytes), 0)
  from public.media
  where event_id = p_event
    and status = 'ready';
$$;

-- Still deliberately NOT security definer: it runs as the caller so Row Level
-- Security applies, and a host cannot read another host's numbers by passing an
-- id they guessed.
