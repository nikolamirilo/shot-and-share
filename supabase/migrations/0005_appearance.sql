-- ---------------------------------------------------------------------------
-- The custom event page.
--
-- Theme, cover style and gallery layout are the "custom event page" the Slice
-- and Wheel plans promise. A free event ignores all of it and renders the house
-- theme with the Say Cheese header and footer.
--
-- Note that nothing here is enforced by a constraint tied to the tier. The gate
-- lives in resolveAppearance() and is applied every time an event is rendered,
-- not only when these columns are written — so a row that somehow holds paid
-- values on a free event still renders as free.
-- ---------------------------------------------------------------------------

alter table public.events
  add column if not exists theme         text not null default 'cheese',
  add column if not exists theme_custom  jsonb,
  add column if not exists cover_variant text not null default 'classic';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_cover_variant_check'
  ) then
    alter table public.events
      add constraint events_cover_variant_check
      check (cover_variant in ('classic', 'band', 'framed', 'type'));
  end if;
end
$$;

-- `theme` is deliberately NOT constrained to a fixed list. Presets are defined
-- in the application and adding one should not require a migration; an unknown
-- value falls back to the house theme when it is read.

comment on column public.events.theme is
  'Preset id, or ''custom''. Unknown values fall back to the house theme.';
comment on column public.events.theme_custom is
  'Host-chosen colours for the custom theme: bg, surface, accent, ink. The rest are derived and contrast-corrected at render time.';
comment on column public.events.cover_variant is
  'Which cover layout the guest page opens with.';
