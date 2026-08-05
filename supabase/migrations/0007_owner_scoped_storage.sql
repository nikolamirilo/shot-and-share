-- ---------------------------------------------------------------------------
-- Owner-scoped storage, and the Row Level Security to match.
--
-- Two things change here, and they are the same change seen from two sides.
--
-- 1. Every object moves under the host who owns it:
--
--      u/{owner_id}/{event_id}/originals/{media_id}.{ext}
--      u/{owner_id}/{event_id}/display/{media_id}.{ext}
--      u/{owner_id}/{event_id}/thumbs/{media_id}.{ext}
--      u/{owner_id}/{event_id}/posters/{media_id}.{ext}
--      u/{owner_id}/{event_id}/archive/{event_id}.zip
--
--    S3 has no row level security, so the bucket is guarded by application
--    code. Code that can be wrong quietly is not a guard, which is why the
--    layout is also a CHECK constraint below: Postgres refuses to record a key
--    that falls outside its own owner's folder. A path-building bug becomes a
--    failed write instead of a cross-tenant object.
--
--    The leading `u/` earns its place. Owner ids are unbounded, so without it
--    the bucket has no common prefix, and every S3 lifecycle rule and the
--    application's own IAM policy filter on exactly that (see infra/).
--
-- 2. `media` carries its owner directly. Three call sites - the transcode
--    worker, the retention job, and guest delete - hold a media row and need
--    the owner to build a key. Joining at each of them is three chances to get
--    it wrong. It also turns the host policies from an EXISTS subquery per row
--    into an indexed column compare.
--
-- Written against a pre-launch database. Part 1 deletes data.
-- ---------------------------------------------------------------------------


-- --- 1. Pre-launch reset ----------------------------------------------------
--
-- Every existing object is keyed `events/{event_id}/...`, which cannot satisfy
-- the constraints added further down. There is no production data, so the rows
-- go rather than being rewritten - the bytes they point at are purged from the
-- bucket separately by scripts/purge-legacy-prefix.ts.
--
-- Phrased as "does not match the new layout" rather than "matches the old one"
-- so that re-running it after a partial migration is still correct.

delete from public.media m
 using public.events e
 where e.id = m.event_id
   and m.original_key not like
       'u/' || e.owner_id::text || '/' || m.event_id::text || '/%';

-- A stale ZIP is derived data and is always rebuildable.
update public.events
   set archive_key        = null,
       archive_built_at   = null,
       archive_size_bytes = null
 where archive_key is not null
   and archive_key not like 'u/' || owner_id::text || '/' || id::text || '/%';

-- Recomputed rather than zeroed: correct whether or not anything survived.
update public.events e
   set storage_used_bytes = coalesce((
         select sum(
                  m.size_bytes + m.thumb_size_bytes +
                  m.display_size_bytes + m.poster_size_bytes
                )
           from public.media m
          where m.event_id = e.id
            and m.status <> 'deleted'
       ), 0);


-- --- 2. media.owner_id ------------------------------------------------------

alter table public.media
  add column if not exists owner_id uuid references public.profiles (id) on delete cascade;

update public.media m
   set owner_id = e.owner_id
  from public.events e
 where e.id = m.event_id
   and m.owner_id is distinct from e.owner_id;

alter table public.media
  alter column owner_id set not null;

-- The column exists to be compared against auth.uid() on every host read.
create index if not exists media_owner_idx on public.media (owner_id);

comment on column public.media.owner_id is
  'Denormalised from events.owner_id. Derived by trigger - never supplied by the application.';

-- Derived, not supplied. The upload path already knows the owner, but a
-- denormalised column that application code is trusted to fill is a column
-- that will eventually disagree with its source.
create or replace function public.media_set_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select e.owner_id into new.owner_id
    from public.events e
   where e.id = new.event_id;

  if new.owner_id is null then
    raise exception 'media.event_id % does not exist', new.event_id;
  end if;

  return new;
end;
$$;

revoke execute on function public.media_set_owner() from public, anon, authenticated;

drop trigger if exists media_set_owner_trg on public.media;
create trigger media_set_owner_trg
  before insert or update of event_id on public.media
  for each row execute function public.media_set_owner();


-- --- 3. The key layout, as a constraint -------------------------------------
--
-- This is what makes "the bucket is guarded by application code" checkable. Any
-- path that builds a key for the wrong owner fails loudly at write time.
--
-- The prefix is spelled out rather than wrapped in a helper function: a CHECK
-- that calls a function can be silently invalidated by redefining the function,
-- because existing rows are not revalidated.

alter table public.media
  drop constraint if exists media_keys_owner_scoped_check;
alter table public.media
  add constraint media_keys_owner_scoped_check check (
    original_key like 'u/' || owner_id::text || '/' || event_id::text || '/%'
    and (display_key is null or
         display_key like 'u/' || owner_id::text || '/' || event_id::text || '/%')
    and (thumb_key is null or
         thumb_key   like 'u/' || owner_id::text || '/' || event_id::text || '/%')
    and (poster_key is null or
         poster_key  like 'u/' || owner_id::text || '/' || event_id::text || '/%')
  );

alter table public.events
  drop constraint if exists events_archive_key_owner_scoped_check;
alter table public.events
  add constraint events_archive_key_owner_scoped_check check (
    archive_key is null or
    archive_key like 'u/' || owner_id::text || '/' || id::text || '/%'
  );


-- --- 4. Row Level Security --------------------------------------------------
--
-- Two changes throughout: auth.uid() is wrapped in a SELECT so it is evaluated
-- once per statement rather than once per row, and every policy names the role
-- it applies to so it is not also evaluated for anon traffic that can never
-- satisfy it.
--
-- Guests remain unauthenticated by design. Their requests go through a server
-- route that validates the link token and then queries with the service role,
-- which is why there are no anon policies here.

drop policy if exists "profiles are self-readable" on public.profiles;
create policy "profiles are self-readable" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles are self-writable" on public.profiles;
create policy "profiles are self-writable" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "hosts read own events" on public.events;
create policy "hosts read own events" on public.events
  for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "hosts create own events" on public.events;
create policy "hosts create own events" on public.events
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "hosts update own events" on public.events;
create policy "hosts update own events" on public.events
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "hosts delete own events" on public.events;
create policy "hosts delete own events" on public.events
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- Tokens have no owner column of their own. There are a handful per event, so
-- the subquery costs nothing and events_owner_idx already covers it.
drop policy if exists "hosts manage own tokens" on public.event_tokens;
create policy "hosts manage own tokens" on public.event_tokens
  for all to authenticated
  using (
    exists (select 1 from public.events e
             where e.id = event_tokens.event_id
               and e.owner_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.events e
             where e.id = event_tokens.event_id
               and e.owner_id = (select auth.uid()))
  );

-- Now a direct compare against media_owner_idx rather than an EXISTS per row.
drop policy if exists "hosts read own media" on public.media;
create policy "hosts read own media" on public.media
  for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "hosts update own media" on public.media;
create policy "hosts update own media" on public.media
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- New. A host removing their own photo previously had to go through the
-- service role, which meant the ownership check lived only in application code.
drop policy if exists "hosts delete own media" on public.media;
create policy "hosts delete own media" on public.media
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- Deliberately no INSERT policy. Rows are created by the guest upload path,
-- which is unauthenticated and runs as the service role after validating the
-- link token. A signed-in host has no reason to insert media directly.

drop policy if exists "hosts read own purchases" on public.purchases;
create policy "hosts read own purchases" on public.purchases
  for select to authenticated
  using ((select auth.uid()) = owner_id);

-- Still nobody but the service role writes purchases. A client-side success
-- redirect never grants entitlement; only a verified webhook does.


-- --- 5. Lock down the SECURITY DEFINER functions ----------------------------
--
-- These bypass RLS by construction and take an event id as an argument, with no
-- check that the caller has anything to do with that event. Postgres grants
-- EXECUTE to PUBLIC by default and PostgREST exposes every function in the
-- public schema, so until this migration any anonymous caller could run
--
--   rpc('release_storage', { p_event: <any uuid>, p_bytes: 999999999 })
--
-- and zero out a stranger's usage counter, or reserve their quota away.
--
-- They are called only from server code holding the service role, so the fix is
-- to say so. Each is recreated with an empty search_path at the same time -
-- a SECURITY DEFINER function that resolves names through a caller-controlled
-- search_path is the other half of this footgun.

create or replace function public.reserve_storage(p_event uuid, p_bytes bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_bytes <= 0 then
    return true;
  end if;

  update public.events
     set storage_used_bytes = storage_used_bytes + p_bytes
   where id = p_event
     and status = 'active'
     and storage_used_bytes + p_bytes <= storage_quota_bytes;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.release_storage(p_event uuid, p_bytes bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.events
     set storage_used_bytes = greatest(0, storage_used_bytes - greatest(p_bytes, 0))
   where id = p_event;
$$;

create or replace function public.increment_link_opens(p_event uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.events set link_opens = link_opens + 1 where id = p_event;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.reserve_storage(uuid, bigint)
  from public, anon, authenticated;
revoke execute on function public.release_storage(uuid, bigint)
  from public, anon, authenticated;
revoke execute on function public.increment_link_opens(uuid)
  from public, anon, authenticated;
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;

grant execute on function public.reserve_storage(uuid, bigint)     to service_role;
grant execute on function public.release_storage(uuid, bigint)     to service_role;
grant execute on function public.increment_link_opens(uuid)        to service_role;

-- event_stats is deliberately left alone. It is SECURITY INVOKER and STABLE, so
-- it runs as the caller and the policies above already stop a host reading
-- another host's numbers by passing an id they guessed. The dashboard calls it
-- with the host's own client, which is exactly the intent.
