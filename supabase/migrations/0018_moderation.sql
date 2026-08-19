-- ---------------------------------------------------------------------------
-- Moderation
--
-- This product hands an upload form to a room full of strangers, which is the
-- thing a merchant of record actually worries about with user-generated photos.
-- Three layers answer it, and this migration is the state all three write to:
--
--   1. an automated check when the bytes land, before anything is visible
--   2. a host switch that holds every upload for approval
--   3. a report button any guest can press
--
-- The default is 'approved'. Every row that already exists was uploaded before
-- any of this and is not going to be retro-screened, so it stays visible.
-- ---------------------------------------------------------------------------

-- --- media ------------------------------------------------------------------

alter table public.media
  add column if not exists review_state text not null default 'approved'
    check (review_state in ('approved', 'held', 'reported'));

comment on column public.media.review_state is
  'approved = in the gallery. held = waiting on the host, either auto-flagged or because the event holds everything. reported = a guest pressed report and it is hidden until the host looks.';

-- What the automated check gave back. Category labels and confidences, never a
-- copy of anything: the point of storing it is that a host looking at a held
-- photo can be told why, and that a false positive can be argued about later.
alter table public.media
  add column if not exists moderation_labels jsonb;

-- Null means never screened, which is a real state rather than a failure: a row
-- from before this migration, an upload that arrived while the checker was
-- down, or a deployment with no moderation configured at all.
alter table public.media
  add column if not exists moderated_at timestamptz;

alter table public.media
  add column if not exists reported_at timestamptz;

alter table public.media
  add column if not exists report_count integer not null default 0
    check (report_count >= 0);

-- The guest gallery's read. Narrower than media_event_idx because a held photo
-- must never reach it, and the filter has to be part of the index or every
-- scroll pays for rows it is going to throw away.
create index if not exists media_visible_idx
  on public.media (event_id, created_at desc)
  where status = 'ready' and review_state = 'approved';

-- The host's review queue. Tiny by design: if this index is ever large,
-- something upstream is wrong.
create index if not exists media_review_idx
  on public.media (event_id, created_at desc)
  where status = 'ready' and review_state <> 'approved';

-- --- events -----------------------------------------------------------------

-- Off by default, and it has to stay off by default. Making a bride approve
-- four hundred photographs one at a time would ruin the product; the switch is
-- for the host who knows they want it, usually a company.
alter table public.events
  add column if not exists require_approval boolean not null default false;

comment on column public.events.require_approval is
  'When true every guest upload lands as held and waits for the host, not only the ones the automated check flagged.';

-- ---------------------------------------------------------------------------
-- Counting
--
-- event_stats is what the host console shows. It counts every guest upload,
-- held ones included, because a host whose counter disagrees with their own
-- review queue will assume photos were lost.
--
-- The guest-facing count is done in the application against the visible index
-- instead, so the two numbers are allowed to differ and each is right about its
-- own question.
-- ---------------------------------------------------------------------------

-- The guest gallery's counter has to agree with the guest gallery. A held photo
-- is not on the wall, so it is not in the number above it, and the predicate
-- here now matches media_visible_idx exactly so the count stays an index-only
-- scan rather than falling back to the table.
--
-- The host's own counters come from event_stats, which is left alone: a host
-- whose total disagreed with their review queue would assume photos were lost.
create or replace function public.event_media_count(p_event uuid)
returns bigint
language sql
stable
set search_path = public
as $$
  select count(*)
    from public.media
   where event_id = p_event
     and status = 'ready'
     and source = 'guest'
     and review_state = 'approved';
$$;
