create table if not exists food_courts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  area text,
  created_at timestamptz not null default now()
);

create table if not exists seat_posts (
  id uuid primary key default gen_random_uuid(),
  food_court_id uuid not null references food_courts(id),
  post_type text not null check (post_type in ('offer', 'request')),
  people_count integer not null check (people_count > 0),
  location_note text not null,
  scheduled_time text,
  comment text,
  status text not null default 'active' check (status in ('active', 'matched', 'cancelled')),
  anonymous_user_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

alter table food_courts enable row level security;
alter table seat_posts enable row level security;

alter table food_courts add column if not exists slug text;

drop policy if exists "Anyone can read food courts" on food_courts;
drop policy if exists "Anyone can read active non-expired posts" on seat_posts;
drop policy if exists "Anyone can read posts" on seat_posts;
drop policy if exists "Anyone can create posts" on seat_posts;
drop policy if exists "Anonymous owner can update own posts" on seat_posts;

create policy "Anyone can read food courts"
  on food_courts for select
  using (true);

create policy "Anyone can read posts"
  on seat_posts for select
  using (true);

create policy "Anyone can create posts"
  on seat_posts for insert
  with check (
    status = 'active'
    and expires_at <= now() + interval '11 minutes'
    and people_count > 0
  );

create policy "Anonymous owner can update own posts"
  on seat_posts for update
  using (anonymous_user_id is not null)
  with check (anonymous_user_id is not null);

insert into food_courts (name, slug, area)
select 'テスト用フードコート', 'test-foodcourt', '大阪'
where not exists (select 1 from food_courts where slug = 'test-foodcourt');

insert into food_courts (name, slug, area)
select 'イオンモール テスト', 'aeon-test', '大阪'
where not exists (select 1 from food_courts where slug = 'aeon-test');

insert into food_courts (name, slug, area)
select 'ららぽーと テスト', 'lalaport-test', '大阪'
where not exists (select 1 from food_courts where slug = 'lalaport-test');

update food_courts
set slug = 'test-foodcourt'
where id = (
  select id
  from food_courts
  where name = 'テスト用フードコート'
    and slug is null
    and not exists (select 1 from food_courts where slug = 'test-foodcourt')
  order by created_at
  limit 1
);

update food_courts
set slug = 'aeon-test'
where id = (
  select id
  from food_courts
  where name = 'イオンモール テスト'
    and slug is null
    and not exists (select 1 from food_courts where slug = 'aeon-test')
  order by created_at
  limit 1
);

update food_courts
set slug = 'lalaport-test'
where id = (
  select id
  from food_courts
  where name = 'ららぽーと テスト'
    and slug is null
    and not exists (select 1 from food_courts where slug = 'lalaport-test')
  order by created_at
  limit 1
);

create unique index if not exists food_courts_slug_key on food_courts(slug) where slug is not null;
