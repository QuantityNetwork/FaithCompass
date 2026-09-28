import { describe, expect, it } from "vitest";
import { TOOLS, toolRecords } from "@/server/tools/registry";
import { createHarness } from "./support/harness";

type Data = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe("tool registry", () => {
  it("registers every tool with complete, model-facing metadata", () => {
    expect(TOOLS.length).toBeGreaterThanOrEqual(29);
    for (const record of toolRecords()) {
      expect(record.description).toContain("WHEN TO USE");
      expect(record.description).toContain("WHEN NOT TO USE");
      expect(record.description).toContain("REQUIRED CONTEXT");
      expect(record.description).toContain("AUTHORIZATION CLASS");
      expect(record.description).toContain("EXAMPLE");
      expect(record.input_schema.type).toBe("object");
      expect(record.tool_id).toMatch(/^[a-z_]+@\d+$/);
      // No low-level data operations are ever exposed.
      expect(record.name).not.toMatch(/sql|insert|update_table|raw|row/);
    }
  });

  it("requires approval for every EXECUTE tool", () => {
    for (const t of TOOLS.filter((t) => t.executionClass === "execute")) {
      expect(t.approvalRequired).toBe(true);
      expect(t.describeApproval).toBeTypeOf("function");
      expect(t.idempotency).toBe("approval");
    }
  });
});

describe("tools against the sandbox dataset", () => {
  const h = createHarness();
  const owner = () => h.caller();

  it("search_properties returns exact identifiers", async () => {
    const env = await h.call(owner(), "search_properties", { status: ["closing"] });
    expect(env.status).toBe("success");
    const data = env.data as Data;
    expect(data.properties[0].reference).toBe("SGK-1042");
    expect(data.properties[0].address).toContain("245 Mercer Avenue");
    expect(data.properties[0].active_transaction.reference).toBe("TX-2026-0419");
  });

  it("get_property returns permission-filtered sections", async () => {
    const full = await h.call(owner(), "get_property", { property_id: "SGK-1042" });
    expect(full.status).toBe("success");
    expect((full.data as Data).financing.lender).toContain("Northfield");

    const limited = await h.call(h.caller({ scopes: ["property.read"] }), "get_property", { property_id: "SGK-1042" });
    const data = limited.data as Data;
    expect(data.financing).toEqual({ restricted: true, required_scope: "transaction.read", reason: expect.any(String) });
    expect(data.connected_accounts.restricted).toBe(true);
    expect(data.address.formatted).toContain("Austin");
  });

  it("get_closing_status reports every lifecycle stage", async () => {
    const env = await h.call(owner(), "get_closing_status", { property_id: "SGK-1042" });
    expect(env.status).toBe("success");
    const data = env.data as Data;
    expect(data.stages.map((s: Data) => s.stage)).toEqual([
      "offer", "contract", "financing", "inspection", "title", "insurance", "escrow", "funds", "signing", "recording", "ownership",
    ]);
    expect(data.days_to_closing).toBe(28);
    expect(data.overall_status).toBe("blocked");
    expect(env.meta.state_changed).toBe(false);
  });

  it("identify_closing_blockers combines records and derived analysis", async () => {
    const env = await h.call(owner(), "identify_closing_blockers", { transaction_id: "TX-2026-0419" });
    const data = env.data as Data;
    const titles = data.blockers.map((b: Data) => b.title);
    expect(titles).toContain("Homeowner's insurance binder missing");
    expect(titles).toContain("Closing funds depend on a pending transfer");
    expect(data.blockers.some((b: Data) => b.source === "derived" && b.stage === "signing")).toBe(true);
    for (const b of data.blockers) {
      expect(b).toHaveProperty("severity");
      expect(b).toHaveProperty("owner");
      expect(b).toHaveProperty("recommended_next_action");
    }
  });

  it("verify_funds_readiness is indicative and minimizes account data", async () => {
    const env = await h.call(owner(), "verify_funds_readiness", { property_id: "SGK-1042" });
    const data = env.data as Data;
    expect(data.status).toBe("ready_pending_transfers");
    expect(data.confidence).toBe("indicative");
    expect(data.accounts).toBeNull();
    expect(data.verified_available.amount).toBe(159_720);
    expect(data.pending_incoming.amount).toBe(40_000);
    expect(data.disclaimer).toMatch(/not a verification of funds/i);
  });

  it("calculate_cash_to_close separates categories and credits", async () => {
    const env = await h.call(owner(), "calculate_cash_to_close", { property_id: "SGK-1042" });
    const data = env.data as Data;
    expect(data.breakdown.map((b: Data) => b.category)).toEqual(["down_payment", "lender_costs", "title", "settlement", "escrow", "prepaid", "taxes", "other"]);
    expect(data.breakdown[0].subtotal.amount).toBe(218_750);
    expect(data.credits.some((c: Data) => c.label.startsWith("Earnest money"))).toBe(true);
    expect(data.estimated_cash_to_close.amount).toBeGreaterThan(180_000);
    expect(data.estimated_cash_to_close.amount).toBeLessThan(205_000);
  });

  it("compare_financing_scenarios ranks fixed and adjustable options", async () => {
    const env = await h.call(owner(), "compare_financing_scenarios", {
      property_id: "SGK-1042",
      scenarios: [
        { label: "30-year fixed", down_payment_percent: 25, interest_rate_percent: 6.375, term_years: 30 },
        { label: "5/6 ARM", down_payment_percent: 25, interest_rate_percent: 5.75, term_years: 30, rate_type: "adjustable", arm_fixed_years: 5, arm_adjusted_rate_percent: 7.25 },
        { label: "15-year fixed", down_payment_percent: 25, interest_rate_percent: 5.75, term_years: 15 },
      ],
    });
    expect(env.status).toBe("success");
    const data = env.data as Data;
    expect(data.scenarios[0].monthly_principal_interest.amount).toBeCloseTo(4094.17, 0);
    expect(data.comparison.lowest_monthly).toBe("5/6 ARM");
    expect(data.scenarios[1].payment_after_reset.amount).toBeGreaterThan(data.scenarios[1].monthly_principal_interest.amount);
  });

  it("compare_financing_scenarios asks for missing ARM parameters", async () => {
    const env = await h.call(owner(), "compare_financing_scenarios", {
      purchase_price: 500000,
      scenarios: [{ label: "ARM", interest_rate_percent: 5.5, term_years: 30, rate_type: "adjustable" }],
    });
    expect(env.status).toBe("needs_input");
  });

  it("analyze_property_purchase reports assumptions and missing information", async () => {
    const env = await h.call(owner(), "analyze_property_purchase", { property_id: "SGK-1063", down_payment_percent: 10, interest_rate_percent: 6.25 });
    expect(env.status).toBe("success");
    const data = env.data as Data;
    expect(data.acquisition_summary.loan_to_value_percent).toBe(90);
    expect(data.risk_flags.map((f: Data) => f.code)).toContain("pmi_required");
    expect(data.missing_information.map((m: Data) => m.field)).toContain("gross_monthly_income");
    expect(data.disclaimer).toMatch(/estimates/i);
  });

  it("get_financing_status returns loan status and required actions", async () => {
    const env = await h.call(owner(), "get_financing_status", { property_id: "SGK-1042" });
    const data = env.data as Data;
    expect(data.loan.status).toBe("conditional_approval");
    expect(data.loan.rate_lock_covers_closing).toBe(true);
    expect(data.required_actions).toHaveLength(2);
  });

  it("document tools report outstanding items by party", async () => {
    const list = await h.call(owner(), "list_transaction_documents", { property_id: "SGK-1042" });
    expect((list.data as Data).total).toBeGreaterThan(10);
    const status = await h.call(owner(), "get_document_status", { property_id: "SGK-1042" });
    expect((status.data as Data).complete_for_closing).toBe(false);
    const required = await h.call(owner(), "retrieve_required_documents", { property_id: "SGK-1042" });
    const parties = (required.data as Data).by_party.map((p: Data) => p.party);
    expect(parties).toEqual(expect.arrayContaining(["buyer", "hoa", "lender", "seller", "title"]));
  });

  it("cash-flow tools use obligations and connected-account activity", async () => {
    const accounts = await h.call(owner(), "get_connected_accounts", {});
    const accountsData = accounts.data as Data;
    expect(accountsData.accounts).toHaveLength(3);
    expect(accountsData.accounts[0].balance).toBeNull();
    expect(accountsData.accounts[0].mask).toMatch(/^••\d{4}$/);

    const cashflow = await h.call(owner(), "analyze_property_cashflow", { property_id: "SGK-1042" });
    expect(cashflow.status).toBe("success");
    const detect = await h.call(owner(), "detect_recurring_property_obligations", { property_id: "SGK-1017" });
    const detected = (detect.data as Data).obligations.filter((o: Data) => o.bank_activity);
    expect(detected.length).toBeGreaterThanOrEqual(3);
    const upcoming = await h.call(owner(), "get_upcoming_property_obligations", { days: 60 });
    expect((upcoming.data as Data).items.length).toBeGreaterThan(0);
  });

  it("ownership tools return the profile and homebook", async () => {
    const profile = await h.call(owner(), "get_ownership_profile", { property_id: "SGK-1017" });
    const data = profile.data as Data;
    expect(data.ownership_status).toBe("owned");
    expect(data.financing.estimated_balance.amount).toBeLessThan(489_600);
    expect(data.maintenance.expiring_soon.length).toBe(1);
    const pending = await h.call(owner(), "get_ownership_profile", { property_id: "SGK-1042" });
    expect(pending.status).toBe("partial");
    const homebook = await h.call(owner(), "get_property_homebook", { property_id: "SGK-1017" });
    expect((homebook.data as Data).entries_total).toBe(10);
  });

  it("autopilot status reports failures and coverage", async () => {
    const env = await h.call(owner(), "get_autopilot_status", { property_id: "SGK-1017" });
    const data = env.data as Data;
    expect(data.enabled).toBe(true);
    expect(data.failed_actions).toHaveLength(1);
    expect(data.unresolved_obligations.length).toBeGreaterThanOrEqual(1);
  });

  it("identity and integration tools describe the caller's authority", async () => {
    const ctx = await h.call(h.caller({ scopes: ["property.read", "closing.read"], maxClass: "read" }), "get_authorization_context", {});
    const data = ctx.data as Data;
    expect(data.tools.available).toContain("get_closing_status");
    expect(data.tools.unavailable.map((t: Data) => t.name)).toContain("activate_property_autopilot");
    const integrations = await h.call(owner(), "get_integration_status", {});
    expect((integrations.data as Data).payment_execution.mode).toBe("simulated");
  });
});
