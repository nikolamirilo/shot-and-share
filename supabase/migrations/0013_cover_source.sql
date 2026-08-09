-- ---------------------------------------------------------------------------
-- Where a photo came from.
--
-- Every row in `media` used to be a guest's upload, so the gallery could read
-- the table without asking. A host can now upload their own cover image, and
-- that picture is a different kind of thing: it lives in the same event folder
-- and is charged to the same quota, but it is not a photograph of the party.
-- Left undistinguished it would appear in the shared gallery, in the slideshow
-- on the wall, and in the ZIP - a stock picture the host chose as decoration,
-- handed back to the guests as one of their own photos.
--
-- 'guest' is the default, so every existing row is one and every existing
-- insert keeps working without naming the column.
-- ---------------------------------------------------------------------------

alter table public.media
  add column if not exists source text not null default 'guest';

alter table public.media
  drop constraint if exists media_source_check;

alter table public.media
  add constraint media_source_check check (source in ('guest', 'cover'));

-- The gallery filters on all three columns on every scroll, so it gets its own
-- partial index. media_event_idx stays: the ZIP build and the retention sweep
-- want every row of an event, covers included.
create index if not exists media_gallery_idx
  on public.media (event_id, created_at desc)
  where status = 'ready' and source = 'guest';

-- ---------------------------------------------------------------------------
-- The counts follow the same rule as the gallery.
--
-- "41 photos" on a host's dashboard means 41 photographs from guests. A cover
-- the host uploaded themselves is not one of them, and counting it would make
-- the number disagree with the grid immediately below it.
--
-- `bytes` is the exception and stays as it was: a cover really does occupy
-- storage, and the storage line has to add up to what is in the bucket.
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
    count(*) filter (where kind = 'photo' and source = 'guest'),
    count(*) filter (where kind = 'video' and source = 'guest'),
    count(distinct uploader_fingerprint) filter (where source = 'guest'),
    coalesce(sum(size_bytes + poster_size_bytes), 0)
  from public.media
  where event_id = p_event
    and status = 'ready';
$$;

-- Still deliberately NOT security definer: it runs as the caller so Row Level
-- Security applies, and a host cannot read another host's numbers by passing an
-- id they guessed.
