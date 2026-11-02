-- FootMax backend: profiles, cloud save slots, leaderboards and account
-- deletion. Every table has row level security; the browser only ever uses
-- the publishable key, so these policies are the real access control.

-- Profiles ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  look jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Public profiles can be read by anyone"
  on public.profiles for select
  using (is_public or auth.uid() = id);

create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Every new account gets a profile with a username made from the email,
-- which the player can change later.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
begin
  base := left(regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g'), 14);
  if char_length(base) < 3 then
    base := 'player';
  end if;
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    candidate := base || '_' || floor(random() * 100000)::int;
  end loop;
  insert into public.profiles (id, username) values (new.id, candidate);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Cloud saves ----------------------------------------------------------------
-- The row holds the slot's summary; the save itself is a file in the
-- private "saves" bucket at <user id>/<slot id>.fmx. Files are cheaper to
-- store than rows (1 GB of file storage vs 500 MB of database on the free
-- plan), and the client uploads the file before bumping the revision here.

create table public.saves (
  user_id uuid not null references auth.users (id) on delete cascade,
  slot_id text not null check (slot_id ~ '^[a-z0-9]{4,40}$'),
  meta jsonb not null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, slot_id)
);

alter table public.saves enable row level security;

create policy "Users manage their own saves"
  on public.saves for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Six slots per account, matching the game. Updating an existing slot is
-- allowed when the account is full.
create function public.limit_saves()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.saves where user_id = new.user_id and slot_id <> new.slot_id) >= 6 then
    raise exception 'save slot limit reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger saves_limit
  before insert on public.saves
  for each row execute function public.limit_saves();

insert into storage.buckets (id, name, public, file_size_limit)
values ('saves', 'saves', false, 10485760)
on conflict (id) do nothing;

create policy "Users read their own save files"
  on storage.objects for select to authenticated
  using (bucket_id = 'saves' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users upload their own save files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'saves' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users replace their own save files"
  on storage.objects for update to authenticated
  using (bucket_id = 'saves' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'saves' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete their own save files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'saves' and (storage.foldername(name))[1] = auth.uid()::text);

-- Leaderboards ---------------------------------------------------------------
-- One row per save. Numbers come from the player's device, so the checks
-- only stop impossible values; that is the limit for a single-player game.

create table public.leaderboard (
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot_id text not null,
  mode text not null check (mode in ('career', 'manager')),
  name text not null check (char_length(name) between 1 and 60),
  club text check (char_length(club) <= 60),
  look jsonb,
  peak_ovr integer check (peak_ovr between 1 and 99),
  apps integer not null default 0 check (apps between 0 and 2000),
  goals integer not null default 0 check (goals >= 0 and goals <= apps * 5),
  assists integer not null default 0 check (assists >= 0 and assists <= apps * 5),
  seasons integer not null default 0 check (seasons between 0 and 60),
  ballon_dors integer not null default 0 check (ballon_dors >= 0 and ballon_dors <= seasons),
  trophies integer not null default 0 check (trophies between 0 and 300),
  league_titles integer not null default 0 check (league_titles >= 0 and league_titles <= seasons),
  retired boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot_id)
);

alter table public.leaderboard enable row level security;

create policy "Leaderboard rows of public profiles can be read by anyone"
  on public.leaderboard for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = user_id and p.is_public)
  );

create policy "Users write their own leaderboard rows"
  on public.leaderboard for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index leaderboard_peak_ovr on public.leaderboard (mode, peak_ovr desc);
create index leaderboard_goals on public.leaderboard (mode, goals desc);
create index leaderboard_trophies on public.leaderboard (mode, trophies desc);

-- Grants ---------------------------------------------------------------------
-- Stated explicitly rather than relying on project defaults.

grant select on public.profiles, public.leaderboard to anon, authenticated;
grant update (username, look, is_public, updated_at) on public.profiles to authenticated;
grant select, insert, update, delete on public.saves, public.leaderboard to authenticated;

-- Account deletion -----------------------------------------------------------
-- The app removes the player's save files through the Storage API first
-- (Supabase blocks deleting storage rows from SQL), then calls this. The
-- cascade removes the profile, saves and leaderboard rows.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
