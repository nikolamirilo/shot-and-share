-- ---------------------------------------------------------------------------
-- The cover position becomes a grid.
--
-- 0020 shipped four presets: three at the foot of the photograph and one in
-- the middle. Hosts asked the question a word processor asks - how far down,
-- and which way is it aligned - so the column now holds any pairing of the
-- three verticals and the three alignments, written 'vertical-horizontal'.
--
-- 'centre' was the middle row when it only had one column. Every row holding
-- it is moved to its new name rather than reset, so no page that a host has
-- already set up moves under them.
-- ---------------------------------------------------------------------------

alter table public.events
  drop constraint if exists events_cover_position_check;

update public.events
  set cover_position = 'middle-centre'
  where cover_position = 'centre';

-- Anything else that predates the grid, or that a restore put back: the
-- default is the position every cover had before 0020 existed.
update public.events
  set cover_position = 'bottom-left'
  where cover_position not in (
    'top-left', 'top-centre', 'top-right',
    'middle-left', 'middle-centre', 'middle-right',
    'bottom-left', 'bottom-centre', 'bottom-right'
  );

alter table public.events
  add constraint events_cover_position_check
  check (cover_position in (
    'top-left', 'top-centre', 'top-right',
    'middle-left', 'middle-centre', 'middle-right',
    'bottom-left', 'bottom-centre', 'bottom-right'
  ));

comment on column public.events.cover_position is
  'Where the name, date and message sit over the cover photo, as vertical-horizontal. Ignored by the "type" cover, which has no photo.';
