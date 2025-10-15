create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.is_owner_site(site_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.sites s
    where s.id = site_id and s.user_id = auth.uid()
  );
$$;

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  types text[] default '{}',
  status text default 'draft',
  meta jsonb default '{}',
  total_input_tokens int default 0,
  total_output_tokens int default 0,
  last_opened_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  archived_at timestamptz
);
create unique index if not exists sites_user_slug_unique on public.sites(user_id, slug);
create index if not exists sites_user_updated_idx on public.sites(user_id, updated_at desc);
drop trigger if exists trg_sites_updated on public.sites;
create trigger trg_sites_updated before update on public.sites for each row execute procedure public.set_updated_at();
alter table public.sites enable row level security;
drop policy if exists sites_select on public.sites;
drop policy if exists sites_modify on public.sites;
create policy sites_select on public.sites for select using (user_id = auth.uid());
create policy sites_modify on public.sites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

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
create unique index if not exists site_files_unique on public.site_files(site_id, path);
create index if not exists site_files_site_updated_idx on public.site_files(site_id, updated_at desc);
drop trigger if exists trg_site_files_updated on public.site_files;
create trigger trg_site_files_updated before update on public.site_files for each row execute procedure public.set_updated_at();
alter table public.site_files enable row level security;
drop policy if exists site_files_select on public.site_files;
drop policy if exists site_files_modify on public.site_files;
create policy site_files_select on public.site_files for select using (public.is_owner_site(site_id));
create policy site_files_modify on public.site_files for all using (public.is_owner_site(site_id)) with check (public.is_owner_site(site_id));

create table if not exists public.site_revisions (
  id bigserial primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  label text,
  snapshot jsonb not null,
  created_at timestamptz default now(),
  created_by uuid
);
create index if not exists site_revisions_site_idx on public.site_revisions(site_id, created_at desc);
alter table public.site_revisions enable row level security;
drop policy if exists site_revisions_select on public.site_revisions;
drop policy if exists site_revisions_modify on public.site_revisions;
create policy site_revisions_select on public.site_revisions for select using (public.is_owner_site(site_id));
create policy site_revisions_modify on public.site_revisions for all using (public.is_owner_site(site_id)) with check (public.is_owner_site(site_id));

create table if not exists public.project_chat (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  text text not null,
  file text,
  input_tokens int,
  output_tokens int,
  model text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists project_chat_site_idx on public.project_chat(site_id, created_at desc);
alter table public.project_chat enable row level security;
drop policy if exists chat_select on public.project_chat;
drop policy if exists chat_insert on public.project_chat;
create policy chat_select on public.project_chat for select using (public.is_owner_site(site_id));
create policy chat_insert on public.project_chat for insert with check (public.is_owner_site(site_id) and user_id = auth.uid());

create table if not exists public.publish_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cpanel_host text not null,
  cpanel_username text not null,
  cpanel_token_enc text not null,
  default_domain text,
  default_docroot text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
drop trigger if exists trg_publish_settings_upd on public.publish_settings;
create trigger trg_publish_settings_upd before update on public.publish_settings for each row execute procedure public.set_updated_at();
alter table public.publish_settings enable row level security;
drop policy if exists pubset_select on public.publish_settings;
drop policy if exists pubset_modify on public.publish_settings;
create policy pubset_select on public.publish_settings for select using (user_id = auth.uid());
create policy pubset_modify on public.publish_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.publish_deploys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  url text,
  docroot text,
  zip_size_bytes bigint,
  status text default 'succeeded',
  log jsonb,
  created_at timestamptz default now()
);
create index if not exists publish_deploys_user_idx on public.publish_deploys(user_id, created_at desc);
alter table public.publish_deploys enable row level security;
drop policy if exists deploys_select on public.publish_deploys;
drop policy if exists deploys_insert on public.publish_deploys;
create policy deploys_select on public.publish_deploys for select using (user_id = auth.uid());
create policy deploys_insert on public.publish_deploys for insert with check (user_id = auth.uid());

insert into storage.buckets (id, name, public) values ('site-assets','site-assets', true) on conflict (id) do nothing;

drop policy if exists "Public Read site-assets" on storage.objects;
create policy "Public Read site-assets" on storage.objects for select using (bucket_id = 'site-assets');

drop policy if exists "Users write own site-assets" on storage.objects;
create policy "Users write own site-assets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-assets'
    and strpos(name, auth.uid()::text || '/') = 1
  );

drop policy if exists "Users update own site-assets" on storage.objects;
create policy "Users update own site-assets"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'site-assets'
    and strpos(name, auth.uid()::text || '/') = 1
  )
  with check (
    bucket_id = 'site-assets'
    and strpos(name, auth.uid()::text || '/') = 1
  );

drop policy if exists "Users delete own site-assets" on storage.objects;
create policy "Users delete own site-assets"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'site-assets'
    and strpos(name, auth.uid()::text || '/') = 1
  );

-- Billing and profiles (to match old DB)

create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  created_at timestamptz default now()
);

create table if not exists public.billing_products (
  id text primary key,
  active boolean,
  name text,
  description text,
  metadata jsonb,
  created_at timestamptz default now()
);

create table if not exists public.billing_prices (
  id text primary key,
  product_id text references public.billing_products(id) on delete cascade,
  active boolean,
  unit_amount integer,
  currency text,
  type text,
  interval text,
  interval_count integer,
  trial_period_days integer,
  metadata jsonb,
  created_at timestamptz default now()
);
create index if not exists billing_prices_product_idx on public.billing_prices(product_id);

create table if not exists public.billing_subscriptions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id text,
  price_id text references public.billing_prices(id),
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  canceled_at timestamptz,
  created_at timestamptz default now(),
  metadata jsonb
);
create index if not exists billing_subs_user_idx on public.billing_subscriptions(user_id);
create index if not exists billing_subs_price_idx on public.billing_subscriptions(price_id);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_products enable row level security;
alter table public.billing_prices enable row level security;
alter table public.profiles enable row level security;

drop policy if exists billing_customers_rw on public.billing_customers;
create policy billing_customers_rw on public.billing_customers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists billing_subscriptions_rw on public.billing_subscriptions;
create policy billing_subscriptions_rw on public.billing_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists billing_products_read on public.billing_products;
create policy billing_products_read on public.billing_products
  for select using (true);

drop policy if exists billing_prices_read on public.billing_prices;
create policy billing_prices_read on public.billing_prices
  for select using (true);

drop policy if exists profiles_rw on public.profiles;
create policy profiles_rw on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- Sync profiles with auth.users and backfill
create or replace function public.sync_profile_on_user_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, avatar_url, created_at)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name',''), coalesce(new.raw_user_meta_data->>'avatar_url',''), now())
  on conflict (id) do update
    set email = excluded.email,
        name = excluded.name,
        avatar_url = excluded.avatar_url;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.sync_profile_on_user_insert();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update on auth.users
for each row execute function public.sync_profile_on_user_insert();

insert into public.profiles (id, email, name, avatar_url, created_at)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'name',''), coalesce(u.raw_user_meta_data->>'avatar_url',''), now()
from auth.users u
on conflict (id) do update
  set email = excluded.email,
      name = excluded.name,
      avatar_url = excluded.avatar_url;



