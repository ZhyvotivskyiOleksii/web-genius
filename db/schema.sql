-- Project persistence schema for Supabase
-- Tables: sites, site_files, site_revisions, publish_settings (existing), publish_deploys (existing)

-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- Sites table: one row per project
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  types text[] default '{}',
  status text default 'draft',
  meta jsonb default '{}',
  last_opened_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  archived_at timestamptz
);
create unique index if not exists sites_user_slug_unique on public.sites (user_id, slug);
create index if not exists sites_user_updated_idx on public.sites (user_id, updated_at desc);

-- Site files table: one row per file in a project
create table if not exists public.site_files (
  id bigserial primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  path text not null,
  content text not null,
  sha256 text,
  version int not null default 1,
  size int,
  updated_at timestamptz default now(),
  updated_by uuid
);
create unique index if not exists site_files_unique on public.site_files (site_id, path);
create index if not exists site_files_site_updated_idx on public.site_files (site_id, updated_at desc);

-- Optional revisions table for future phases
create table if not exists public.site_revisions (
  id bigserial primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  label text,
  snapshot jsonb not null,
  created_at timestamptz default now(),
  created_by uuid
);
create index if not exists site_revisions_site_idx on public.site_revisions (site_id, created_at desc);

-- Project chat (per-site dialogue)
create table if not exists public.project_chat (
  id bigserial primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','ai')),
  text text not null,
  file text,
  input_tokens int,
  output_tokens int,
  model text,
  metadata jsonb,
  created_at timestamptz default now()
);
create index if not exists project_chat_site_idx on public.project_chat (site_id, created_at desc);

-- RLS policies: owner-only access
alter table public.sites enable row level security;
alter table public.site_files enable row level security;
alter table public.site_revisions enable row level security;

-- Helper policy function
create or replace function public.is_owner_site(site_id uuid) returns boolean language sql stable as $$
  select exists (
    select 1 from public.sites s
    where s.id = site_id and s.user_id = auth.uid()
  );
$$;

-- sites policies
drop policy if exists sites_select on public.sites;
drop policy if exists sites_modify on public.sites;
create policy sites_select on public.sites for select using (user_id = auth.uid());
create policy sites_modify on public.sites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- site_files policies
drop policy if exists site_files_select on public.site_files;
drop policy if exists site_files_modify on public.site_files;
create policy site_files_select on public.site_files for select using (public.is_owner_site(site_id));
create policy site_files_modify on public.site_files for all using (public.is_owner_site(site_id)) with check (public.is_owner_site(site_id));
