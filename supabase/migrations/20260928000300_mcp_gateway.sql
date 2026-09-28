-- ═══════════════════════════════════════════════════════════════════════
-- Sagolik MCP · Gateway: registry, clients, connections, sessions,
-- approvals, audit, idempotency and rate limiting.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Catalogs ───

create table public.mcp_scopes (
  id               text primary key,
  label            text not null,
  description      text not null,
  execution_class  public.sgk_execution_class not null,
  sensitive        boolean not null default false
);

create table public.mcp_tools (
  tool_id               text primary key,             -- name@major
  name                  text not null,
  display_name          text not null,
  description           text not null,
  category              text not null,
  execution_class       public.sgk_execution_class not null,
  version               text not null,
  status                text not null check (status in ('active','deprecated','retired')),
  input_schema          jsonb not null,
  output_schema         jsonb not null,
  required_scopes       text[] not null,
  approval_required     boolean not null,
  environments          public.sgk_environment[] not null,
  rate_limit_per_minute integer not null,
  timeout_ms            integer not null,
  idempotency_required  boolean not null,
  owner                 text not null,
  created_at            timestamptz not null,
  updated_at            timestamptz not null,
  -- EXECUTE tools must always require approval.
  check (execution_class <> 'execute' or approval_required)
);
create index mcp_tools_name_idx on public.mcp_tools (name);

-- ─── Clients and connections ───

create table public.mcp_clients (
  id                          text primary key,
  organization_id             uuid references public.organizations (id) on delete cascade,
  client_name                 text not null,
  client_type                 text not null check (client_type in ('claude','chatgpt','cursor','sagolik_agent','custom')),
  redirect_uris               text[] not null default '{}',
  token_endpoint_auth_method  text not null check (token_endpoint_auth_method in ('none','client_secret_post','client_secret_basic')),
  client_secret_hash          text,
  registration_source         text not null check (registration_source in ('dynamic','console','system')),
  created_at                  timestamptz not null default now()
);

create table public.mcp_connections (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  environment              public.sgk_environment not null,
  user_id                  uuid not null references public.users (id) on delete cascade,
  client_id                text not null references public.mcp_clients (id) on delete cascade,
  name                     text not null,
  client_type              text not null,
  auth_method              text not null check (auth_method in ('oauth','token')),
  status                   text not null check (status in ('active','revoked','expired')),
  -- Explicit scopes only: no wildcards, never empty.
  scopes                   text[] not null check (
                             cardinality(scopes) > 0 and scopes <@ array[
                               'property.read','transaction.read','closing.read','documents.read','finance.read','ownership.read',
                               'scenario.run','autopilot.read','closing.prepare','documents.prepare','autopilot.prepare',
                               'closing.execute','autopilot.execute','audit.read']::text[]),
  max_execution_class      public.sgk_execution_class not null,
  transaction_limit_cents  bigint check (transaction_limit_cents is null or transaction_limit_cents > 0),
  expires_at               timestamptz,
  revoked_at               timestamptz,
  revoked_by               text,
  last_connected_at        timestamptz,
  last_activity_at         timestamptz,
  is_demo                  boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (id, organization_id, environment)
);
create index mcp_connections_org_idx on public.mcp_connections (organization_id, environment, status);
create trigger mcp_connections_touch before update on public.mcp_connections for each row execute function public.sgk_touch_updated_at();

-- Per-connection tool restrictions (scopes grant; permissions subtract).
create table public.mcp_permissions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  environment      public.sgk_environment not null,
  connection_id    uuid not null,
  tool_name        text not null,
  effect           text not null check (effect = 'deny'),
  created_by       uuid references public.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (connection_id, tool_name),
  foreign key (connection_id, organization_id, environment) references public.mcp_connections (id, organization_id, environment) on delete cascade
);

create table public.mcp_sessions (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  environment         public.sgk_environment not null,
  connection_id       uuid not null,
  kind                text not null check (kind in ('oauth','token')),
  token_prefix        text not null,
  access_expires_at   timestamptz not null,
  refresh_expires_at  timestamptz,
  revoked_at          timestamptz,
  rotated_from        uuid,
  last_seen_at        timestamptz,
  ip_address          text,
  user_agent          text,
  created_at          timestamptz not null default now(),
  foreign key (connection_id, organization_id, environment) references public.mcp_connections (id, organization_id, environment) on delete cascade
);
create index mcp_sessions_connection_idx on public.mcp_sessions (connection_id);

-- Token hashes (SHA-256). Raw tokens are never stored. No client role can read this table.
create table public.mcp_credentials (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.mcp_sessions (id) on delete cascade,
  kind        text not null check (kind in ('access','refresh')),
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table public.oauth_authorization_codes (
  id              uuid primary key default gen_random_uuid(),
  code_hash       text not null unique,
  client_id       text not null references public.mcp_clients (id) on delete cascade,
  connection_id   uuid not null references public.mcp_connections (id) on delete cascade,
  redirect_uri    text not null,
  code_challenge  text not null,
  resource        text not null default '',
  expires_at      timestamptz not null,
  consumed_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- ─── Approvals ───

create table public.mcp_approvals (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  environment      public.sgk_environment not null,
  connection_id    uuid,
  user_id          uuid not null references public.users (id) on delete cascade,
  client_name      text not null,
  tool_name        text not null,
  tool_version     integer not null,
  execution_class  public.sgk_execution_class not null,
  arguments        jsonb not null,
  fingerprint      text not null,
  summary          text not null,
  details          jsonb not null,
  status           text not null check (status in ('pending','approved','denied','expired','completed','failed')),
  expires_at       timestamptz not null,
  decided_by       uuid references public.users (id) on delete set null,
  decided_at       timestamptz,
  decision_note    text,
  consumed_at      timestamptz,
  result           jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (connection_id, organization_id, environment) references public.mcp_connections (id, organization_id, environment) on delete set null (connection_id),
  -- A decision must be attributable.
  check (status in ('pending','expired') or decided_at is not null)
);
create index mcp_approvals_org_idx on public.mcp_approvals (organization_id, environment, status, created_at desc);

-- ─── Audit (append-only, hash-chained per organization) ───

create table public.mcp_audit_logs (
  id                 uuid primary key,
  sequence           bigint not null,
  organization_id    uuid not null references public.organizations (id) on delete restrict,
  environment        public.sgk_environment not null,
  user_id            uuid,
  connection_id      uuid,
  client_name        text not null,
  client_type        text not null,
  session_id         uuid,
  request_id         text not null,
  source             text not null check (source in ('mcp','console')),
  tool_name          text not null,
  tool_version       integer,
  execution_class    public.sgk_execution_class,
  arguments_hash     text,
  scopes_used        text[] not null default '{}',
  policy_decision    text check (policy_decision in ('allowed','approval_required','denied')),
  policy_reasons     text[] not null default '{}',
  approval_id        uuid,
  approval_status    text,
  status             text not null check (status in ('success','partial','needs_input','needs_clarification','approval_required','denied','failed','unavailable')),
  error_code         text,
  duration_ms        integer not null,
  providers_touched  text[] not null default '{}',
  state_changed      boolean not null,
  summary            text not null,
  ip_address         text,
  user_agent         text,
  prev_hash          text not null,
  record_hash        text not null,
  created_at         timestamptz not null default now(),
  unique (organization_id, sequence)
);
create index mcp_audit_logs_query_idx on public.mcp_audit_logs (organization_id, environment, created_at desc);
create index mcp_audit_logs_tool_idx on public.mcp_audit_logs (organization_id, tool_name);
create index mcp_audit_logs_connection_idx on public.mcp_audit_logs (connection_id);

create table public.mcp_audit_chain_heads (
  organization_id  uuid primary key references public.organizations (id) on delete restrict,
  last_sequence    bigint not null,
  last_hash        text not null
);

create or replace function public.sgk_audit_hash(r public.mcp_audit_logs) returns text
language sql immutable as $$
  select encode(sha256(convert_to(concat_ws('|',
    r.prev_hash, r.sequence::text, r.id::text, r.organization_id::text, r.environment::text,
    to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    r.tool_name, r.status, coalesce(r.arguments_hash, ''), coalesce(r.policy_decision, ''),
    coalesce(r.approval_id::text, ''), r.state_changed::text), 'UTF8')), 'hex');
$$;

-- Assign sequence and chain hash atomically. The chain head row is locked,
-- so concurrent inserts for one organization are serialized.
create or replace function public.sgk_audit_chain() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_seq  bigint;
  v_hash text;
begin
  insert into public.mcp_audit_chain_heads (organization_id, last_sequence, last_hash)
  values (new.organization_id, 0, repeat('0', 64))
  on conflict (organization_id) do nothing;

  select last_sequence, last_hash into v_seq, v_hash
  from public.mcp_audit_chain_heads where organization_id = new.organization_id for update;

  new.sequence := v_seq + 1;
  new.prev_hash := v_hash;
  new.record_hash := public.sgk_audit_hash(new);

  update public.mcp_audit_chain_heads
  set last_sequence = new.sequence, last_hash = new.record_hash
  where organization_id = new.organization_id;
  return new;
end $$;

create trigger mcp_audit_logs_chain before insert on public.mcp_audit_logs
  for each row execute function public.sgk_audit_chain();

create or replace function public.sgk_audit_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'mcp_audit_logs is append-only; % is not permitted', tg_op using errcode = '42501';
end $$;

create trigger mcp_audit_logs_no_update before update or delete on public.mcp_audit_logs
  for each row execute function public.sgk_audit_immutable();
create trigger mcp_audit_logs_no_truncate before truncate on public.mcp_audit_logs
  for each statement execute function public.sgk_audit_immutable();

-- Returns the first sequence whose hash does not verify, or null if the chain is intact.
create or replace function public.sgk_verify_audit_chain(p_org uuid) returns bigint
language plpgsql stable security definer set search_path = public as $$
declare
  r      public.mcp_audit_logs;
  v_prev text := repeat('0', 64);
begin
  if auth.uid() is not null and not public.sgk_is_member(p_org) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  for r in select * from public.mcp_audit_logs where organization_id = p_org order by sequence loop
    if r.prev_hash <> v_prev or r.record_hash <> public.sgk_audit_hash(r) then
      return r.sequence;
    end if;
    v_prev := r.record_hash;
  end loop;
  return null;
end $$;

-- ─── Protocol request log and execution ledger ───

create table public.mcp_requests (
  id               uuid primary key,
  organization_id  uuid references public.organizations (id) on delete cascade,
  environment      public.sgk_environment not null,
  session_id       uuid,
  connection_id    uuid,
  method           text not null,
  tool_name        text,
  http_status      integer not null,
  rpc_error_code   integer,
  duration_ms      integer not null,
  ip_address       text,
  user_agent       text,
  created_at       timestamptz not null default now()
);
create index mcp_requests_org_idx on public.mcp_requests (organization_id, environment, created_at desc);

create table public.mcp_executions (
  id                 uuid primary key,
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  environment        public.sgk_environment not null,
  audit_id           uuid not null references public.mcp_audit_logs (id),
  approval_id        uuid references public.mcp_approvals (id) on delete set null,
  connection_id      uuid,
  user_id            uuid not null,
  tool_name          text not null,
  tool_version       integer not null,
  execution_class    public.sgk_execution_class not null check (execution_class in ('prepare','execute')),
  status             text not null,
  state_changed      boolean not null,
  providers_touched  text[] not null default '{}',
  duration_ms        integer not null,
  summary            text not null,
  created_at         timestamptz not null default now()
);
create index mcp_executions_org_idx on public.mcp_executions (organization_id, environment, created_at desc);

-- ─── Idempotency and rate limiting ───

create table public.idempotency_records (
  id               uuid primary key,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  environment      public.sgk_environment not null,
  idempotency_key  text not null,
  tool_name        text not null,
  requester        text not null,
  fingerprint      text not null,
  response         jsonb not null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  unique (organization_id, environment, idempotency_key, requester)
);

create table public.rate_limit_counters (
  key         text primary key,
  count       integer not null,
  expires_at  timestamptz not null
);
create index rate_limit_counters_expiry_idx on public.rate_limit_counters (expires_at);

create or replace function public.sgk_increment_rate_counters(p_keys text[], p_window_seconds integer)
returns integer[]
language plpgsql security definer set search_path = public as $$
declare
  k       text;
  counts  integer[] := '{}';
  c       integer;
begin
  foreach k in array p_keys loop
    insert into public.rate_limit_counters as r (key, count, expires_at)
    values (k, 1, now() + make_interval(secs => p_window_seconds))
    on conflict (key) do update
      set count = case when r.expires_at <= now() then 1 else r.count + 1 end,
          expires_at = case when r.expires_at <= now() then now() + make_interval(secs => p_window_seconds) else r.expires_at end
    returning count into c;
    counts := counts || c;
  end loop;
  return counts;
end $$;

-- ─── Webhooks ───

create table public.webhook_endpoints (
  id                 uuid primary key,
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  environment        public.sgk_environment not null,
  url                text not null check (url like 'https://%'),
  description        text,
  events             text[] not null check (cardinality(events) > 0),
  status             text not null check (status in ('enabled','disabled')),
  secret_prefix      text not null,
  secret_rotated_at  timestamptz,
  created_by         uuid references public.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, organization_id, environment)
);
create trigger webhook_endpoints_touch before update on public.webhook_endpoints for each row execute function public.sgk_touch_updated_at();

-- Encrypted signing secrets. No client role can read this table.
create table public.webhook_endpoint_secrets (
  endpoint_id                uuid primary key references public.webhook_endpoints (id) on delete cascade,
  encrypted_secret           text not null,
  previous_encrypted_secret  text,
  previous_expires_at        timestamptz
);

create table public.webhook_events (
  id               text primary key,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  environment      public.sgk_environment not null,
  type             text not null,
  payload          jsonb not null,
  created_at       timestamptz not null default now()
);

create table public.webhook_deliveries (
  id               uuid primary key,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  environment      public.sgk_environment not null,
  endpoint_id      uuid not null,
  event_id         text not null references public.webhook_events (id) on delete cascade,
  event_type       text not null,
  attempt          integer not null default 0,
  status           text not null check (status in ('pending','succeeded','failed','retrying')),
  response_status  integer,
  duration_ms      integer,
  error            text,
  next_attempt_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (endpoint_id, organization_id, environment) references public.webhook_endpoints (id, organization_id, environment) on delete cascade
);
create index webhook_deliveries_due_idx on public.webhook_deliveries (status, next_attempt_at);
create index webhook_deliveries_org_idx on public.webhook_deliveries (organization_id, environment, created_at desc);
