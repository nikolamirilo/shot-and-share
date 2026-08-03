-- ---------------------------------------------------------------------------
-- Realtime for the live slideshow (Wedding tier).
--
-- The slideshow is the only part of the product that needs a live reactive
-- query, and one subscription channel on `media` handles it. Everything else
-- is a plain request.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'media'
  ) then
    alter publication supabase_realtime add table public.media;
  end if;
end
$$;

-- The slideshow page runs on a laptop plugged into a projector and is opened
-- from the host dashboard, so it authenticates as the host and reads through
-- the existing "hosts read own media" policy. No extra grant is needed.
