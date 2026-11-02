-- Checks the row level security rules. Paste into the Supabase SQL editor
-- (or run with psql as the postgres user). It runs inside a transaction
-- and rolls back, so it leaves no data behind. Any failure raises an error
-- naming the rule that broke; success prints "RLS checks passed".

begin;

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.test', 'authenticated', 'authenticated');

-- Profiles were created by the sign-up trigger.
do $$
begin
  if (select count(*) from public.profiles where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')) <> 2 then
    raise exception 'sign-up trigger did not create profiles';
  end if;
end $$;

insert into public.saves (user_id, slot_id, meta) values ('00000000-0000-0000-0000-00000000000a', 'slotalice1', '{}');
insert into public.leaderboard (user_id, slot_id, mode, name, apps, goals) values
  ('00000000-0000-0000-0000-00000000000a', 'slotalice1', 'career', 'Alice', 10, 5),
  ('00000000-0000-0000-0000-00000000000b', 'slotbob1', 'career', 'Bob', 10, 5);
update public.profiles set is_public = false where id = '00000000-0000-0000-0000-00000000000b';

-- Act as Alice.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.saves) <> 1 then
    raise exception 'Alice should see exactly her own save';
  end if;
  if exists (select 1 from public.leaderboard where name = 'Bob') then
    raise exception 'Bob has a private profile, so his leaderboard row must be hidden';
  end if;
  if exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000b') then
    raise exception 'Bob''s private profile must be hidden';
  end if;
end $$;

-- Alice cannot write into Bob's account.
do $$
begin
  begin
    insert into public.saves (user_id, slot_id, meta) values ('00000000-0000-0000-0000-00000000000b', 'sneaky1', '{}');
    raise exception 'Alice was able to create a save for Bob';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- Act as Bob: he cannot see Alice's save.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from public.saves) then
    raise exception 'Bob can see a save that is not his';
  end if;
end $$;

-- Signed out: only public rows.
reset role;
set local role anon;
select set_config('request.jwt.claims', '', true);
do $$
begin
  -- Visitors have no grant on saves at all; either an error or no rows is fine.
  begin
    if exists (select 1 from public.saves) then
      raise exception 'Signed-out visitors can see saves';
    end if;
  exception when insufficient_privilege then
    null;
  end;
  if not exists (select 1 from public.leaderboard where name = 'Alice') then
    raise exception 'Public leaderboard rows should be visible when signed out';
  end if;
end $$;

reset role;
do $$ begin raise notice 'RLS checks passed'; end $$;

rollback;
