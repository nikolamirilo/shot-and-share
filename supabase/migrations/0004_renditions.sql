-- ---------------------------------------------------------------------------
-- Compression and renditions.
--
-- Up to four objects can exist per upload, and each has a different job:
--
--   original  exactly what the guest's phone produced, untouched
--   display   optimised full-size copy, in a format every device can open
--   thumb     small copy for grids
--   poster    first usable frame of a video
--
-- Which of them are actually stored depends on the event's media_quality
-- setting and on whether the browser could decode the file at all.
-- ---------------------------------------------------------------------------

alter table public.media
  add column if not exists display_key         text,
  add column if not exists display_size_bytes  bigint not null default 0,
  add column if not exists display_format      text,
  add column if not exists thumb_format        text,
  add column if not exists poster_key          text,
  add column if not exists poster_size_bytes   bigint not null default 0,
  add column if not exists original_format     text,
  add column if not exists duration_seconds    numeric,
  -- 'done'    nothing further to do
  -- 'pending' the browser could not decode or transcode it; the worker must
  -- 'failed'  the worker tried and gave up; the original is still intact
  add column if not exists processing          text not null default 'done',
  -- True when the original was replaced by the optimised copy. Recorded so a
  -- host can always be told, honestly, what they are holding.
  add column if not exists original_replaced   boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'media_processing_check'
  ) then
    alter table public.media
      add constraint media_processing_check
      check (processing in ('done', 'pending', 'failed'));
  end if;
end
$$;

-- The worker's work queue. Small and partial: the overwhelming majority of
-- uploads are photos the browser handled, and they never appear here.
create index if not exists media_processing_idx
  on public.media (created_at)
  where processing = 'pending';

-- ---------------------------------------------------------------------------
-- Per-event choice: keep the original bytes, or keep the space.
--
-- 'optimised' stores the re-encoded copy and discards the original. Typically
--   a quarter of the size, which is the difference between a free event
--   holding 250 photos and holding a thousand.
-- 'original' keeps exactly what the guest uploaded. Slower to fill, and the
--   right answer for anyone who will print large or hand files to an editor.
--
-- The default is 'optimised'. It is the better trade for almost everybody, and
-- re-encoding is not reversible, so the setting is stated plainly in the UI
-- rather than buried.
-- ---------------------------------------------------------------------------

alter table public.events
  add column if not exists media_quality text not null default 'optimised';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_media_quality_check'
  ) then
    alter table public.events
      add constraint events_media_quality_check
      check (media_quality in ('optimised', 'original'));
  end if;
end
$$;

comment on column public.events.media_quality is
  'optimised = store the re-encoded copy; original = keep the uploaded bytes.';
comment on column public.media.processing is
  'pending rows are the transcode worker''s queue.';
