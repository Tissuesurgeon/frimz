create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_token text not null unique,
  expires timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'exploring',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ideas_user_idx on ideas(user_id);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null default 'New conversation',
  current_idea_id uuid references ideas(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_idx on conversations(user_id);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null,
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on messages(conversation_id);

create table if not exists user_settings (
  user_id uuid primary key references users(id) on delete cascade,
  display_name text not null,
  theme text not null default 'system'
);

create table if not exists memory_index (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  blob_id text not null,
  namespace text not null,
  type text not null,
  status text not null default 'active',
  content text not null,
  reason text not null default '',
  importance real not null default 0.5,
  idea_id uuid references ideas(id) on delete set null,
  idea_title text not null default '',
  supersedes_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memory_index_user_idx on memory_index(user_id);
create unique index if not exists memory_index_user_blob_idx on memory_index(user_id, blob_id);

alter table memory_index
  drop constraint if exists memory_index_supersedes_fk;

alter table memory_index
  add constraint memory_index_supersedes_fk
  foreign key (supersedes_id) references memory_index(id) on delete set null;

create table if not exists idea_events (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references ideas(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null,
  summary text not null,
  memory_id uuid references memory_index(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idea_events_idea_idx on idea_events(idea_id);

create table if not exists memory_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  memory_id uuid references memory_index(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  event text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists memory_activity_user_idx on memory_activity(user_id);

create table if not exists app_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  conversation_id uuid,
  kind text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists app_logs_user_idx on app_logs(user_id);
