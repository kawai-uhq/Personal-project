-- Aniko's Hub: tables for the optional account sync.
-- Run once in Supabase -> SQL Editor. Safe to run again.
--
-- Each user can only ever read and change their own rows (Row Level Security).
-- user_id fills itself in from the signed-in user, so the app never sends it.

create table if not exists public.favorites (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  media_key  text not null,                 -- e.g. "movie:603" or "tv:1399"
  media      jsonb not null,                -- title, poster, backdrop, overview, type, rating, year
  created_at timestamptz not null default now(),
  primary key (user_id, media_key)
);

create table if not exists public.watch_history (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  media_key   text not null,
  media       jsonb not null,
  season      int,
  episode     int,
  provider_id text,
  watched_at  bigint not null,              -- epoch milliseconds, same as the app
  primary key (user_id, media_key)
);

alter table public.favorites enable row level security;
alter table public.watch_history enable row level security;

drop policy if exists "own favorites" on public.favorites;
create policy "own favorites" on public.favorites
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own watch history" on public.watch_history;
create policy "own watch history" on public.watch_history
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------------------------
-- Shared server health: which streaming servers work for which title, counted across all visitors.
-- Anyone can read the counts. Nobody writes to the table directly: votes go through server_vote(),
-- which only accepts well-formed keys and adds one to a counter (so the public key can't edit anything).
create table if not exists public.server_health (
  media_key  text not null,                -- "movie:603", "tv:1399" or "anime:16498"
  server     text not null,                -- provider id ("cinesrc") or anime server number ("3")
  ok         int  not null default 0,      -- times it played
  fail       int  not null default 0,      -- times it was skipped because it didn't play
  updated_at timestamptz not null default now(),
  primary key (media_key, server)
);

alter table public.server_health enable row level security;

drop policy if exists "anyone can read server health" on public.server_health;
create policy "anyone can read server health" on public.server_health
  for select to anon, authenticated
  using (true);

create or replace function public.server_vote(p_key text, p_server text, p_ok boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key !~ '^(movie|tv|anime):[0-9]{1,9}$' or p_server !~ '^[a-z0-9]{1,24}$' then
    return;
  end if;
  insert into public.server_health as h (media_key, server, ok, fail)
  values (p_key, p_server, case when p_ok then 1 else 0 end, case when p_ok then 0 else 1 end)
  on conflict (media_key, server) do update set
    -- old votes fade: once a server has 60+ votes for a title, its counts are halved before adding
    ok   = (case when h.ok + h.fail >= 60 then h.ok / 2 else h.ok end) + excluded.ok,
    fail = (case when h.ok + h.fail >= 60 then h.fail / 2 else h.fail end) + excluded.fail,
    updated_at = now();
end;
$$;

revoke all on function public.server_vote(text, text, boolean) from public;
grant execute on function public.server_vote(text, text, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- "Popular on comvie": plays per title per day, counted when a player actually starts playing.
-- Readable by anyone; written only through record_play() (one +1 per call, well-formed keys only).
create table if not exists public.title_plays (
  media_key text not null,                 -- "movie:603", "tv:1399" or "anime:16498"
  day       date not null default current_date,
  plays     int  not null default 0,
  primary key (media_key, day)
);

alter table public.title_plays enable row level security;

drop policy if exists "anyone can read title plays" on public.title_plays;
create policy "anyone can read title plays" on public.title_plays
  for select to anon, authenticated
  using (true);

create or replace function public.record_play(p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key !~ '^(movie|tv|anime):[0-9]{1,9}$' then
    return;
  end if;
  insert into public.title_plays as t (media_key, day, plays) values (p_key, current_date, 1)
  on conflict (media_key, day) do update set plays = t.plays + 1;
  -- keep the table small: only the last 30 days matter
  delete from public.title_plays where day < current_date - 30;
end;
$$;

-- The most-played titles of the last p_days days: p_kind 'cinema' (movies and TV) or 'anime'
create or replace function public.top_titles(p_kind text, p_days int default 7, p_limit int default 20)
returns table (media_key text, plays bigint)
language sql
stable
security definer
set search_path = public
as $$
  select t.media_key, sum(t.plays)::bigint as plays
  from public.title_plays t
  where t.day > current_date - least(greatest(p_days, 1), 30)
    and (case when p_kind = 'anime' then t.media_key like 'anime:%' else t.media_key ~ '^(movie|tv):' end)
  group by t.media_key
  order by plays desc
  limit least(greatest(p_limit, 1), 40);
$$;

revoke all on function public.record_play(text) from public;
grant execute on function public.record_play(text) to anon, authenticated;
grant execute on function public.top_titles(text, int, int) to anon, authenticated;
