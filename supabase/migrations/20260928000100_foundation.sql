-- ═══════════════════════════════════════════════════════════════════════
-- Sagolik MCP · Foundation
-- Organizations, users, membership, settings and tenancy helpers.
-- Tenancy is inferred from auth.uid() and membership — never from input.
-- ═══════════════════════════════════════════════════════════════════════

create type public.sgk_environment as enum ('sandbox', 'production');
create type public.sgk_execution_class as enum ('read', 'simulate', 'prepare', 'execute');
create type public.sgk_member_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.sgk_organization_kind as enum ('individual', 'family', 'business', 'wealth_structure', 'professional', 'institution');

create or replace function public.sgk_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  kind        public.sgk_organization_kind not null default 'individual',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger organizations_touch before update on public.organizations
  for each row execute function public.sgk_touch_updated_at();

create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  created_at  timestamptz not null default now()
);

create table public.organization_members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null references public.users (id) on delete cascade,
  role             public.sgk_member_role not null default 'member',
  created_at       timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

create table public.organization_settings (
  organization_id               uuid primary key references public.organizations (id) on delete cascade,
  production_execute_enabled    boolean not null default false,
  approval_ttl_minutes          integer not null default 60 check (approval_ttl_minutes between 5 and 10080),
  session_ttl_minutes           integer not null default 60 check (session_ttl_minutes between 5 and 1440),
  rate_limit_per_minute         integer not null default 120 check (rate_limit_per_minute between 1 and 10000),
  loop_threshold                integer not null default 5 check (loop_threshold between 2 and 100),
  max_transaction_amount_cents  bigint check (max_transaction_amount_cents is null or max_transaction_amount_cents > 0),
  updated_at                    timestamptz not null default now()
);
create trigger organization_settings_touch before update on public.organization_settings
  for each row execute function public.sgk_touch_updated_at();

-- ─── Tenancy helpers (security definer, fixed search_path) ───

create or replace function public.sgk_is_member(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = auth.uid()
  );
$$;

create or replace function public.sgk_has_role(org uuid, roles public.sgk_member_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = auth.uid() and m.role = any (roles)
  );
$$;

-- Mirror auth.users into public.users.
create or replace function public.sgk_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, coalesce(new.email, ''), nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.sgk_handle_new_user();

-- Create an organization owned by the calling user. The caller's identity
-- comes from auth.uid(); no organization or user id is accepted as input.
create or replace function public.sgk_create_organization(p_name text, p_kind public.sgk_organization_kind)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_org  uuid;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not exists (select 1 from public.users where id = v_user) then
    insert into public.users (id, email)
    select id, coalesce(email, '') from auth.users where id = v_user;
  end if;
  insert into public.organizations (name, kind) values (trim(p_name), p_kind) returning id into v_org;
  insert into public.organization_settings (organization_id) values (v_org);
  insert into public.organization_members (organization_id, user_id, role) values (v_org, v_user, 'owner');
  return v_org;
end $$;

revoke all on function public.sgk_create_organization(text, public.sgk_organization_kind) from public, anon;
grant execute on function public.sgk_create_organization(text, public.sgk_organization_kind) to authenticated;
