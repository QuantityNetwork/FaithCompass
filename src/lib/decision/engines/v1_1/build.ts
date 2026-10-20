/**
 * Frozen passport builders for case version 1.0.0 and engine 1.1.0 (engine 1.0.0 plus selective recalculation in
 * engine.ts; passport content is evaluated identically).
 *
 * This directory (engines/v1_1) is the complete evaluation of a v1 passport: calculation rules (engine.ts), the
 * Adversarial Chamber (chamber.ts), the Contradiction Map (contradictions.ts), the decision configuration
 * (config.ts), the source helpers (case.ts) and the content/rendering spec (this file). Its source is hashed and the
 * hash pinned in engines/index.ts; a test fails if any byte changes. Changing the evaluation means adding engines/v2.
 */
import type { ArchivedCaseData } from "../../versions";
import { sourceInventory } from "./case";
import { chamber } from "./chamber";
import { contradictionsView } from "./contradictions";
import { CONFIG_VERSION, decisionConfiguration } from "./config";
import {
  DEFAULT_ASSUMPTIONS,
  PREMISES,
  evaluate,
  traceFromDefaults,
  type Assumptions,
} from "./engine";

export interface V1State {
  t: string;
  a: Assumptions;
}

export const REVIEWER_NONE = "none (simulated decision)";

/** The integrity note as formats 1-2 printed it. */
export const SIGNATURE_MEANING_V1 =
  "The SHA-256 hash shows the passport is unchanged since it was generated; a signature, when present, also shows who issued it (the holder of the published key). They do not show that the content is correct, and they are not a third-party attestation.";

export const SIGNATURE_MEANING_V3 =
  "The SHA-256 hash shows the passport is unchanged since it was generated. A signature, when present, was made once at issuance over this hash, the key id and the issue time, and shows who issued it (the holder of the published key). Neither shows that the content is correct, and neither is a third-party attestation.";

/** Format 2 content (production 0.17 / PR #17), byte for byte. */
export function buildFormat2(
  id: string,
  state: V1State,
  data: ArchivedCaseData,
  dataSha256: string,
): Record<string, unknown> {
  const a = state.a;
  const ev = evaluate(a);
  const nodes = Object.values(ev);
  const trace = traceFromDefaults(a);
  return {
    id,
    title: `Decision Passport: ${data.case.title}`,
    label: data.case.label,
    generated_at: state.t,
    case: {
      id: data.case.id,
      version: data.version,
      content_sha256: dataSha256,
      archive: data.path,
      borrower: data.case.borrower,
      question: data.case.question,
      facility: data.case.facility,
    },
    status: "SIMULATED: demonstration only. No credit decision has been made.",
    reviewer: REVIEWER_NONE,
    product: "AbrahamMoses Decision Twin (demonstration)",
    versions: {
      ruleset: data.ruleset,
      configuration: CONFIG_VERSION,
      model: "none (deterministic rules; no AI model)",
      passport_format: "DP2",
    },
    configuration: decisionConfiguration(a),
    sources: sourceInventory(data.documents),
    assumptions: { ...a, defaults: DEFAULT_ASSUMPTIONS },
    premises: PREMISES.map((p) => ({
      id: p.id,
      statement: p.statement,
      sources: p.sources,
      accepted: !a.rejected.includes(p.id),
    })),
    calculations: nodes
      .filter((n) => n.kind === "metric" || n.kind === "effective")
      .map((n) => ({
        id: n.id,
        label: n.label,
        value: n.value,
        display: n.display,
        formula: n.formula ?? null,
        inputs: n.deps,
      })),
    scenarios: {
      base: {
        leverage: ev["m.leverage"].display,
        coverage: ev["m.coverage"].display,
      },
      stress: {
        ebitda: ev["m.stressEbitda"].display,
        leverage: ev["m.stressLeverage"].display,
        coverage: ev["m.stressCoverage"].display,
      },
    },
    conditions: nodes
      .filter((n) => n.kind === "condition")
      .map((n) => ({
        id: n.id,
        label: n.label,
        status: n.status,
        note: n.note ?? null,
      })),
    warnings: nodes
      .filter((n) => n.kind === "warning" && n.status === "ACTIVE")
      .map((n) => ({ id: n.id, label: n.label, note: n.note ?? null })),
    conclusion: ev.conclusion.display,
    claims: chamber(ev, a).map((x) => ({
      id: x.id,
      side: x.side,
      text: x.text,
      nodes: x.nodes,
      docs: x.docs,
    })),
    conflicts: contradictionsView().map((c) => ({
      id: c.id,
      class: c.class,
      conflict: c.conflict,
      title: c.title,
      a: c.a,
      b: c.b,
      human_action: c.humanAction,
    })),
    open_questions: nodes
      .filter(
        (n) =>
          n.kind === "condition" &&
          (n.status === "NEEDS_HUMAN_JUDGMENT" ||
            n.status === "EVIDENCE_MISSING"),
      )
      .map((n) => `${n.label}: ${n.note}`),
    audit_history: [
      {
        at: state.t,
        event: "passport_generated",
        detail: `From case ${data.case.id} v${data.version} (archived, sha256 ${dataSha256.slice(0, 16)}…) with ruleset ${data.ruleset}.`,
      },
      ...trace.changes.map((c) => ({
        at: state.t,
        event: "input_changed",
        detail: `${c.label}: ${c.from} → ${c.to}`,
      })),
      ...(trace.changes.length
        ? [
            {
              at: state.t,
              event: "conclusions_affected",
              detail: trace.affected.join(", ") || "none",
            },
          ]
        : []),
    ],
    reproducibility:
      "Open this passport ID at /institutional/decision-room/passport/{id} or call GET /api/institutional/decision-room/passport/verify?id={id}&sha256={hash}. The ID encodes the case version and every input; the passport is rebuilt from that archived case version, so the same passport and hash are produced with no stored state.",
    legal_note:
      "Decision support only. This passport is an evidentiary and governance record. It is not a binding decision, an audit opinion, a regulatory approval or a certification; the responsible institution keeps responsibility for any decision.",
    integrity_note: SIGNATURE_MEANING_V1,
  };
}

/**
 * Format 1 content, exactly as production 690beea built it (frozen: changing a byte breaks the hashes of passports
 * already issued). It predates the archive hash, so it carries no case.content_sha256.
 */
export function buildFormat1(
  id: string,
  state: V1State,
  data: ArchivedCaseData,
): Record<string, unknown> {
  const a = state.a;
  const ev = evaluate(a);
  const nodes = Object.values(ev);
  const trace = traceFromDefaults(a);
  return {
    id,
    title: `Decision Passport: ${data.case.title}`,
    label: data.case.label,
    generated_at: state.t,
    case: {
      id: data.case.id,
      version: data.version,
      borrower: data.case.borrower,
      question: data.case.question,
      facility: data.case.facility,
    },
    status: "SIMULATED: demonstration only. No credit decision has been made.",
    reviewer: REVIEWER_NONE,
    product: "AbrahamMoses Decision Twin (demonstration)",
    versions: {
      ruleset: data.ruleset,
      configuration: CONFIG_VERSION,
      model: "none (deterministic rules; no AI model)",
      passport_format: "DP1",
    },
    configuration: decisionConfiguration(a),
    sources: sourceInventory(data.documents),
    assumptions: { ...a, defaults: DEFAULT_ASSUMPTIONS },
    premises: PREMISES.map((p) => ({
      id: p.id,
      statement: p.statement,
      sources: p.sources,
      accepted: !a.rejected.includes(p.id),
    })),
    calculations: nodes
      .filter((n) => n.kind === "metric" || n.kind === "effective")
      .map((n) => ({
        id: n.id,
        label: n.label,
        value: n.value,
        display: n.display,
        formula: n.formula ?? null,
        inputs: n.deps,
      })),
    scenarios: {
      base: {
        leverage: ev["m.leverage"].display,
        coverage: ev["m.coverage"].display,
      },
      stress: {
        ebitda: ev["m.stressEbitda"].display,
        leverage: ev["m.stressLeverage"].display,
        coverage: ev["m.stressCoverage"].display,
      },
    },
    conditions: nodes
      .filter((n) => n.kind === "condition")
      .map((n) => ({
        id: n.id,
        label: n.label,
        status: n.status,
        note: n.note ?? null,
      })),
    warnings: nodes
      .filter((n) => n.kind === "warning" && n.status === "ACTIVE")
      .map((n) => ({ id: n.id, label: n.label, note: n.note ?? null })),
    conclusion: ev.conclusion.display,
    claims: chamber(ev, a).map((x) => ({
      id: x.id,
      side: x.side,
      text: x.text,
      nodes: x.nodes,
      docs: x.docs,
    })),
    conflicts: contradictionsView().map((c) => ({
      id: c.id,
      class: c.class,
      conflict: c.conflict,
      title: c.title,
      a: c.a,
      b: c.b,
      human_action: c.humanAction,
    })),
    open_questions: nodes
      .filter(
        (n) =>
          n.kind === "condition" &&
          (n.status === "NEEDS_HUMAN_JUDGMENT" ||
            n.status === "EVIDENCE_MISSING"),
      )
      .map((n) => `${n.label}: ${n.note}`),
    audit_history: [
      {
        at: state.t,
        event: "passport_generated",
        detail: `From case ${data.case.id} v${data.version} with ruleset ${data.ruleset}.`,
      },
      ...trace.changes.map((c) => ({
        at: state.t,
        event: "input_changed",
        detail: `${c.label}: ${c.from} → ${c.to}`,
      })),
      ...(trace.changes.length
        ? [
            {
              at: state.t,
              event: "conclusions_affected",
              detail: trace.affected.join(", ") || "none",
            },
          ]
        : []),
    ],
    reproducibility:
      "Open this passport ID at /institutional/decision-room/passport/{id} or call GET /api/institutional/decision-room/passport/verify?id={id}&sha256={hash}. The ID encodes every input, so the same passport and hash are rebuilt with no stored state.",
    legal_note:
      "Decision support only. This passport is an evidentiary and governance record. It is not a binding decision, an audit opinion, a regulatory approval or a certification; the responsible institution keeps responsibility for any decision.",
    integrity_note:
      "The SHA-256 hash shows this passport has not changed since it was generated. It does not show that the content is correct.",
  };
}

/** Format 3: format 2 plus the frozen engine identity. The issuance signature is outside the content. */
export function buildFormat3(
  id: string,
  state: V1State,
  data: ArchivedCaseData,
  dataSha256: string,
  engine: { version: string; sha256: string; source: string },
): Record<string, unknown> {
  const c = buildFormat2(id, state, data, dataSha256) as Record<
    string,
    unknown
  > & { versions: Record<string, string> };
  return {
    ...c,
    versions: { ...c.versions, engine: engine.version, passport_format: "DP3" },
    engine: {
      version: engine.version,
      sha256: engine.sha256,
      source: engine.source,
    },
    reproducibility:
      "Open this passport ID at /institutional/decision-room/passport/{id} or call GET /api/institutional/decision-room/passport/verify?id={id}&sha256={hash}. The ID encodes the case version, the engine version and every input; the passport is rebuilt from that archived case version with that frozen engine, so the same passport and hash are produced with no stored state.",
    integrity_note: SIGNATURE_MEANING_V3,
  };
}
