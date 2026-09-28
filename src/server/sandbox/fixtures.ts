/**
 * Synthetic sandbox dataset. Every institution, counterparty and account in
 * this file is fictional and exists only in the sandbox environment.
 * Dates are relative to the seed date so the sandbox remains realistic.
 */
import type {
  AccountRow,
  AccountTransactionRow,
  AutopilotRuleRow,
  ClosingBlockerRow,
  ClosingMilestoneRow,
  ClosingStage,
  DocumentRow,
  FinancialConnectionRow,
  HomebookEntryRow,
  IntegrationConnectionRow,
  LoanRow,
  MilestoneStatus,
  ObligationRow,
  Party,
  PropertyRow,
  TransactionRow,
} from "@/domain/entities";
import { CLOSING_STAGES } from "@/domain/entities";
import { addDays, addMonths, toISODate } from "@/domain/dates";
import { monthlyPaymentCents } from "@/domain/finance/mortgage";
import type { SandboxDataset } from "@/server/store/types";

export const SANDBOX_CLOSING_OFFSET_DAYS = 28;

export interface FixtureOptions {
  organizationId: string;
  seedDate: Date;
  newId?: () => string;
}

export function buildSandboxDataset(options: FixtureOptions): SandboxDataset {
  const newId = options.newId ?? (() => crypto.randomUUID());
  const org = options.organizationId;
  const env = "sandbox" as const;
  const today = toISODate(options.seedDate);
  const now = options.seedDate.toISOString();
  const closing = addDays(today, SANDBOX_CLOSING_OFFSET_DAYS);
  const C = (days: number) => addDays(closing, days);
  const T = (days: number) => addDays(today, days);
  const ts = (date: string) => `${date}T15:00:00.000Z`;
  const base = { organization_id: org, environment: env } as const;
  const stamps = { created_at: now, updated_at: now };

  /* ───────────── Properties ───────────── */
  const mercer: PropertyRow = {
    id: newId(), ...base, ...stamps,
    reference: "SGK-1042", status: "closing",
    address_line1: "245 Mercer Avenue", address_line2: null, city: "Austin", region: "TX", postal_code: "78704", country: "US",
    property_type: "single_family", bedrooms: 4, bathrooms: 3, living_area_sqft: 2640, lot_size_sqft: 7405, year_built: 2016,
    list_price_cents: 88_900_000, purchase_price_cents: 87_500_000,
    tax_jurisdiction: "Travis County, TX", annual_tax_estimate_cents: 1_645_000, annual_insurance_estimate_cents: 396_000,
    hoa_name: "Mercer Heights Owners Association", hoa_monthly_cents: 68_000,
  };
  const juniper: PropertyRow = {
    id: newId(), ...base, ...stamps,
    reference: "SGK-1017", status: "owned",
    address_line1: "1106 Juniper Street", address_line2: null, city: "Austin", region: "TX", postal_code: "78702", country: "US",
    property_type: "townhouse", bedrooms: 3, bathrooms: 2.5, living_area_sqft: 1820, lot_size_sqft: 2150, year_built: 2019,
    list_price_cents: 62_500_000, purchase_price_cents: 61_200_000,
    tax_jurisdiction: "Travis County, TX", annual_tax_estimate_cents: 1_190_000, annual_insurance_estimate_cents: 264_000,
    hoa_name: "Juniper Row Homeowners Association", hoa_monthly_cents: 21_500,
  };
  const wren: PropertyRow = {
    id: newId(), ...base, ...stamps,
    reference: "SGK-1063", status: "prospective",
    address_line1: "72 Wren Hollow Road", address_line2: null, city: "Dripping Springs", region: "TX", postal_code: "78620", country: "US",
    property_type: "single_family", bedrooms: 4, bathrooms: 3.5, living_area_sqft: 3110, lot_size_sqft: 43_560, year_built: 2021,
    list_price_cents: 119_500_000, purchase_price_cents: null,
    tax_jurisdiction: "Hays County, TX", annual_tax_estimate_cents: 2_031_500, annual_insurance_estimate_cents: 480_000,
    hoa_name: null, hoa_monthly_cents: null,
  };

  /* ───────────── Transactions ───────────── */
  const ownershipDate = T(-836);
  const mercerTx: TransactionRow = {
    id: newId(), ...base, ...stamps,
    property_id: mercer.id, reference: "TX-2026-0419", kind: "purchase", status: "active", current_stage: "financing",
    purchase_price_cents: 87_500_000, down_payment_cents: 21_875_000, earnest_money_cents: 2_625_000, seller_credit_cents: 0,
    contract_date: C(-54), closing_date: closing,
  };
  const juniperTx: TransactionRow = {
    id: newId(), ...base, ...stamps,
    property_id: juniper.id, reference: "TX-2024-0188", kind: "purchase", status: "closed", current_stage: "ownership",
    purchase_price_cents: 61_200_000, down_payment_cents: 12_240_000, earnest_money_cents: 1_224_000, seller_credit_cents: 500_000,
    contract_date: addDays(ownershipDate, -41), closing_date: ownershipDate,
  };

  /* ───────────── Loans ───────────── */
  const mercerLoan: LoanRow = {
    id: newId(), ...base, ...stamps,
    property_id: mercer.id, transaction_id: mercerTx.id,
    lender_name: "Northfield Home Lending (Sandbox)", loan_reference_masked: "••••7719",
    status: "conditional_approval", loan_type: "conventional", rate_type: "fixed",
    principal_cents: 65_625_000, annual_rate_percent: 6.375, term_months: 360, points: 0,
    monthly_principal_interest_cents: monthlyPaymentCents(65_625_000, 6.375, 360),
    escrow_included: false, rate_lock_expires_on: C(8),
    required_actions: [
      "Upload September statements for checking ••4821 and savings ••0937.",
      "Provide a homeowner's insurance binder naming Northfield Home Lending as mortgagee.",
    ],
    documentation_complete: false,
  };
  const juniperPI = monthlyPaymentCents(48_960_000, 6.125, 360);
  const juniperEscrow = Math.round((1_190_000 + 264_000) / 12);
  const juniperLoan: LoanRow = {
    id: newId(), ...base, ...stamps,
    property_id: juniper.id, transaction_id: juniperTx.id,
    lender_name: "Harbor Point Mortgage (Sandbox)", loan_reference_masked: "••••3302",
    status: "active", loan_type: "conventional", rate_type: "fixed",
    principal_cents: 48_960_000, annual_rate_percent: 6.125, term_months: 360, points: 0.25,
    monthly_principal_interest_cents: juniperPI, escrow_included: true, rate_lock_expires_on: null,
    required_actions: [], documentation_complete: true,
  };

  /* ───────────── Closing milestones ───────────── */
  const plan: Record<ClosingStage, { status: MilestoneStatus; owner: Party; due: string | null; done: string | null; notes: string | null }> = {
    offer: { status: "complete", owner: "agent", due: C(-58), done: C(-58), notes: "Offer of $875,000 accepted." },
    contract: { status: "complete", owner: "agent", due: C(-54), done: C(-54), notes: "Purchase agreement fully executed." },
    financing: { status: "in_progress", owner: "lender", due: C(-10), done: null, notes: "Conditional approval issued. Two conditions outstanding." },
    inspection: { status: "complete", owner: "buyer", due: C(-44), done: C(-44), notes: "Repair amendment executed." },
    title: { status: "in_progress", owner: "title", due: C(-7), done: null, notes: "Commitment issued. HOA estoppel certificate outstanding." },
    insurance: { status: "blocked", owner: "buyer", due: C(-10), done: null, notes: "Binder not yet received by the lender." },
    escrow: { status: "complete", owner: "title", due: C(-52), done: C(-52), notes: "Earnest money of $26,250 receipted." },
    funds: { status: "pending", owner: "buyer", due: C(-2), done: null, notes: "Final amount confirmed by the closing disclosure." },
    signing: { status: "not_started", owner: "title", due: C(-3), done: null, notes: "Signing appointment to be scheduled." },
    recording: { status: "not_started", owner: "title", due: closing, done: null, notes: null },
    ownership: { status: "not_started", owner: "sagolik", due: closing, done: null, notes: "Sagolik creates the ownership profile at recording." },
  };
  const milestones: ClosingMilestoneRow[] = CLOSING_STAGES.map((stage, position) => ({
    id: newId(), ...base, transaction_id: mercerTx.id, stage, position,
    status: plan[stage].status, owner: plan[stage].owner, due_date: plan[stage].due,
    completed_at: plan[stage].done ? ts(plan[stage].done) : null, notes: plan[stage].notes, updated_at: now,
  }));
  for (const [position, stage] of CLOSING_STAGES.entries()) {
    milestones.push({
      id: newId(), ...base, transaction_id: juniperTx.id, stage, position, status: "complete", owner: "title",
      due_date: ownershipDate, completed_at: ts(ownershipDate), notes: null, updated_at: now,
    });
  }

  /* ───────────── Blockers ───────────── */
  const blocker = (b: Omit<ClosingBlockerRow, "id" | "organization_id" | "environment" | "transaction_id" | "status" | "detected_at" | "resolved_at">): ClosingBlockerRow => ({
    id: newId(), ...base, transaction_id: mercerTx.id, status: "open", detected_at: ts(T(-3)), resolved_at: null, ...b,
  });
  const blockers: ClosingBlockerRow[] = [
    blocker({
      stage: "insurance", title: "Homeowner's insurance binder missing", severity: "high", owner: "buyer", deadline: C(-10),
      description: "The lender requires an insurance binder naming it as mortgagee before issuing clear-to-close.",
      dependency: "Lender clear-to-close",
      recommended_action: "Bind a homeowner's policy naming Northfield Home Lending as mortgagee and send the binder to the lender.",
    }),
    blocker({
      stage: "financing", title: "Updated bank statements outstanding", severity: "high", owner: "buyer", deadline: C(-17),
      description: "Underwriting requires September statements for all asset accounts used for closing.",
      dependency: "Final underwriting approval",
      recommended_action: "Upload September statements for checking ••4821 and savings ••0937.",
    }),
    blocker({
      stage: "title", title: "HOA estoppel certificate pending", severity: "medium", owner: "title", deadline: C(-12),
      description: "Mercer Heights Owners Association has not yet issued the estoppel certificate confirming dues are current.",
      dependency: "Title requirements cleared",
      recommended_action: "Title company to follow up with the HOA; the buyer may need to pay the $350 resale certificate fee.",
    }),
    blocker({
      stage: "title", title: "T-47 survey affidavit requires seller signature", severity: "low", owner: "seller", deadline: C(-9),
      description: "The title commitment requires a signed residential real property affidavit from the seller.",
      dependency: "Title commitment Schedule C",
      recommended_action: "Seller's agent to obtain the seller's notarized signature on the T-47 affidavit.",
    }),
  ];

  /* ───────────── Documents ───────────── */
  const doc = (d: Partial<DocumentRow> & Pick<DocumentRow, "category" | "title" | "status" | "provided_by">, propertyId: string, txId: string | null): DocumentRow => ({
    id: newId(), ...base, ...stamps, property_id: propertyId, transaction_id: txId, required_for_closing: true,
    required_by: null, storage_path: null, uploaded_at: null, expires_on: null, ...d,
  });
  const uploaded = (daysBeforeClosing: number) => ({ uploaded_at: ts(C(-daysBeforeClosing)), storage_path: `sandbox/${mercerTx.reference}/${daysBeforeClosing}.pdf` });
  const documents: DocumentRow[] = [
    doc({ category: "purchase_agreement", title: "One to Four Family Residential Contract (Resale)", status: "accepted", provided_by: "agent", ...uploaded(54) }, mercer.id, mercerTx.id),
    doc({ category: "disclosure", title: "Seller's disclosure notice", status: "accepted", provided_by: "seller", ...uploaded(53) }, mercer.id, mercerTx.id),
    doc({ category: "financing", title: "Loan estimate", status: "accepted", provided_by: "lender", ...uploaded(50) }, mercer.id, mercerTx.id),
    doc({ category: "financing", title: "Conditional approval letter", status: "accepted", provided_by: "lender", ...uploaded(21) }, mercer.id, mercerTx.id),
    doc({ category: "financing", title: "Pre-approval letter", status: "expired", provided_by: "lender", required_for_closing: false, expires_on: C(-40), ...uploaded(70) }, mercer.id, mercerTx.id),
    doc({ category: "financing", title: "Bank statements — August", status: "accepted", provided_by: "buyer", ...uploaded(30) }, mercer.id, mercerTx.id),
    doc({ category: "financing", title: "Bank statements — September", status: "missing", provided_by: "buyer", required_by: C(-17) }, mercer.id, mercerTx.id),
    doc({ category: "financing", title: "Appraisal report", status: "accepted", provided_by: "lender", ...uploaded(33) }, mercer.id, mercerTx.id),
    doc({ category: "inspection", title: "General home inspection report", status: "accepted", provided_by: "buyer", ...uploaded(45) }, mercer.id, mercerTx.id),
    doc({ category: "inspection", title: "Repair amendment", status: "accepted", provided_by: "agent", ...uploaded(44) }, mercer.id, mercerTx.id),
    doc({ category: "title", title: "Title commitment", status: "verification_required", provided_by: "title", ...uploaded(20) }, mercer.id, mercerTx.id),
    doc({ category: "hoa", title: "HOA estoppel certificate", status: "missing", provided_by: "hoa", required_by: C(-12) }, mercer.id, mercerTx.id),
    doc({ category: "survey", title: "T-47 residential real property affidavit", status: "signature_required", provided_by: "seller", required_by: C(-9), ...uploaded(18) }, mercer.id, mercerTx.id),
    doc({ category: "insurance", title: "Homeowner's insurance binder", status: "missing", provided_by: "buyer", required_by: C(-10) }, mercer.id, mercerTx.id),
    doc({ category: "escrow", title: "Earnest money receipt", status: "accepted", provided_by: "title", ...uploaded(52) }, mercer.id, mercerTx.id),
    doc({ category: "closing", title: "Closing disclosure", status: "missing", provided_by: "lender", required_by: C(-3) }, mercer.id, mercerTx.id),
    doc({ category: "closing", title: "Settlement wire instructions (verify by phone)", status: "missing", provided_by: "title", required_by: C(-2) }, mercer.id, mercerTx.id),
    doc({ category: "identity", title: "Government-issued photo ID", status: "accepted", provided_by: "buyer", ...uploaded(52) }, mercer.id, mercerTx.id),
    // Owned property
    doc({ category: "ownership", title: "Warranty deed (recorded)", status: "accepted", provided_by: "title", required_for_closing: false, uploaded_at: ts(addDays(ownershipDate, 1)) }, juniper.id, juniperTx.id),
    doc({ category: "title", title: "Owner's title policy", status: "accepted", provided_by: "title", required_for_closing: false, uploaded_at: ts(addDays(ownershipDate, 20)) }, juniper.id, juniperTx.id),
    doc({ category: "insurance", title: "Homeowner's policy — current term", status: "accepted", provided_by: "insurance_agent", required_for_closing: false, expires_on: T(142), uploaded_at: ts(T(-223)) }, juniper.id, null),
    doc({ category: "tax", title: "Property tax statement — prior year", status: "accepted", provided_by: "buyer", required_for_closing: false, uploaded_at: ts(T(-240)) }, juniper.id, null),
  ];

  /* ───────────── Obligations ───────────── */
  const ob = (o: Omit<ObligationRow, "id" | "organization_id" | "environment" | "created_at" | "updated_at">): ObligationRow => ({ id: newId(), ...base, ...stamps, ...o });
  const firstPayment = addMonths(`${closing.slice(0, 8)}01`, 2);
  const mercerObligations: ObligationRow[] = [
    ob({ property_id: mercer.id, kind: "mortgage", payee: "Northfield Home Lending (Sandbox)", amount_cents: mercerLoan.monthly_principal_interest_cents, amount_is_estimate: false, frequency: "monthly", next_due_date: firstPayment, source: "loan", confidence: "confirmed", escrowed: false, status: "projected", payee_verified: true, starts_on: firstPayment }),
    ob({ property_id: mercer.id, kind: "hoa", payee: "Mercer Heights Owners Association", amount_cents: 68_000, amount_is_estimate: false, frequency: "monthly", next_due_date: addMonths(`${closing.slice(0, 8)}01`, 1), source: "hoa", confidence: "confirmed", escrowed: false, status: "projected", payee_verified: true, starts_on: closing }),
    ob({ property_id: mercer.id, kind: "property_tax", payee: "Travis County Tax Office (Sandbox)", amount_cents: 1_645_000, amount_is_estimate: true, frequency: "annual", next_due_date: `${Number(closing.slice(0, 4)) + 1}-01-31`, source: "tax_record", confidence: "estimated", escrowed: false, status: "projected", payee_verified: false, starts_on: closing }),
    ob({ property_id: mercer.id, kind: "insurance", payee: "Lonestar Mutual Insurance (Sandbox)", amount_cents: 396_000, amount_is_estimate: true, frequency: "annual", next_due_date: addDays(closing, 365), source: "policy", confidence: "estimated", escrowed: false, status: "projected", payee_verified: false, starts_on: closing }),
    ob({ property_id: mercer.id, kind: "utility_electric", payee: "Hill Country Electric (Sandbox)", amount_cents: 21_500, amount_is_estimate: true, frequency: "monthly", next_due_date: addDays(closing, 30), source: "estimate", confidence: "estimated", escrowed: false, status: "projected", payee_verified: false, starts_on: closing }),
    ob({ property_id: mercer.id, kind: "utility_water", payee: "Barton Water Utility (Sandbox)", amount_cents: 9_800, amount_is_estimate: true, frequency: "monthly", next_due_date: addDays(closing, 30), source: "estimate", confidence: "estimated", escrowed: false, status: "projected", payee_verified: false, starts_on: closing }),
  ];
  const nextFirst = addMonths(`${today.slice(0, 8)}01`, 1);
  const juniperObligations: ObligationRow[] = [
    ob({ property_id: juniper.id, kind: "mortgage", payee: "Harbor Point Mortgage (Sandbox)", amount_cents: juniperPI + juniperEscrow, amount_is_estimate: false, frequency: "monthly", next_due_date: nextFirst, source: "loan", confidence: "confirmed", escrowed: false, status: "active", payee_verified: true, starts_on: addMonths(ownershipDate, 2) }),
    ob({ property_id: juniper.id, kind: "hoa", payee: "Juniper Row Homeowners Association", amount_cents: 21_500, amount_is_estimate: false, frequency: "monthly", next_due_date: nextFirst, source: "hoa", confidence: "confirmed", escrowed: false, status: "active", payee_verified: true, starts_on: ownershipDate }),
    ob({ property_id: juniper.id, kind: "property_tax", payee: "Travis County Tax Office (Sandbox)", amount_cents: 1_190_000, amount_is_estimate: false, frequency: "annual", next_due_date: `${Number(today.slice(0, 4)) + 1}-01-31`, source: "tax_record", confidence: "confirmed", escrowed: true, status: "active", payee_verified: true, starts_on: ownershipDate }),
    ob({ property_id: juniper.id, kind: "insurance", payee: "Lonestar Mutual Insurance (Sandbox)", amount_cents: 264_000, amount_is_estimate: false, frequency: "annual", next_due_date: T(142), source: "policy", confidence: "confirmed", escrowed: true, status: "active", payee_verified: true, starts_on: ownershipDate }),
    ob({ property_id: juniper.id, kind: "utility_electric", payee: "Hill Country Electric (Sandbox)", amount_cents: 16_800, amount_is_estimate: true, frequency: "monthly", next_due_date: T(9), source: "bank_transactions", confidence: "detected", escrowed: false, status: "active", payee_verified: true, starts_on: ownershipDate }),
    ob({ property_id: juniper.id, kind: "internet", payee: "Cedar Fiber (Sandbox)", amount_cents: 7_500, amount_is_estimate: false, frequency: "monthly", next_due_date: T(14), source: "bank_transactions", confidence: "detected", escrowed: false, status: "active", payee_verified: false, starts_on: ownershipDate }),
  ];
  const obligations = [...mercerObligations, ...juniperObligations];
  const jo = (kind: ObligationRow["kind"]) => juniperObligations.find((o) => o.kind === kind)!;

  /* ───────────── Financial data (Sandbox provider) ───────────── */
  const integrationConnections: IntegrationConnectionRow[] = [
    { id: newId(), ...base, ...stamps, provider_id: "sandbox_bank", status: "active", external_reference: "sbx-item-01", last_error: null, created_by: null },
    { id: newId(), ...base, ...stamps, provider_id: "sandbox_payments", status: "active", external_reference: "sbx-payments-01", last_error: null, created_by: null },
  ];
  const bank: FinancialConnectionRow = {
    id: newId(), ...base, ...stamps, provider_id: "sandbox_bank", integration_connection_id: integrationConnections[0]!.id,
    institution_name: "Sagolik Sandbox Bank", status: "active",
    last_synced_at: new Date(options.seedDate.getTime() - 2 * 3600_000).toISOString(),
  };
  const brokerage: FinancialConnectionRow = { ...bank, id: newId(), institution_name: "Sagolik Sandbox Brokerage" };
  const account = (a: Pick<AccountRow, "financial_connection_id" | "name" | "mask" | "type" | "subtype" | "current_balance_cents" | "available_balance_cents">): AccountRow => ({
    id: newId(), ...base, ...stamps, currency: "USD", balance_as_of: bank.last_synced_at ?? now, ...a,
  });
  const checking = account({ financial_connection_id: bank.id, name: "Everyday Checking", mask: "4821", type: "depository", subtype: "checking", current_balance_cents: 3_842_000, available_balance_cents: 3_842_000 });
  const savings = account({ financial_connection_id: bank.id, name: "High-Yield Savings", mask: "0937", type: "depository", subtype: "savings", current_balance_cents: 12_130_000, available_balance_cents: 12_130_000 });
  const invest = account({ financial_connection_id: brokerage.id, name: "Individual Brokerage", mask: "2210", type: "investment", subtype: "brokerage", current_balance_cents: 9_680_000, available_balance_cents: null });

  const txns: AccountTransactionRow[] = [];
  const tx = (accountId: string, posted_on: string, description: string, counterparty: string | null, amount_cents: number, status: "pending" | "posted" = "posted", category: string | null = null) =>
    txns.push({ id: newId(), ...base, account_id: accountId, posted_on, description, counterparty, amount_cents, status, category, created_at: now });
  const electric = [15_420, 18_730, 19_510, 17_260, 14_380, 16_120];
  for (let m = 6; m >= 1; m--) {
    const first = addMonths(`${today.slice(0, 8)}01`, -m + 1);
    tx(checking.id, first, "HARBOR POINT MTG PAYMENT", "Harbor Point Mortgage (Sandbox)", -(juniperPI + juniperEscrow), "posted", "housing");
    tx(checking.id, addDays(first, 1), "JUNIPER ROW HOA DUES", "Juniper Row Homeowners Association", -21_500, "posted", "housing");
    tx(checking.id, addDays(first, 8), "HILL COUNTRY ELECTRIC AUTOPAY", "Hill Country Electric (Sandbox)", -electric[6 - m]!, "posted", "utilities");
    tx(checking.id, addDays(first, 13), "CEDAR FIBER INTERNET", "Cedar Fiber (Sandbox)", -7_500, "posted", "utilities");
    tx(checking.id, addDays(first, 14), "PAYROLL — SANDBOX EMPLOYER INC", "Sandbox Employer Inc", 1_145_000, "posted", "income");
    tx(checking.id, addDays(first, 5 + m), "GROCERY MARKET", null, -(18_000 + m * 1_370), "posted", "groceries");
  }
  tx(invest.id, T(-3), "TRANSFER TO HIGH-YIELD SAVINGS ••0937", "Sagolik Sandbox Bank", -4_000_000, "pending", "transfer");
  tx(savings.id, T(-3), "INCOMING TRANSFER FROM BROKERAGE ••2210", "Sagolik Sandbox Brokerage", 4_000_000, "pending", "transfer");

  /* ───────────── Autopilot (owned property) ───────────── */
  const rule = (r: Pick<AutopilotRuleRow, "obligation_id" | "action" | "status" | "execution_mode" | "lead_days" | "next_run_on" | "failure_reason">): AutopilotRuleRow => ({
    id: newId(), ...base, ...stamps, property_id: juniper.id, plan_id: null, funding_account_id: r.action === "schedule_payment" ? checking.id : null,
    provider_id: r.execution_mode === "simulated" ? "sandbox_payments" : null, provider_reference: null, last_run_at: ts(T(-27)), ...r,
  });
  const autopilotRules: AutopilotRuleRow[] = [
    rule({ obligation_id: jo("mortgage").id, action: "schedule_payment", status: "active", execution_mode: "simulated", lead_days: 3, next_run_on: addDays(nextFirst, -3), failure_reason: null }),
    rule({ obligation_id: jo("hoa").id, action: "schedule_payment", status: "failed", execution_mode: "simulated", lead_days: 3, next_run_on: addDays(nextFirst, -3), failure_reason: "The HOA changed its payment processor. The payee must be re-verified before the next payment." }),
    rule({ obligation_id: jo("property_tax").id, action: "track", status: "active", execution_mode: "reminder_only", lead_days: 30, next_run_on: null, failure_reason: null }),
    rule({ obligation_id: jo("insurance").id, action: "track", status: "active", execution_mode: "reminder_only", lead_days: 30, next_run_on: null, failure_reason: null }),
    rule({ obligation_id: jo("utility_electric").id, action: "remind", status: "active", execution_mode: "reminder_only", lead_days: 5, next_run_on: T(4), failure_reason: null }),
  ];

  /* ───────────── Ownership + homebook ───────────── */
  const ownershipRecords = [{
    id: newId(), ...base, ...stamps, property_id: juniper.id, ownership_date: ownershipDate, vesting: "Individual",
    title_company: "Cedar Title & Escrow (Sandbox)", deed_recorded_on: addDays(ownershipDate, 1),
    deed_reference: "SBX-DEED-0614-8821", purchase_price_cents: 61_200_000,
  }];
  const hb = (h: Pick<HomebookEntryRow, "category" | "title" | "occurred_on"> & Partial<HomebookEntryRow>): HomebookEntryRow => ({
    id: newId(), ...base, ...stamps, property_id: juniper.id, amount_cents: null, vendor: null, document_id: null, expires_on: null, notes: null, ...h,
  });
  const deedDoc = documents.find((d) => d.title === "Warranty deed (recorded)")!;
  const homebookEntries: HomebookEntryRow[] = [
    hb({ category: "purchase", title: "Purchase closed — 1106 Juniper Street", occurred_on: ownershipDate, amount_cents: 61_200_000, vendor: "Cedar Title & Escrow (Sandbox)" }),
    hb({ category: "ownership_document", title: "Warranty deed recorded", occurred_on: addDays(ownershipDate, 1), document_id: deedDoc.id }),
    hb({ category: "inspection", title: "Pre-purchase home inspection", occurred_on: addDays(ownershipDate, -30), amount_cents: 65_000, vendor: "Brightline Inspections (Sandbox)" }),
    hb({ category: "warranty", title: "HVAC system — 10-year parts warranty", occurred_on: addDays(ownershipDate, -400), vendor: "Keystone Air (Sandbox)", expires_on: addDays(ownershipDate, 3250) }),
    hb({ category: "warranty", title: "Water heater — manufacturer warranty", occurred_on: addDays(ownershipDate, -700), vendor: "Keystone Air (Sandbox)", expires_on: T(45), notes: "Expires soon. Consider an inspection before expiry." }),
    hb({ category: "renovation", title: "Primary bathroom remodel", occurred_on: T(-560), amount_cents: 1_840_000, vendor: "Oakline Builders (Sandbox)" }),
    hb({ category: "invoice", title: "Roof inspection and flashing repair", occurred_on: T(-380), amount_cents: 74_000, vendor: "Summit Roofing (Sandbox)" }),
    hb({ category: "maintenance", title: "HVAC seasonal service", occurred_on: T(-120), amount_cents: 18_900, vendor: "Keystone Air (Sandbox)" }),
    hb({ category: "insurance", title: "Homeowner's policy renewed", occurred_on: T(-223), amount_cents: 264_000, vendor: "Lonestar Mutual Insurance (Sandbox)", expires_on: T(142) }),
    hb({ category: "tax", title: "Prior-year property tax paid via escrow", occurred_on: T(-240), amount_cents: 1_190_000, vendor: "Travis County Tax Office (Sandbox)" }),
  ];


  return {
    properties: [mercer, juniper, wren],
    transactions: [mercerTx, juniperTx],
    loans: [mercerLoan, juniperLoan],
    milestones,
    blockers,
    documents,
    obligations,
    autopilotRules,
    ownershipRecords,
    homebookEntries,
    financialConnections: [bank, brokerage],
    accounts: [checking, savings, invest],
    accountTransactions: txns,
    integrationConnections,
  };
}
