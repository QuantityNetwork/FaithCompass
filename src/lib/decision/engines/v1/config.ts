/** Frozen copy of the v1 decision configuration (from product.ts at engine 1.0.0). Do not edit; add engines/v2. */
import { docValue } from "./case";
import {
  CONTROLS,
  DEFAULT_ASSUMPTIONS,
  PREMISES,
  type Assumptions,
} from "./engine";

export const CONFIG_VERSION = "dr-config-1.0.0";

const fmt = (v: number, unit: string) =>
  unit === "$M" ? `$${v}M` : `${v}${unit}`;

export type AssumptionState = "FIXED" | "ADJUSTABLE" | "DISPUTED";

const FIXED: { label: string; source: string; value: number; unit: string }[] =
  [
    {
      label: "Revenue FY2025",
      source: "DOC-01",
      value: docValue("DOC-01", "revenue_fy2025"),
      unit: "$M",
    },
    {
      label: "Reported EBITDA margin FY2025",
      source: "DOC-01",
      value: docValue("DOC-01", "ebitda_margin_fy2025"),
      unit: "%",
    },
    {
      label: "Cash at close",
      source: "DOC-03",
      value: docValue("DOC-03", "cash_at_close"),
      unit: "$M",
    },
    {
      label: "Undrawn RCF",
      source: "DOC-03",
      value: docValue("DOC-03", "rcf_undrawn"),
      unit: "$M",
    },
    {
      label: "Minimum interest cover",
      source: "DOC-05",
      value: docValue("DOC-05", "min_interest_cover"),
      unit: "x",
    },
    {
      label: "Customer concentration policy limit",
      source: "DOC-04",
      value: docValue("DOC-04", "concentration_policy"),
      unit: "%",
    },
    {
      label: "Stress EBITDA decline",
      source: "DOC-04",
      value: docValue("DOC-04", "stress_ebitda_decline"),
      unit: "%",
    },
  ];

/**
 * The per-decision configuration. It is fixed for this case version except the
 * assumption values, which come from the snapshot, so it is saved into every
 * passport and covered by its hash.
 */
export function decisionConfiguration(a: Assumptions = DEFAULT_ASSUMPTIONS) {
  return {
    version: CONFIG_VERSION,
    objective:
      "Decide whether the synthetic $120M facility can go to a (simulated) credit committee, and on which conditions.",
    evidence_standard:
      "Every figure used in a calculation must trace to a named source document. Unverified documents may inform the analysis but cannot by themselves satisfy a condition; the verification condition stays unmet until they are verified by a human.",
    assumptions: [
      ...FIXED.map((f) => ({
        state: "FIXED" as AssumptionState,
        label: f.label,
        value: fmt(f.value, f.unit),
        source: f.source,
        note: "Taken from the source document; not adjustable in this case.",
      })),
      ...CONTROLS.map((c) => {
        const v = a[c.key];
        return {
          state: "ADJUSTABLE" as AssumptionState,
          label: c.label,
          value: fmt(v, c.unit),
          source: c.source,
          note:
            v === c.default
              ? "Source value."
              : `Adjusted from the source value ${fmt(c.default, c.unit)}.`,
        };
      }),
      ...PREMISES.map((p) => ({
        state: "DISPUTED" as AssumptionState,
        label: `${p.id}: ${p.statement}`,
        value: a.rejected.includes(p.id) ? "rejected" : "accepted",
        source: p.sources.join(", "),
        note: `If rejected: ${p.ifRejected}`,
      })),
    ],
    approval_policy: {
      actions: ["propose", "review", "reject", "approve"],
      rule: "The system may only propose. Review, rejection and approval are human actions by authorized people. In this public demonstration no human action is recorded and nothing is approved.",
    },
    escalation_rules: [
      "A condition with missing evidence (EVIDENCE_MISSING) is escalated to a human before any recommendation.",
      "A confirmed contradiction between sources is escalated until a human resolves which source governs.",
      "An unresolved interpretation of a contract term is escalated to legal review.",
      "A different reporting basis is shown side by side and is not escalated as a conflict.",
    ],
    monitoring_triggers: [
      "A new or revised source document for this case (planned; no monitoring runs in the demonstration).",
      "Top customer renewal outcome in Q1 2027 (DOC-07).",
      "Collateral appraisal received (DOC-08).",
      "Covenant headroom below the configured threshold in a new compliance certificate.",
    ],
  };
}

export type DecisionConfiguration = ReturnType<typeof decisionConfiguration>;
