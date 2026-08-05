-- ---------------------------------------------------------------------------
-- Two more parts of the custom event page: the type, and the shape of the ask.
--
-- Same gate as everything in 0005. resolveAppearance() applies the tier every
-- time an event is rendered, so a free event carries the house pairing and the
-- default upload panel whatever these columns happen to hold.
-- ---------------------------------------------------------------------------

alter table public.events
  add column if not exists theme_font     text not null default 'cheese',
  add column if not exists upload_variant text not null default 'button';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_upload_variant_check'
  ) then
    alter table public.events
      add constraint events_upload_variant_check
      check (upload_variant in ('button', 'panel', 'bar', 'split'));
  end if;
end
$$;

-- `theme_font` is deliberately NOT constrained, for the same reason `theme` is
-- not: a pairing is defined in the application, adding a sixth should not need
-- a migration, and an unknown value falls back to the house pairing when it is
-- read. `upload_variant` is constrained because each id is a component that has
-- to exist - an unknown one is a bug, not a preference.

comment on column public.events.theme_font is
  'Type pairing id. Unknown values fall back to the house pairing.';
comment on column public.events.upload_variant is
  'Which shape the guest page uses to ask for photos.';
