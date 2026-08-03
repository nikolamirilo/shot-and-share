-- ---------------------------------------------------------------------------
-- Say Cheese — initial schema
--
-- Five tables carry the whole product. Postgres is the source of truth for what
-- exists; the bucket is only where the bytes live. The application never calls
-- ListObjects to find out what is in an event, because LIST is billed at the
-- expensive request rate and would run on every page load.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- --- profiles ---------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'One row per signed-in host.';

-- --- events -----------------------------------------------------------------

create table if not exists public.events (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references public.profiles (id) on delete cascade,
  name                  text not null check (char_length(name) between 1 and 120),
  event_date            date not null,
  tier                  text not null default 'free'
                          check (tier in ('free', 'event', 'wedding')),
  keep_forever          boolean not null default false,

  storage_quota_bytes   bigint not null,
  -- Denormalised on purpose: checking a running total against a quota has to be
  -- a single fast read on the upload path.
  storage_used_bytes    bigint not null default 0 check (storage_used_bytes >= 0),

  expires_at            timestamptz,
  status                text not null default 'active'
                          check (status in ('active', 'expired', 'deleted')),

  -- Guest-facing settings
  gallery_visible       boolean not null default true,
  welcome_message       text check (welcome_message is null or char_length(welcome_message) <= 400),
  cover_media_id        uuid,

  -- Metrics. Activation and guest conversion are the only numbers that matter
  -- early on, and a guest who opens the link without uploading is the clearest
  -- signal of a broken experience.
  link_opens            integer not null default 0,

  -- ZIP archive bookkeeping
  archive_key           text,
  archive_built_at      timestamptz,
  archive_size_bytes    bigint,
  archive_builds        integer not null default 0,

  -- Retention bookkeeping
  warned_at_days        integer,
  deleted_at            timestamptz,

  created_at            timestamptz not null default now()
);

create index if not exists events_owner_idx on public.events (owner_id, created_at desc);
create index if not exists events_expiry_idx on public.events (expires_at)
  where status = 'active' and keep_forever = false;
create index if not exists events_deleted_idx on public.events (deleted_at)
  where status = 'expired';

-- --- event_tokens -----------------------------------------------------------
-- The secret in the shareable link. Stored hashed: a database leak must not
-- hand over working upload links.

create table if not exists public.event_tokens (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  -- Lookup key. A guest's link is hashed and matched against this.
  token_hash  text not null unique,
  -- The same token under AES-256-GCM, so the dashboard can re-render the QR
  -- code tomorrow. Hash-only storage would force a reissue every time a host
  -- lost the tab, which invalidates every card already printed and on the
  -- tables. A stolen dump without the application key still yields nothing.
  token_cipher text,
  label       text,
  revoked     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists event_tokens_event_idx on public.event_tokens (event_id);

-- --- media ------------------------------------------------------------------

create table if not exists public.media (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events (id) on delete cascade,
  original_key        text not null,
  thumb_key           text,
  size_bytes          bigint not null check (size_bytes >= 0),
  thumb_size_bytes    bigint not null default 0 check (thumb_size_bytes >= 0),
  mime_type           text not null,
  kind                text not null default 'photo' check (kind in ('photo', 'video')),
  width               integer,
  height              integer,
  -- Not an account. A random id kept in the guest's localStorage, which is what
  -- lets a guest remove something they just uploaded by mistake without ever
  -- signing in.
  uploader_fingerprint text,
  uploader_name       text,
  status              text not null default 'pending'
                        check (status in ('pending', 'ready', 'deleted')),
  created_at          timestamptz not null default now()
);

create index if not exists media_event_idx on public.media (event_id, created_at desc)
  where status = 'ready';
create index if not exists media_pending_idx on public.media (created_at)
  where status = 'pending';

alter table public.events
  drop constraint if exists events_cover_media_fk;
alter table public.events
  add constraint events_cover_media_fk
  foreign key (cover_media_id) references public.media (id) on delete set null;

-- --- purchases --------------------------------------------------------------

create table if not exists public.purchases (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid references public.events (id) on delete set null,
  owner_id          uuid references public.profiles (id) on delete set null,
  provider          text not null default 'lemonsqueezy',
  -- Webhooks are delivered more than once. This is the idempotency key.
  provider_txn_id   text not null,
  product           text not null check (product in ('event', 'wedding', 'keep_forever')),
  amount_cents      integer,
  currency          text,
  status            text not null default 'paid',
  raw               jsonb,
  created_at        timestamptz not null default now(),
  unique (provider, provider_txn_id)
);

create index if not exists purchases_event_idx on public.purchases (event_id);

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Reserve quota atomically, BEFORE any presigned URL is issued. Checking
-- afterwards means the bytes are already in the bucket and already billable.
-- Returns true if the space was reserved.
create or replace function public.reserve_storage(p_event uuid, p_bytes bigint)
returns boolean
language plpgsql
security definer
set search_path = public
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

-- Give reserved space back when an upload is abandoned or a photo is deleted.
create or replace function public.release_storage(p_event uuid, p_bytes bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.events
     set storage_used_bytes = greatest(0, storage_used_bytes - greatest(p_bytes, 0))
   where id = p_event;
$$;

-- Link opens drive the one metric that predicts whether the product works:
-- the share of people who open the link and then actually upload.
create or replace function public.increment_link_opens(p_event uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.events set link_opens = link_opens + 1 where id = p_event;
$$;

-- Counts for one event, in one round trip.
--
-- Deliberately NOT security definer: it runs as the caller so Row Level
-- Security still applies, which means a host cannot read another host's numbers
-- by passing an id they guessed.
create or replace function public.event_stats(p_event uuid)
returns table (
  photo_count    bigint,
  video_count    bigint,
  uploader_count bigint,
  bytes          bigint
)
language sql
stable
set search_path = public
as $$
  select
    count(*) filter (where kind = 'photo'),
    count(*) filter (where kind = 'video'),
    count(distinct uploader_fingerprint),
    coalesce(sum(size_bytes + thumb_size_bytes), 0)
  from public.media
  where event_id = p_event
    and status = 'ready';
$$;

-- New sign-ins get a profile row without any application code running.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Hosts read only their own events and the media inside them. Guests are never
-- authenticated, so every guest request goes through a server route that
-- validates the link token first and then queries with the service role.
-- ---------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.events        enable row level security;
alter table public.event_tokens  enable row level security;
alter table public.media         enable row level security;
alter table public.purchases     enable row level security;

drop policy if exists "profiles are self-readable" on public.profiles;
create policy "profiles are self-readable" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles are self-writable" on public.profiles;
create policy "profiles are self-writable" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "hosts read own events" on public.events;
create policy "hosts read own events" on public.events
  for select using (auth.uid() = owner_id);

drop policy if exists "hosts create own events" on public.events;
create policy "hosts create own events" on public.events
  for insert with check (auth.uid() = owner_id);

drop policy if exists "hosts update own events" on public.events;
create policy "hosts update own events" on public.events
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "hosts delete own events" on public.events;
create policy "hosts delete own events" on public.events
  for delete using (auth.uid() = owner_id);

drop policy if exists "hosts manage own tokens" on public.event_tokens;
create policy "hosts manage own tokens" on public.event_tokens
  for all using (
    exists (select 1 from public.events e
             where e.id = event_tokens.event_id and e.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.events e
             where e.id = event_tokens.event_id and e.owner_id = auth.uid())
  );

drop policy if exists "hosts read own media" on public.media;
create policy "hosts read own media" on public.media
  for select using (
    exists (select 1 from public.events e
             where e.id = media.event_id and e.owner_id = auth.uid())
  );

drop policy if exists "hosts update own media" on public.media;
create policy "hosts update own media" on public.media
  for update using (
    exists (select 1 from public.events e
             where e.id = media.event_id and e.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.events e
             where e.id = media.event_id and e.owner_id = auth.uid())
  );

drop policy if exists "hosts read own purchases" on public.purchases;
create policy "hosts read own purchases" on public.purchases
  for select using (auth.uid() = owner_id);

-- Nobody but the service role writes purchases. A client-side success redirect
-- never grants entitlement; only a verified webhook does.
