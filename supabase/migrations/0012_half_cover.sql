-- ---------------------------------------------------------------------------
-- `band` becomes `half`.
--
-- The band was a photograph with a solid stripe of accent under it carrying the
-- name - the name beside the picture rather than on it, which on a phone is a
-- small image above a heading. `half` is the same photograph at the same sort of
-- height with the name laid over it: the full-screen cover, at half the screen,
-- so the upload button is still in view.
--
-- The rows move before the constraint does, or adding it fails on any event
-- still sitting on the variant being removed.
--
-- Every `band` event goes to `half` rather than to the default: it is the same
-- amount of photograph at the top of the page, which is what the host chose.
-- ---------------------------------------------------------------------------

update public.events
   set cover_variant = 'half'
 where cover_variant = 'band';

alter table public.events
  drop constraint if exists events_cover_variant_check;

alter table public.events
  add constraint events_cover_variant_check
  check (cover_variant in ('full', 'classic', 'half', 'type'));
