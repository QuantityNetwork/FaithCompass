-- ═══════════════════════════════════════════════════════════════════════
-- Sagolik MCP · Row Level Security
--
-- Every table has RLS enabled. Members may read their own organizations'
-- rows; nothing is writable by browser roles. All writes happen server-side
-- (service role) after authentication, membership checks and policy
-- evaluation. Secret-bearing tables have no policies at all.
-- ═══════════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','users','organization_members','organization_settings',
    'properties','transactions','loans','closing_milestones','closing_blockers','documents','document_requests',
    'closing_checklists','obligations','autopilot_plans','autopilot_rules','ownership_records','homebook_entries',
    'integration_providers','integration_connections','integration_credentials','financial_connections','accounts','account_transactions',
    'mcp_scopes','mcp_tools','mcp_clients','mcp_connections','mcp_permissions','mcp_sessions','mcp_credentials',
    'oauth_authorization_codes','mcp_approvals','mcp_audit_logs','mcp_audit_chain_heads','mcp_requests','mcp_executions',
    'idempotency_records','rate_limit_counters','webhook_endpoints','webhook_endpoint_secrets','webhook_events','webhook_deliveries'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
end $$;

-- Organizations and people
create policy organizations_member_read on public.organizations
  for select to authenticated using (public.sgk_is_member(id));

create policy users_self_or_colleague_read on public.users
  for select to authenticated using (
    id = auth.uid() or exists (
      select 1 from public.organization_members mine
      join public.organization_members theirs on theirs.organization_id = mine.organization_id
      where mine.user_id = auth.uid() and theirs.user_id = public.users.id
    )
  );

create policy organization_members_member_read on public.organization_members
  for select to authenticated using (public.sgk_is_member(organization_id));

create policy organization_settings_member_read on public.organization_settings
  for select to authenticated using (public.sgk_is_member(organization_id));

-- Tenant-owned tables: members read their organization's rows.
do $$
declare t text;
begin
  foreach t in array array[
    'properties','transactions','loans','closing_milestones','closing_blockers','documents','document_requests',
    'closing_checklists','obligations','autopilot_plans','autopilot_rules','ownership_records','homebook_entries',
    'integration_connections','financial_connections','accounts','account_transactions',
    'mcp_connections','mcp_permissions','mcp_sessions','mcp_approvals','mcp_audit_logs','mcp_requests','mcp_executions',
    'webhook_endpoints','webhook_events','webhook_deliveries'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.sgk_is_member(organization_id))',
      t || '_member_read', t);
  end loop;
end $$;

-- Public catalogs
create policy mcp_scopes_read on public.mcp_scopes for select to authenticated using (true);
create policy mcp_tools_read on public.mcp_tools for select to authenticated using (true);
create policy integration_providers_read on public.integration_providers for select to authenticated using (true);

-- Clients: visible when owned by, or connected to, one of the caller's organizations.
create policy mcp_clients_member_read on public.mcp_clients
  for select to authenticated using (
    (organization_id is not null and public.sgk_is_member(organization_id))
    or exists (select 1 from public.mcp_connections c where c.client_id = mcp_clients.id and public.sgk_is_member(c.organization_id))
  );

-- Column-level protection: hashes of client secrets are never readable by browser roles.
revoke select on public.mcp_clients from authenticated;
grant select (id, organization_id, client_name, client_type, redirect_uris, token_endpoint_auth_method, registration_source, created_at)
  on public.mcp_clients to authenticated;

-- Secret-bearing and internal tables: RLS enabled with no policies, and no grants.
revoke all on public.integration_credentials, public.mcp_credentials, public.oauth_authorization_codes,
  public.webhook_endpoint_secrets, public.idempotency_records, public.rate_limit_counters, public.mcp_audit_chain_heads
  from authenticated;

-- Functions are callable only where intended.
revoke all on function public.sgk_increment_rate_counters(text[], integer) from public, anon, authenticated;
revoke all on function public.sgk_audit_chain() from public, anon, authenticated;
grant execute on function public.sgk_verify_audit_chain(uuid) to authenticated;
