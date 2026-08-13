-- ---------------------------------------------------------------------------
-- How many photographs an event has, as a number rather than as a length.
--
-- The gallery header said "50 so far" at every event with more than fifty
-- photographs in it, because it was counting the page it had loaded rather than
-- the evening. A guest at a wedding with four hundred photographs was told
-- there were fifty until they pressed "Show more", and then a hundred.
--
-- Counting is not free at the sizes this reaches, so it leans on the index the
-- gallery already has: media_gallery_idx is (event_id, created_at desc) where
-- status = 'ready' and source = 'guest', which is exactly this predicate, so
-- the count is an index-only scan over one event's entry in it and never
-- touches the table.
--
-- The predicate is the gallery's, deliberately: the number beside a wall of
-- photographs has to be the number of photographs on that wall. A cover the
-- host uploaded is in `media` and is not one of them - see migration 0013 -
-- and neither is a row still waiting on its bytes.
--
-- Not security definer, for the same reason event_stats is not: it runs as
-- whoever calls it, so Row Level Security applies and a host cannot count
-- another host's event by passing an id they guessed. The guest gallery calls
-- it through the admin client, which has no session to apply RLS to - there the
-- share token, checked before this is ever reached, is what stands in for one.
-- ---------------------------------------------------------------------------

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
     and source = 'guest';
$$;
