-- OurHome.bio — initial schema
-- Sprint 1: homes, rooms, companions, memories, memory_objects
-- Applies to: Supabase (Postgres 16 + pgvector + RLS)

create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- -----------------------------------------------------------------
-- users
-- Supabase Auth provides auth.users; we add a profile row.
-- -----------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  data_export_token text,
  deletion_requested_at timestamptz
);

-- -----------------------------------------------------------------
-- companions
-- user-named AI companion. name is user-chosen, never defaults.
-- -----------------------------------------------------------------
create table public.companions (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  pronouns text default 'they/them',
  voice_id text,
  personality jsonb not null default '{"traits": []}'::jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------
-- homes
-- -----------------------------------------------------------------
create table public.homes (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  companion_id uuid references public.companions(id) on delete set null,
  name text,
  style_profile jsonb not null default '{}'::jsonb,
  season text check (season in ('spring','summer','autumn','winter')) default 'autumn',
  time_of_day_mode text default 'dynamic',
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------
-- rooms
-- -----------------------------------------------------------------
create table public.rooms (
  id uuid primary key default uuid_generate_v4(),
  home_id uuid not null references public.homes(id) on delete cascade,
  slug text not null,
  name text not null,
  type text not null,
  wall_colors jsonb not null default '{}'::jsonb,
  lighting jsonb not null default '{}'::jsonb,
  unlocked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (home_id, slug)
);

-- -----------------------------------------------------------------
-- memories
-- Canonical storage is markdown in R2.
-- This table is a derived, queryable index.
-- -----------------------------------------------------------------
create table public.memories (
  id text primary key, -- ULID from frontmatter
  owner_id uuid not null references public.profiles(id) on delete cascade,
  home_id uuid not null references public.homes(id) on delete cascade,
  room_slug text,
  anchor_object text,
  type text not null check (type in ('conversation','milestone','inside_joke','decision','emotion')),
  title text,
  body text not null,
  embedding vector(1536),
  emotional_valence real check (emotional_valence between -1 and 1),
  importance real not null default 0.5 check (importance between 0 and 1),
  patina real not null default 0 check (patina between 0 and 1),
  tags text[] not null default '{}',
  links jsonb not null default '[]'::jsonb,
  r2_key text not null,
  created_at timestamptz not null default now(),
  event_date date,
  last_accessed timestamptz not null default now(),
  access_count integer not null default 0
);

create index memories_owner_idx on public.memories (owner_id);
create index memories_home_idx on public.memories (home_id);
create index memories_room_idx on public.memories (home_id, room_slug);
create index memories_embedding_idx on public.memories using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index memories_tags_idx on public.memories using gin (tags);
create index memories_created_idx on public.memories (owner_id, created_at desc);

-- -----------------------------------------------------------------
-- memory_objects
-- Physical scene-graph representation of a memory (e.g. a frame on a wall).
-- -----------------------------------------------------------------
create table public.memory_objects (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  memory_id text not null references public.memories(id) on delete cascade,
  kind text not null,
  position jsonb not null,
  visual_state jsonb not null default '{"glow": 0.5, "scale": 1.0}'::jsonb,
  placed_by text not null check (placed_by in ('user','companion','system')) default 'companion',
  placed_at timestamptz not null default now()
);

create index memory_objects_room_idx on public.memory_objects (room_id);
create index memory_objects_memory_idx on public.memory_objects (memory_id);

-- -----------------------------------------------------------------
-- room_state_history (for undo / timeline)
-- -----------------------------------------------------------------
create table public.room_state_history (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  snapshot jsonb not null,
  change_description text,
  changed_by text check (changed_by in ('user','companion','system')),
  created_at timestamptz not null default now()
);

create index room_state_history_room_idx on public.room_state_history (room_id, created_at desc);

-- -----------------------------------------------------------------
-- conversation_turns
-- Rolling log, last-20 kept verbatim; older turns summarized separately.
-- -----------------------------------------------------------------
create table public.conversation_turns (
  id uuid primary key default uuid_generate_v4(),
  home_id uuid not null references public.homes(id) on delete cascade,
  role text not null check (role in ('user','companion','system')),
  content text not null,
  room_slug text,
  created_at timestamptz not null default now()
);

create index conversation_turns_home_idx on public.conversation_turns (home_id, created_at desc);

-- -----------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.companions enable row level security;
alter table public.homes enable row level security;
alter table public.rooms enable row level security;
alter table public.memories enable row level security;
alter table public.memory_objects enable row level security;
alter table public.room_state_history enable row level security;
alter table public.conversation_turns enable row level security;

-- Users can see and modify their own data only.
create policy "profiles_self" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "companions_own" on public.companions
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "homes_own" on public.homes
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "rooms_own" on public.rooms
  for all using (exists (select 1 from public.homes h where h.id = home_id and h.owner_id = auth.uid()))
  with check (exists (select 1 from public.homes h where h.id = home_id and h.owner_id = auth.uid()));

create policy "memories_own" on public.memories
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "memory_objects_own" on public.memory_objects
  for all using (exists (
    select 1 from public.rooms r
    join public.homes h on h.id = r.home_id
    where r.id = room_id and h.owner_id = auth.uid()
  )) with check (exists (
    select 1 from public.rooms r
    join public.homes h on h.id = r.home_id
    where r.id = room_id and h.owner_id = auth.uid()
  ));

create policy "room_history_own" on public.room_state_history
  for all using (exists (
    select 1 from public.rooms r
    join public.homes h on h.id = r.home_id
    where r.id = room_id and h.owner_id = auth.uid()
  )) with check (true);

create policy "conversation_own" on public.conversation_turns
  for all using (exists (select 1 from public.homes h where h.id = home_id and h.owner_id = auth.uid()))
  with check (exists (select 1 from public.homes h where h.id = home_id and h.owner_id = auth.uid()));

-- -----------------------------------------------------------------
-- Profile bootstrap trigger
-- -----------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------
-- user_home_state
-- Snapshot of localStorage state for cloud backup/sync.
-- -----------------------------------------------------------------
create table public.user_home_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  home jsonb not null,
  memories jsonb not null default '[]'::jsonb,
  objects jsonb not null default '[]'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.user_home_state enable row level security;

create policy "user_home_state_own" on public.user_home_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index user_home_state_synced_idx on public.user_home_state (user_id, last_synced_at desc);
