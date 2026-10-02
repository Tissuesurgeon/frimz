-- Frimz connects as the database owner, which bypasses row level security.
-- Enabling RLS with no policies blocks the Supabase Data API (anon and authenticated)
-- from reading or writing these tables.

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.ideas enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.user_settings enable row level security;
alter table public.memory_index enable row level security;
alter table public.idea_events enable row level security;
alter table public.memory_activity enable row level security;
alter table public.app_logs enable row level security;
alter table public.schema_migrations enable row level security;

do $$
declare
  role_name text;
  table_name text;
begin
  foreach role_name in array array['anon', 'authenticated']
  loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      foreach table_name in array array[
        'users',
        'sessions',
        'ideas',
        'conversations',
        'messages',
        'user_settings',
        'memory_index',
        'idea_events',
        'memory_activity',
        'app_logs',
        'schema_migrations'
      ]
      loop
        execute format('revoke all on table public.%I from %I', table_name, role_name);
      end loop;
    end if;
  end loop;
end $$;
