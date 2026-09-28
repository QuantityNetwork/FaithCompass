-- ═══════════════════════════════════════════════════════════════════════
-- Sagolik MCP · Catalog seeds and server RPCs
-- ═══════════════════════════════════════════════════════════════════════

insert into public.mcp_scopes (id, label, description, execution_class, sensitive) values
  ('property.read',     'Property read',      'View property records, characteristics and high-level status.', 'read', false),
  ('transaction.read',  'Transaction read',   'View purchase transactions and financing status.', 'read', false),
  ('closing.read',      'Closing read',       'View closing milestones, blockers and readiness.', 'read', false),
  ('documents.read',    'Documents read',     'View document inventories and statuses. File contents are never exposed to agents.', 'read', false),
  ('finance.read',      'Finance read',       'View normalized connected-account information and recurring obligations.', 'read', true),
  ('ownership.read',    'Ownership read',     'View ownership profiles and the property homebook.', 'read', false),
  ('scenario.run',      'Scenario execution', 'Run financing, closing-cost and cash-flow simulations.', 'simulate', false),
  ('autopilot.read',    'Autopilot read',     'View property obligations and Autopilot coverage.', 'read', false),
  ('closing.prepare',   'Closing prepare',    'Prepare closing checklists for human review.', 'prepare', false),
  ('documents.prepare', 'Documents prepare',  'Draft requests for missing documents. Drafts are not sent.', 'prepare', false),
  ('autopilot.prepare', 'Autopilot prepare',  'Prepare Autopilot and recurring-payment plans for review.', 'prepare', false),
  ('closing.execute',   'Closing execute',    'Submit approved closing actions. Always requires approval.', 'execute', true),
  ('autopilot.execute', 'Autopilot execute',  'Activate an approved Autopilot plan. Always requires approval.', 'execute', true),
  ('audit.read',        'Audit read',         'Read the audit trail of this connection''s own activity.', 'read', false)
on conflict (id) do nothing;

insert into public.integration_providers (id, name, kind, description, environments) values
  ('plaid', 'Plaid', 'financial_data', 'Open-banking data: accounts, balances, transactions, liabilities and recurring streams.', '{sandbox,production}'),
  ('sandbox_bank', 'Sagolik Sandbox Bank', 'financial_data', 'Synthetic accounts and transactions for development. Never available in production.', '{sandbox}'),
  ('sandbox_payments', 'Sandbox payments', 'payments', 'Simulated payment scheduling for Autopilot testing. No funds move.', '{sandbox}')
on conflict (id) do nothing;

-- Sandbox providers may never be attached to production data.
alter table public.integration_connections add constraint integration_connections_sandbox_provider
  check (environment = 'sandbox' or provider_id not in ('sandbox_bank','sandbox_payments'));
alter table public.financial_connections add constraint financial_connections_sandbox_provider
  check (environment = 'sandbox' or provider_id not in ('sandbox_bank','sandbox_payments'));

-- Replace an organization's sandbox dataset atomically. Production rows are
-- untouched: every statement is constrained to environment = 'sandbox', and
-- every inserted row must declare the sandbox environment.
create or replace function public.sgk_replace_sandbox(p_org uuid, p_dataset jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  k text;
begin
  foreach k in array array['properties','transactions','loans','milestones','blockers','documents','obligations','autopilotRules',
                           'ownershipRecords','homebookEntries','financialConnections','accounts','accountTransactions','integrationConnections'] loop
    if exists (
      select 1 from jsonb_array_elements(coalesce(p_dataset -> k, '[]'::jsonb)) e
      where (e ->> 'organization_id')::uuid <> p_org or e ->> 'environment' <> 'sandbox'
    ) then
      raise exception 'sandbox dataset rows must belong to the sandbox of organization %', p_org;
    end if;
  end loop;

  delete from public.account_transactions where organization_id = p_org and environment = 'sandbox';
  delete from public.accounts where organization_id = p_org and environment = 'sandbox';
  delete from public.financial_connections where organization_id = p_org and environment = 'sandbox';
  delete from public.integration_connections where organization_id = p_org and environment = 'sandbox';
  delete from public.properties where organization_id = p_org and environment = 'sandbox'; -- cascades to domain children

  insert into public.properties select * from jsonb_populate_recordset(null::public.properties, p_dataset -> 'properties');
  insert into public.transactions select * from jsonb_populate_recordset(null::public.transactions, p_dataset -> 'transactions');
  insert into public.loans select * from jsonb_populate_recordset(null::public.loans, p_dataset -> 'loans');
  insert into public.closing_milestones select * from jsonb_populate_recordset(null::public.closing_milestones, p_dataset -> 'milestones');
  insert into public.closing_blockers select * from jsonb_populate_recordset(null::public.closing_blockers, p_dataset -> 'blockers');
  insert into public.integration_connections select * from jsonb_populate_recordset(null::public.integration_connections, p_dataset -> 'integrationConnections');
  insert into public.documents select * from jsonb_populate_recordset(null::public.documents, p_dataset -> 'documents');
  insert into public.obligations select * from jsonb_populate_recordset(null::public.obligations, p_dataset -> 'obligations');
  insert into public.autopilot_rules select * from jsonb_populate_recordset(null::public.autopilot_rules, p_dataset -> 'autopilotRules');
  insert into public.ownership_records select * from jsonb_populate_recordset(null::public.ownership_records, p_dataset -> 'ownershipRecords');
  insert into public.homebook_entries select * from jsonb_populate_recordset(null::public.homebook_entries, p_dataset -> 'homebookEntries');
  insert into public.financial_connections select * from jsonb_populate_recordset(null::public.financial_connections, p_dataset -> 'financialConnections');
  insert into public.accounts select * from jsonb_populate_recordset(null::public.accounts, p_dataset -> 'accounts');
  insert into public.account_transactions select * from jsonb_populate_recordset(null::public.account_transactions, p_dataset -> 'accountTransactions');
end $$;

revoke all on function public.sgk_replace_sandbox(uuid, jsonb) from public, anon, authenticated;

-- Aggregated activity for dashboards and health views.
create or replace function public.sgk_activity_stats(p_org uuid, p_env public.sgk_environment, p_since timestamptz)
returns jsonb
language sql stable security definer set search_path = public as $$
  with rows as (
    select status, tool_name, duration_ms, error_code, state_changed
    from public.mcp_audit_logs
    where organization_id = p_org and environment = p_env and created_at >= p_since
  )
  select jsonb_build_object(
    'total', (select count(*) from rows),
    'succeeded', (select count(*) from rows where status in ('success','partial')),
    'failed', (select count(*) from rows where status in ('failed','unavailable')),
    'denied', (select count(*) from rows where status = 'denied'),
    'approvalsRequested', (select count(*) from rows where status = 'approval_required'),
    'rateLimited', (select count(*) from rows where error_code in ('rate_limited','loop_detected')),
    'stateChanging', (select count(*) from rows where state_changed),
    'latencyP50', (select percentile_disc(0.5) within group (order by duration_ms) from rows),
    'latencyP95', (select percentile_disc(0.95) within group (order by duration_ms) from rows),
    'byTool', coalesce((select jsonb_agg(t order by (t ->> 'count')::int desc) from (
        select jsonb_build_object('tool', tool_name, 'count', count(*), 'failures', count(*) filter (where status in ('denied','failed','unavailable'))) t
        from rows group by tool_name) x), '[]'::jsonb),
    'byStatus', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from rows group by status) s), '{}'::jsonb)
  );
$$;

revoke all on function public.sgk_activity_stats(uuid, public.sgk_environment, timestamptz) from public, anon, authenticated;
