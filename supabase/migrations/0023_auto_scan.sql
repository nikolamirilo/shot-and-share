-- ---------------------------------------------------------------------------
-- Automatic content scanning becomes the host's choice.
--
-- 0018 shipped three layers: an automated check, a host switch that holds
-- everything, and a report button. The first of those ran on every upload at
-- every event, whether or not the host had asked for it - which sends every
-- photograph from somebody's wedding to Amazon Rekognition, and bills for it,
-- for events that never wanted the check.
--
-- Off by default, and it stays off for every event that already exists. The
-- other two layers are untouched: the hold-everything switch and the report
-- button work exactly as they did, so an event with scanning off is still
-- moderated - by its host.
-- ---------------------------------------------------------------------------

alter table public.events
  add column if not exists auto_scan boolean not null default false;

comment on column public.events.auto_scan is
  'When true each upload is screened by the automated content check as it arrives, and anything flagged is held for the host. Off by default; the host switches it on. Independent of require_approval.';
