-- Flick: first database schema
--
-- Content (shared):   decks, cards
-- Per student:        students, student_deck_settings, card_states, reviews
--
-- reviews is the source of truth: an append-only log of every answer.
-- card_states is each student's current schedule per card, and can be
-- rebuilt by replaying reviews (for example after changing the scheduler).
--
-- Deck and card ids are text, so the app's existing ids ("rn", "p3",
-- "u1abc...") carry over, and the browser can create ids itself
-- (works offline, and a retried upload can't create duplicates).

-- ---------------------------------------------------------------
-- students: one row per signed-in person, linked to Supabase Auth.
-- Other tables point at students.id, not at auth.users directly,
-- so moving off Supabase Auth later means remapping one column.
-- ---------------------------------------------------------------
create table public.students (
  id                 uuid primary key default gen_random_uuid(),
  auth_user_id       uuid not null unique references auth.users (id) on delete cascade,
  display_name       text,
  time_zone          text not null default 'America/New_York',
  day_starts_at_hour smallint not null default 4 check (day_starts_at_hour between 0 and 23),
  settings           jsonb not null default '{}'::jsonb,   -- grading style, confidence step, etc.
  created_at         timestamptz not null default now()
);

-- Create the student row automatically when someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.students (auth_user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The signed-in person's students.id, for use in access rules.
create function public.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.students where auth_user_id = auth.uid()
$$;

-- ---------------------------------------------------------------
-- decks: built-in decks have no owner; a student's own decks do.
-- ---------------------------------------------------------------
create table public.decks (
  id           text primary key default gen_random_uuid()::text,
  owner_id     uuid references public.students (id) on delete cascade,  -- null = built-in
  name         text not null,
  description  text,
  instructions text,
  color        text not null default '#4f46e5',
  topics       jsonb,          -- {key: {name, color}} for decks grouped by exam area
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index decks_owner_idx on public.decks (owner_id);

-- ---------------------------------------------------------------
-- cards: owner_id is null for built-in cards. A card a student adds,
-- including one added to a built-in deck, carries their owner_id.
-- ---------------------------------------------------------------
create table public.cards (
  id          text primary key default gen_random_uuid()::text,
  deck_id     text not null references public.decks (id) on delete cascade,
  owner_id    uuid references public.students (id) on delete cascade,  -- null = built-in
  position    integer not null default 0,
  kind        text not null default 'recall' check (kind in ('recall', 'mc', 'sata')),
  topic       text,            -- key into decks.topics
  question    text not null,
  answer      text not null,
  explanation text,
  source      text,
  options     jsonb,           -- ["A", "B", ...] for mc / sata
  correct     jsonb,           -- [1] or [0, 2, 3]: indexes into options
  image_front text,            -- URL or storage path (built-in diagrams: small SVG data URIs for now)
  image_back  text,
  sound_front text,            -- storage path, or "tone:C4" for generated notes
  sound_back  text,
  version     integer not null default 1,   -- bump when the content changes
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check ((kind = 'recall') or (options is not null and correct is not null))
);
create index cards_deck_idx on public.cards (deck_id, position);
create index cards_owner_idx on public.cards (owner_id);

-- ---------------------------------------------------------------
-- student_deck_settings: new cards per day and shuffle, per deck.
-- ---------------------------------------------------------------
create table public.student_deck_settings (
  student_id  uuid not null references public.students (id) on delete cascade,
  deck_id     text not null references public.decks (id) on delete cascade,
  new_per_day smallint not null default 20 check (new_per_day between 0 and 999),
  shuffle     boolean not null default false,
  primary key (student_id, deck_id)
);

-- ---------------------------------------------------------------
-- card_states: a student's current schedule for one card.
-- ---------------------------------------------------------------
create table public.card_states (
  student_id    uuid not null references public.students (id) on delete cascade,
  card_id       text not null references public.cards (id) on delete cascade,
  phase         text not null default 'new' check (phase in ('new', 'learning', 'review', 'relearning')),
  step          smallint not null default 0,
  interval_days integer not null default 0,
  ease          real not null default 2.5,
  due_at        timestamptz,
  lapses        integer not null default 0,
  reps          integer not null default 0,
  flagged       boolean not null default false,
  updated_at    timestamptz not null default now(),
  primary key (student_id, card_id)
);
create index card_states_due_idx on public.card_states (student_id, due_at);

-- ---------------------------------------------------------------
-- reviews: one row per answer, never updated. The id is made in the
-- browser, so uploading the same review twice is harmless.
-- Partition by month once it grows (millions of rows).
-- ---------------------------------------------------------------
create table public.reviews (
  id           uuid primary key,
  student_id   uuid not null references public.students (id) on delete cascade,
  card_id      text not null references public.cards (id) on delete cascade,
  card_version integer not null default 1,
  reviewed_at  timestamptz not null,
  grade        smallint not null check (grade between 0 and 3),        -- 0 Again, 1 Hard, 2 Good, 3 Easy
  confidence   smallint check (confidence between 0 and 2),            -- Low / Medium / High, if asked
  time_ms      integer check (time_ms >= 0),                           -- time spent on the card
  created_at   timestamptz not null default now()
);
create index reviews_student_time_idx on public.reviews (student_id, reviewed_at);
create index reviews_card_idx on public.reviews (card_id);

-- ---------------------------------------------------------------
-- Keep updated_at current.
-- ---------------------------------------------------------------
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger decks_touch       before update on public.decks       for each row execute function public.touch_updated_at();
create trigger cards_touch       before update on public.cards       for each row execute function public.touch_updated_at();
create trigger card_states_touch before update on public.card_states for each row execute function public.touch_updated_at();

-- ===============================================================
-- Access rules (row-level security). The browser talks to these
-- tables directly; Postgres applies these rules to every query.
-- ===============================================================
alter table public.students              enable row level security;
alter table public.decks                 enable row level security;
alter table public.cards                 enable row level security;
alter table public.student_deck_settings enable row level security;
alter table public.card_states           enable row level security;
alter table public.reviews               enable row level security;

-- students: see and edit only your own row (rows are created by the sign-up trigger).
create policy "students: read own" on public.students
  for select to authenticated using (auth_user_id = (select auth.uid()));
create policy "students: update own" on public.students
  for update to authenticated using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

-- decks: anyone (even signed out) can read built-in decks; you can read and change your own.
create policy "decks: read built-in" on public.decks
  for select to anon, authenticated using (owner_id is null);
create policy "decks: read own" on public.decks
  for select to authenticated using (owner_id = (select public.current_student_id()));
create policy "decks: create own" on public.decks
  for insert to authenticated with check (owner_id = (select public.current_student_id()));
create policy "decks: update own" on public.decks
  for update to authenticated using (owner_id = (select public.current_student_id()))
  with check (owner_id = (select public.current_student_id()));
create policy "decks: delete own" on public.decks
  for delete to authenticated using (owner_id = (select public.current_student_id()));

-- cards: built-in cards are readable by everyone; your own cards only by you.
-- You can add cards to your own decks and to built-in decks, but never to someone else's.
create policy "cards: read built-in" on public.cards
  for select to anon, authenticated using (owner_id is null);
create policy "cards: read own" on public.cards
  for select to authenticated using (owner_id = (select public.current_student_id()));
create policy "cards: create own" on public.cards
  for insert to authenticated with check (
    owner_id = (select public.current_student_id())
    and exists (select 1 from public.decks d
                where d.id = deck_id
                  and (d.owner_id is null or d.owner_id = (select public.current_student_id())))
  );
create policy "cards: update own" on public.cards
  for update to authenticated using (owner_id = (select public.current_student_id()))
  with check (owner_id = (select public.current_student_id()));
create policy "cards: delete own" on public.cards
  for delete to authenticated using (owner_id = (select public.current_student_id()));

-- Per-student tables: only your own rows.
create policy "deck settings: own" on public.student_deck_settings
  for all to authenticated using (student_id = (select public.current_student_id()))
  with check (student_id = (select public.current_student_id()));
create policy "card states: own" on public.card_states
  for all to authenticated using (student_id = (select public.current_student_id()))
  with check (student_id = (select public.current_student_id()));

-- reviews: add and read your own; no update or delete (they go only when the account is deleted).
create policy "reviews: read own" on public.reviews
  for select to authenticated using (student_id = (select public.current_student_id()));
create policy "reviews: add own" on public.reviews
  for insert to authenticated with check (student_id = (select public.current_student_id()));
