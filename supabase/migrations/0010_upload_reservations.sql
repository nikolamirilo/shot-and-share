-- ---------------------------------------------------------------------------
-- A media row means the bytes are in the bucket.
--
-- Until now the upload handshake used `media` itself as its scratch space: the
-- presign step inserted a row with a size, a key and status 'pending', and the
-- confirm step flipped it to 'ready'. That put a sized row in the media table
-- for bytes that did not exist yet, and it left one behind for a full day
-- whenever a phone died mid-upload - holding quota the host had not spent.
--
-- The reservation is a real thing and it deserves its own table. What it is not
-- is a photo. Splitting it means `media` can be read exactly as it sounds:
--
--     select * from media;      -- every photo at this event, all of them real
--
-- with no `where status = 'ready'` on the end and no rows describing an upload
-- that never happened.
--
-- The quota counter still moves at presign time, because the alternative is
-- letting a guest send 500 MB and only then telling them there was no room. So
-- this table is what the counter is *for*: one row per set of bytes that has
-- been promised to a guest and not yet delivered, carrying enough to undo the
-- promise - the event to refund, the bytes to refund, and the keys of any
-- object that may have landed before the guest walked away.
-- ---------------------------------------------------------------------------

create table if not exists public.upload_reservations (
  -- Chosen by the presign step and reused verbatim as the media id on confirm,
  -- so the object key written into the bucket never has to be rewritten.
  id                  uuid primary key,
  event_id            uuid not null references public.events (id) on delete cascade,
  -- Denormalised for the same reason media.owner_id is: the sweep builds
  -- storage keys from this row alone, without a join back to events.
  owner_id            uuid not null references public.profiles (id) on delete cascade,
  media_key           text not null,
  poster_key          text,
  size_bytes          bigint not null check (size_bytes >= 0),
  poster_size_bytes   bigint not null default 0 check (poster_size_bytes >= 0),
  -- Everything else needed to build the media row at confirm time: kind, mime,
  -- format, dimensions, duration, the uploader's fingerprint and name, and
  -- whether the worker still owes us a transcode. Kept as one jsonb column
  -- rather than a second copy of the media columns, because this table is
  -- transient bookkeeping and a schema change to media must not need a matching
  -- change here.
  media               jsonb not null,
  created_at          timestamptz not null default now()
);

-- The sweep reads by age and nothing else.
create index if not exists upload_reservations_stale_idx
  on public.upload_reservations (created_at);

-- The same tenant boundary media carries. A reservation whose key points into
-- another host's folder fails at write time rather than signing a URL for it.
alter table public.upload_reservations
  drop constraint if exists upload_reservations_keys_owner_scoped_check;
alter table public.upload_reservations
  add constraint upload_reservations_keys_owner_scoped_check check (
    media_key like owner_id::text || '/' || event_id::text || '/%'
    and (poster_key is null or
         poster_key like owner_id::text || '/' || event_id::text || '/%')
  );

-- Written only by the service role, from the presign and confirm routes. RLS on
-- with no policy at all is the correct posture: a guest has no reason to read
-- their own reservation, and a host has no reason to see one.
alter table public.upload_reservations enable row level security;


-- --- the old pending rows ---------------------------------------------------
--
-- Anything still sitting in media as 'pending' was written by the previous
-- handshake and will never be confirmed - the client that would have confirmed
-- it no longer exists. Their bytes go back to the events that are still holding
-- them, and the rows go.
--
-- The objects those rows point at are left in the bucket. Removing them needs
-- an S3 call, which a migration cannot make; scripts/purge-legacy-prefix.mjs is
-- where that belongs. They are unreferenced and small.

do $$
declare
  v_event uuid;
  v_bytes bigint;
begin
  for v_event, v_bytes in
    select event_id, sum(size_bytes + poster_size_bytes)
      from public.media
     where status = 'pending'
     group by event_id
  loop
    update public.events
       set storage_used_bytes = greatest(0, storage_used_bytes - v_bytes)
     where id = v_event;
  end loop;

  delete from public.media where status = 'pending';
end;
$$;

-- media.status keeps its three values. 'pending' is now unreachable from the
-- application - the insert at confirm writes 'ready' directly - but dropping it
-- from the check constraint would be a one-way door for no gain, and 'deleted'
-- still needs somewhere to sit beside it.

-- The partial index that served the old sweep has nothing left to find.
drop index if exists public.media_pending_idx;
