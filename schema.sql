-- appmegle — Supabase backend (run once against the project the app points at)
--
-- appmegle uses Supabase for three things, only ONE of which needs schema:
--   * WebRTC signaling  -> Realtime Broadcast   (channel 'appmegle-signal', no schema)
--   * live online count -> Realtime Presence     (channel 'appmegle-presence', no schema)
--   * matchmaking lobby -> the table + RPC below  (THIS FILE)
--
-- The in-call apps (apps/*.js) ride the same peer-to-peer data channel and need no
-- backend of their own. The lobby is the one piece that must be atomic: two strangers
-- searching at the same instant must never both grab the same waiting peer.
-- claim_appmegle_partner() does the claim + the "nobody's here, so wait" insert in a
-- single statement using FOR UPDATE SKIP LOCKED — the race-free replacement for the old
-- Firebase transaction().
--
-- Apply via the Supabase SQL editor (or `supabase db push`). Safe to re-run.

create table if not exists public.appmegle_lobby (
  client_id  text primary key,               -- the waiting stranger's session id + signal address
  joined_at  timestamptz not null default now()
);

-- Anonymous app: the publishable/anon key is public, so access control is RLS.
-- The lobby holds only ephemeral random session ids (no PII), so anon read/write is fine.
alter table public.appmegle_lobby enable row level security;

drop policy if exists "anon rw appmegle_lobby" on public.appmegle_lobby;
create policy "anon rw appmegle_lobby" on public.appmegle_lobby
  for all to anon, authenticated
  using (true) with check (true);

-- Atomically claim a waiting stranger, or advertise yourself if none are waiting.
-- Returns the claimed peer's client_id, or NULL if you were added to the lobby to wait.
create or replace function public.claim_appmegle_partner(my_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed text;
begin
  delete from public.appmegle_lobby where client_id = my_id;                          -- drop our own stale slot
  delete from public.appmegle_lobby where joined_at < now() - interval '60 seconds';  -- reap abandoned waiters
  delete from public.appmegle_lobby
   where client_id = (
     select client_id from public.appmegle_lobby
      where client_id <> my_id
      order by joined_at
      for update skip locked
      limit 1
   )
   returning client_id into claimed;                                                  -- atomically claim one
  if claimed is null then
    insert into public.appmegle_lobby (client_id) values (my_id)
      on conflict (client_id) do update set joined_at = now();                         -- else advertise / refresh self
  end if;
  return claimed;
end;
$$;

grant execute on function public.claim_appmegle_partner(text) to anon, authenticated;
