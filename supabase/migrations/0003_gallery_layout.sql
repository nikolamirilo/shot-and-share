-- ---------------------------------------------------------------------------
-- Per-event gallery layout.
--
-- The host picks how the shared gallery looks when a guest arrives. It is part
-- of what the paid tiers call the custom event page, though it is available on
-- every tier — charging for the difference between a square and a circle would
-- be a poor use of the paywall.
--
-- A guest can still switch the layout for themselves; that preference lives in
-- their own browser and never touches this column.
-- ---------------------------------------------------------------------------

alter table public.events
  add column if not exists gallery_layout text not null default 'grid';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_gallery_layout_check'
  ) then
    alter table public.events
      add constraint events_gallery_layout_check
      check (gallery_layout in ('grid', 'masonry', 'holes', 'stack'));
  end if;
end
$$;

comment on column public.events.gallery_layout is
  'Default gallery layout guests land on. Viewers may override locally.';
