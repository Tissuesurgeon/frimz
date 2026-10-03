-- Current thinking: one living context brief per idea, with an append-only version history.

create table if not exists context_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  idea_id uuid not null references ideas(id) on delete cascade,
  title text not null,
  version integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  change_summary text not null default '',
  user_fields jsonb not null default '[]'::jsonb,
  user_edited_at timestamptz,
  last_conversation_id uuid references conversations(id) on delete set null,
  stale_since timestamptz,
  synthesizing_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists context_briefs_idea_idx on context_briefs(idea_id);
create index if not exists context_briefs_user_idx on context_briefs(user_id);

create table if not exists context_brief_versions (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references context_briefs(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  version integer not null,
  source text not null,
  change_summary text not null default '',
  data jsonb not null,
  conversation_id uuid references conversations(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists context_brief_versions_brief_version_idx
  on context_brief_versions(brief_id, version);

alter table conversations add column if not exists context_checked_message_id uuid;

alter table public.context_briefs enable row level security;
alter table public.context_brief_versions enable row level security;

do $$
declare
  role_name text;
  table_name text;
begin
  foreach role_name in array array['anon', 'authenticated']
  loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      foreach table_name in array array['context_briefs', 'context_brief_versions']
      loop
        execute format('revoke all on table public.%I from %I', table_name, role_name);
      end loop;
    end if;
  end loop;
end $$;
