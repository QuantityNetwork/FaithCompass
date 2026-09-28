-- ═══════════════════════════════════════════════════════════════════════
-- Sagolik MCP · Property, closing, financial and ownership domain
--
-- Every tenant-owned row carries (organization_id, environment). Child rows
-- reference parents through composite foreign keys on
-- (id, organization_id, environment), so a sandbox record can never point
-- at a production record and one organization can never reference another's.
-- ═══════════════════════════════════════════════════════════════════════

create table public.properties (
  id                              uuid primary key default gen_random_uuid(),
  organization_id                 uuid not null references public.organizations (id) on delete cascade,
  environment                     public.sgk_environment not null,
  reference                       text not null check (reference ~ '^SGK-[0-9]{3,}$'),
  status                          text not null check (status in ('prospective','under_contract','closing','owned','sold')),
  address_line1                   text not null,
  address_line2                   text,
  city                            text not null,
  region                          text not null,
  postal_code                     text not null,
  country                         text not null default 'US',
  property_type                   text not null check (property_type in ('single_family','condo','townhouse','multi_family')),
  bedrooms                        numeric(4,1),
  bathrooms                       numeric(4,1),
  living_area_sqft                integer,
  lot_size_sqft                   integer,
  year_built                      integer,
  list_price_cents                bigint check (list_price_cents >= 0),
  purchase_price_cents            bigint check (purchase_price_cents >= 0),
  tax_jurisdiction                text,
  annual_tax_estimate_cents       bigint,
  annual_insurance_estimate_cents bigint,
  hoa_name                        text,
  hoa_monthly_cents               bigint,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  unique (id, organization_id, environment),
  unique (organization_id, environment, reference)
);
create index properties_scope_idx on public.properties (organization_id, environment, status);

create table public.transactions (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  environment           public.sgk_environment not null,
  property_id           uuid not null,
  reference             text not null check (reference ~ '^TX-[0-9]{4}-[0-9]{3,}$'),
  kind                  text not null default 'purchase' check (kind = 'purchase'),
  status                text not null check (status in ('active','closed','cancelled')),
  current_stage         text not null,
  purchase_price_cents  bigint not null check (purchase_price_cents >= 0),
  down_payment_cents    bigint not null check (down_payment_cents >= 0),
  earnest_money_cents   bigint not null default 0,
  seller_credit_cents   bigint not null default 0,
  contract_date         date,
  closing_date          date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, organization_id, environment),
  unique (organization_id, environment, reference),
  foreign key (property_id, organization_id, environment) references public.properties (id, organization_id, environment) on delete cascade
);
create index transactions_property_idx on public.transactions (property_id);

create table public.loans (
  id                               uuid primary key default gen_random_uuid(),
  organization_id                  uuid not null references public.organizations (id) on delete cascade,
  environment                      public.sgk_environment not null,
  property_id                      uuid not null,
  transaction_id                   uuid,
  lender_name                      text not null,
  loan_reference_masked            text not null,
  status                           text not null check (status in ('application','processing','conditional_approval','clear_to_close','funded','active','paid_off')),
  loan_type                        text not null check (loan_type in ('conventional','fha','va','jumbo')),
  rate_type                        text not null check (rate_type in ('fixed','adjustable')),
  principal_cents                  bigint not null check (principal_cents >= 0),
  annual_rate_percent              numeric(6,3) not null,
  term_months                      integer not null check (term_months > 0),
  points                           numeric(4,2) not null default 0,
  monthly_principal_interest_cents bigint not null,
  escrow_included                  boolean not null default false,
  rate_lock_expires_on             date,
  required_actions                 text[] not null default '{}',
  documentation_complete           boolean not null default false,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now(),
  foreign key (property_id, organization_id, environment) references public.properties (id, organization_id, environment) on delete cascade,
  foreign key (transaction_id, organization_id, environment) references public.transactions (id, organization_id, environment) on delete cascade
);
create index loans_property_idx on public.loans (property_id);
create index loans_transaction_idx on public.loans (transaction_id);

create table public.closing_milestones (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  environment      public.sgk_environment not null,
  transaction_id   uuid not null,
  stage            text not null check (stage in ('offer','contract','financing','inspection','title','insurance','escrow','funds','signing','recording','ownership')),
  status           text not null check (status in ('complete','in_progress','pending','blocked','not_started')),
  position         integer not null,
  owner            text not null,
  due_date         date,
  completed_at     timestamptz,
  notes            text,
  updated_at       timestamptz not null default now(),
  unique (transaction_id, stage),
  foreign key (transaction_id, organization_id, environment) references public.transactions (id, organization_id, environment) on delete cascade
);

create table public.closing_blockers (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  environment         public.sgk_environment not null,
  transaction_id      uuid not null,
  stage               text not null,
  title               text not null,
  description         text not null,
  severity            text not null check (severity in ('critical','high','medium','low')),
  owner               text not null,
  deadline            date,
  dependency          text,
  recommended_action  text not null,
  status              text not null default 'open' check (status in ('open','resolved')),
  detected_at         timestamptz not null default now(),
  resolved_at         timestamptz,
  foreign key (transaction_id, organization_id, environment) references public.transactions (id, organization_id, environment) on delete cascade
);
create index closing_blockers_transaction_idx on public.closing_blockers (transaction_id, status);

create table public.documents (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  environment           public.sgk_environment not null,
  property_id           uuid not null,
  transaction_id        uuid,
  category              text not null,
  title                 text not null,
  status                text not null check (status in ('uploaded','missing','expired','signature_required','verification_required','accepted','rejected')),
  required_for_closing  boolean not null default false,
  required_by           date,
  provided_by           text not null,
  storage_path          text,
  uploaded_at           timestamptz,
  expires_on            date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, organization_id, environment),
  foreign key (property_id, organization_id, environment) references public.properties (id, organization_id, environment) on delete cascade,
  foreign key (transaction_id, organization_id, environment) references public.transactions (id, organization_id, environment) on delete cascade
);
create index documents_property_idx on public.documents (property_id);
create index documents_transaction_idx on public.documents (transaction_id);

create table public.document_requests (
  id                         uuid primary key default gen_random_uuid(),
  organization_id            uuid not null references public.organizations (id) on delete cascade,
  environment                public.sgk_environment not null,
  transaction_id             uuid not null,
  document_id                uuid not null,
  recipient_party            text not null,
  recipient_name             text not null,
  message                    text not null,
  due_date                   date,
  status                     text not null check (status in ('draft','submitted','fulfilled','cancelled')),
  prepared_by_connection_id  uuid,
  approval_id                uuid,
  submitted_at               timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  foreign key (transaction_id, organization_id, environment) references public.transactions (id, organization_id, environment) on delete cascade,
  foreign key (document_id, organization_id, environment) references public.documents (id, organization_id, environment) on delete cascade
);

create table public.closing_checklists (
  id                         uuid primary key default gen_random_uuid(),
  organization_id            uuid not null references public.organizations (id) on delete cascade,
  environment                public.sgk_environment not null,
  transaction_id             uuid not null,
  status                     text not null check (status in ('draft','active','superseded')),
  items                      jsonb not null default '[]',
  prepared_by_connection_id  uuid,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  foreign key (transaction_id, organization_id, environment) references public.transactions (id, organization_id, environment) on delete cascade
);

create table public.obligations (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  environment         public.sgk_environment not null,
  property_id         uuid not null,
  kind                text not null check (kind in ('mortgage','property_tax','insurance','hoa','utility_electric','utility_water','utility_gas','internet','maintenance','other')),
  payee               text not null,
  amount_cents        bigint not null check (amount_cents >= 0),
  amount_is_estimate  boolean not null default false,
  frequency           text not null check (frequency in ('monthly','quarterly','semiannual','annual')),
  next_due_date       date,
  source              text not null check (source in ('loan','tax_record','policy','hoa','bank_transactions','user','estimate')),
  confidence          text not null check (confidence in ('confirmed','detected','estimated')),
  escrowed            boolean not null default false,
  status              text not null check (status in ('active','projected','ended')),
  payee_verified      boolean not null default false,
  starts_on           date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, organization_id, environment),
  foreign key (property_id, organization_id, environment) references public.properties (id, organization_id, environment) on delete cascade
);
create index obligations_property_idx on public.obligations (property_id);

create table public.autopilot_plans (
  id                         uuid primary key default gen_random_uuid(),
  organization_id            uuid not null references public.organizations (id) on delete cascade,
  environment                public.sgk_environment not null,
  property_id                uuid not null,
  kind                       text not null check (kind in ('autopilot','recurring_payments')),
  status                     text not null check (status in ('draft','pending_approval','activated','superseded','expired','cancelled')),
  items                      jsonb not null,
  funding_account_id         text,
  summary                    text not null,
  prepared_by_connection_id  uuid,
  approval_id                uuid,
  expires_at                 timestamptz not null,
  activated_at               timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  unique (id, organization_id, environment),
  foreign key (property_id, organization_id, environment) references public.properties (id, organization_id, environment) on delete cascade
);
create index autopilot_plans_property_idx on public.autopilot_plans (property_id, status);

create table public.autopilot_rules (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  environment         public.sgk_environment not null,
  property_id         uuid not null,
  plan_id             uuid,
  obligation_id       uuid not null,
  action              text not null check (action in ('track','remind','schedule_payment')),
  status              text not null check (status in ('active','paused','failed','disabled')),
  funding_account_id  text,
  lead_days           integer not null default 3,
  execution_mode      text not null check (execution_mode in ('reminder_only','provider_scheduled','simulated')),
  provider_id         text,
  provider_reference  text,
  next_run_on         date,
  last_run_at         timestamptz,
  failure_reason      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Sandbox rules may only use the simulated mode; production can never simulate.
  check ((environment = 'sandbox') or execution_mode <> 'simulated'),
  foreign key (property_id, organization_id, environment) references public.properties (id, organization_id, environment) on delete cascade,
  foreign key (plan_id, organization_id, environment) references public.autopilot_plans (id, organization_id, environment) on delete set null (plan_id),
  foreign key (obligation_id, organization_id, environment) references public.obligations (id, organization_id, environment) on delete cascade
);
create index autopilot_rules_property_idx on public.autopilot_rules (property_id, status);

create table public.ownership_records (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  environment           public.sgk_environment not null,
  property_id           uuid not null unique,
  ownership_date        date not null,
  vesting               text not null,
  title_company         text,
  deed_recorded_on      date,
  deed_reference        text,
  purchase_price_cents  bigint,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  foreign key (property_id, organization_id, environment) references public.properties (id, organization_id, environment) on delete cascade
);

create table public.homebook_entries (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  environment      public.sgk_environment not null,
  property_id      uuid not null,
  category         text not null check (category in ('purchase','warranty','invoice','renovation','inspection','maintenance','ownership_document','insurance','tax')),
  title            text not null,
  occurred_on      date not null,
  amount_cents     bigint,
  vendor           text,
  document_id      uuid,
  expires_on       date,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (property_id, organization_id, environment) references public.properties (id, organization_id, environment) on delete cascade,
  foreign key (document_id, organization_id, environment) references public.documents (id, organization_id, environment) on delete set null (document_id)
);
create index homebook_entries_property_idx on public.homebook_entries (property_id);

-- ─── Integrations and normalized financial data ───

create table public.integration_providers (
  id            text primary key,
  name          text not null,
  kind          text not null check (kind in ('financial_data','payments','documents','notifications')),
  description   text not null,
  environments  public.sgk_environment[] not null
);

create table public.integration_connections (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  environment         public.sgk_environment not null,
  provider_id         text not null references public.integration_providers (id),
  status              text not null check (status in ('active','error','disconnected')),
  external_reference  text,
  last_error          text,
  created_by          uuid references public.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, organization_id, environment)
);

-- Provider credentials (e.g. Plaid access tokens), AES-256-GCM encrypted by
-- the server. No client role can read this table.
create table public.integration_credentials (
  integration_connection_id  uuid primary key references public.integration_connections (id) on delete cascade,
  encrypted_credentials      text not null,
  updated_at                 timestamptz not null default now()
);

create table public.financial_connections (
  id                         uuid primary key default gen_random_uuid(),
  organization_id            uuid not null references public.organizations (id) on delete cascade,
  environment                public.sgk_environment not null,
  provider_id                text not null references public.integration_providers (id),
  integration_connection_id  uuid,
  institution_name           text not null,
  status                     text not null check (status in ('active','requires_reauth','disconnected')),
  last_synced_at             timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  unique (id, organization_id, environment),
  foreign key (integration_connection_id, organization_id, environment) references public.integration_connections (id, organization_id, environment) on delete set null (integration_connection_id)
);

create table public.accounts (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  environment              public.sgk_environment not null,
  financial_connection_id  uuid not null,
  name                     text not null,
  mask                     text not null check (mask ~ '^[0-9]{2,4}$'),
  type                     text not null check (type in ('depository','investment','credit','loan')),
  subtype                  text not null,
  current_balance_cents    bigint not null,
  available_balance_cents  bigint,
  currency                 text not null default 'USD',
  balance_as_of            timestamptz not null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (id, organization_id, environment),
  foreign key (financial_connection_id, organization_id, environment) references public.financial_connections (id, organization_id, environment) on delete cascade
);

create table public.account_transactions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  environment      public.sgk_environment not null,
  account_id       uuid not null,
  posted_on        date not null,
  description      text not null,
  counterparty     text,
  amount_cents     bigint not null,
  status           text not null check (status in ('pending','posted')),
  category         text,
  created_at       timestamptz not null default now(),
  foreign key (account_id, organization_id, environment) references public.accounts (id, organization_id, environment) on delete cascade
);
create index account_transactions_account_idx on public.account_transactions (account_id, posted_on);

-- updated_at maintenance
do $$
declare t text;
begin
  foreach t in array array['properties','transactions','loans','documents','document_requests','closing_checklists','obligations',
                           'autopilot_plans','autopilot_rules','ownership_records','homebook_entries','integration_connections',
                           'financial_connections','accounts']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function public.sgk_touch_updated_at()', t || '_touch', t);
  end loop;
end $$;
