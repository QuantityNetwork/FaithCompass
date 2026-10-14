/**
 * MCP tools.
 *
 * Every tool is read-only and returns published records only. Input and
 * output schemas are generated from the same Zod schemas the REST API is
 * validated against, so a tool's declared contract is the contract its
 * results are tested against.
 */

import { z } from 'zod/v4';
import {
  ChangelogEntryV1,
  ClaimFilters,
  CompareV1,
  DependenciesV1,
  SearchParams,
  SimulationParams,
  changelog,
  compareTraditions,
  getCase,
  getCitation,
  getClaim,
  getDependencies,
  getProvenance,
  listCases,
  listClaims,
  matchesNode,
  runSimulation,
  searchRecord,
  CaseSummaryV1,
} from '@/lib/api/operations';
import {
  AxiomV1,
  CaseV1,
  CitationV1,
  ClaimSummaryV1,
  ClaimV1,
  CovenantV1,
  DoctrineV1,
  ProvenanceV1,
  SearchV1,
  SimulationV1,
  axiomView,
  covenantView,
  doctrineView,
} from '@/lib/api/views';
import { getRecord } from '@/lib/record/record';
import { TRADITION_FAMILIES } from '@/lib/record/taxonomy';

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  input: z.ZodObject;
  output: z.ZodType;
  run(args: Record<string, unknown>): unknown;
}

const Code = z.string().min(1).max(40);
const Revision = z.number().int().positive().optional().describe('Revision number; omit for the current revision');

const listEnvelope = <T extends z.ZodType>(item: T) =>
  z.object({ total: z.number().int(), data: z.array(item), record_version: z.string() });

const READ_ONLY_NOTE = 'Read-only; returns published records only.';

export const TOOLS: ToolDefinition[] = [
  {
    name: 'search_record',
    title: 'Search the research record',
    description: `Find what the AbrahamMoses record holds on a question, a scripture reference (e.g. "Hebrews 7", "Q 3:67") or a topic. Returns the matching research case (if one clearly fits), ranked claims and other records. Nothing is generated: every result is a published record with a code you can open with get_claim. Requests to score or rank whole religions are redirected to analysable questions. ${READ_ONLY_NOTE}`,
    input: SearchParams,
    output: SearchV1,
    run: (args) => searchRecord(getRecord(), SearchParams.parse(args)),
  },
  {
    name: 'get_claim',
    title: 'Get a claim',
    description: `Full record for one claim (AM-CLAIM-…): statement, classification, primary witnesses and the editions cited, evidence, variants, a confidence profile on separate axes (textual, philological, historical, inferential — never combined), per-tradition acceptance, derivations, counter-models, revision history, editorial and machine-involvement disclosure, and a stable citation. Use when you need to quote or rely on a claim. ${READ_ONLY_NOTE}`,
    input: z.object({ code: Code.describe('Claim code, e.g. AM-CLAIM-000184'), revision: Revision }),
    output: ClaimV1,
    run: (args) => {
      const a = z.object({ code: Code, revision: Revision }).parse(args);
      return getClaim(getRecord(), a.code, a.revision);
    },
  },
  {
    name: 'list_claims',
    title: 'List claims',
    description: `List claims, filtered by topic, classification, role, research case, tradition or publication status. Returns summaries; use get_claim for the full record. ${READ_ONLY_NOTE}`,
    input: ClaimFilters,
    output: listEnvelope(ClaimSummaryV1),
    run: (args) => {
      const record = getRecord();
      const r = listClaims(record, ClaimFilters.parse(args));
      return { total: r.total, data: r.data, record_version: record.version };
    },
  },
  {
    name: 'get_provenance',
    title: 'Get a provenance chain',
    description: `The reasoning chain behind a claim, in eight steps: finding, claims used, supporting evidence, primary source, covenant relationships, doctrine connections, interpretations and counterviews. ${READ_ONLY_NOTE}`,
    input: z.object({ code: Code, revision: Revision }),
    output: ProvenanceV1,
    run: (args) => {
      const a = z.object({ code: Code, revision: Revision }).parse(args);
      return getProvenance(getRecord(), a.code, a.revision);
    },
  },
  {
    name: 'get_dependencies',
    title: 'Get what a claim rests on',
    description: `A claim's derivations — each an independent way of arriving at it, with necessary and supporting premises and the reading principles (axioms) it requires — plus everything upstream and downstream of it. ${READ_ONLY_NOTE}`,
    input: z.object({ code: Code }),
    output: DependenciesV1,
    run: (args) => getDependencies(getRecord(), z.object({ code: Code }).parse(args).code),
  },
  {
    name: 'simulate_rejection',
    title: 'Simulate rejecting claims or assumptions',
    description:
      'Reject one or more claims (AM-CLAIM-…) or reading principles (AM-AX-…), or apply a tradition’s lens, and see what still holds. A conclusion breaks only when none of its independent derivations survives; textual reports keep their standing as reports when the reading built on them fails; rival readings are reported on both sides. This is a simulation: the record and its sources are never changed. Use it to test how much a conclusion depends on a disputed assumption.',
    input: SimulationParams,
    output: SimulationV1,
    run: (args) => runSimulation(getRecord(), SimulationParams.parse(args)),
  },
  {
    name: 'list_research_cases',
    title: 'List research cases',
    description: `The flagship research cases — Jewish, Christian, Islamic and Latter-day Saint studies — each a contested question with opposing positions and their derivations. ${READ_ONLY_NOTE}`,
    input: z.object({}),
    output: z.object({ data: z.array(CaseSummaryV1) }),
    run: () => ({ data: listCases(getRecord()) }),
  },
  {
    name: 'get_research_case',
    title: 'Get a research case',
    description: `One research case: the question, how it is framed and in whose categories, the positions and who holds them, each tradition's response (including where a tradition asks a different question), and known limitations. ${READ_ONLY_NOTE}`,
    input: z.object({ slug: z.string().min(1).max(100).describe('Case slug, e.g. torah-permanence') }),
    output: CaseV1,
    run: (args) => getCase(getRecord(), z.object({ slug: z.string() }).parse(args).slug),
  },
  {
    name: 'compare_traditions',
    title: 'Compare traditions on a research case',
    description:
      'Side-by-side responses of each tradition to a research case, with the reading principles each tradition’s lens removes and which positions still stand under it. Marks explicitly where a tradition asks a different question or where comparison is not meaningful.',
    input: z.object({ case: z.string().min(1).max(100).describe('Case slug') }),
    output: CompareV1,
    run: (args) => compareTraditions(getRecord(), z.object({ case: z.string() }).parse(args).case),
  },
  {
    name: 'list_axioms',
    title: 'List reading principles',
    description: `The tradition axioms — reading principles such as typology, Torah permanence or an open canon — with each tradition's recorded stance and the derivations that use them. ${READ_ONLY_NOTE}`,
    input: z.object({}),
    output: z.object({ data: z.array(AxiomV1) }),
    run: () => {
      const record = getRecord();
      return { data: record.data.axioms.map((a) => axiomView(record, a.code)) };
    },
  },
  {
    name: 'list_covenants',
    title: 'List Covenant Map relationships',
    description: `Covenant relationships, each attributed to the traditions whose reading of covenantal history it belongs to. Filter by tradition family. ${READ_ONLY_NOTE}`,
    input: z.object({ family: z.enum(TRADITION_FAMILIES).optional() }),
    output: z.object({ data: z.array(CovenantV1) }),
    run: (args) => {
      const { family } = z.object({ family: z.enum(TRADITION_FAMILIES).optional() }).parse(args);
      const record = getRecord();
      return {
        data: record.data.covenants.filter((e) => !family || e.readings.includes(family)).map((e) => covenantView(record, e.code)),
      };
    },
  },
  {
    name: 'list_doctrine_connections',
    title: 'List Doctrine Graph connections',
    description: `Doctrine Graph edges with relationship type, classification, tradition status and evidence. Filter by node (e.g. "abraham") or topic. ${READ_ONLY_NOTE}`,
    input: z.object({ node: z.string().max(100).optional(), topic: z.string().max(100).optional() }),
    output: z.object({ data: z.array(DoctrineV1) }),
    run: (args) => {
      const { node, topic } = z.object({ node: z.string().optional(), topic: z.string().optional() }).parse(args);
      const record = getRecord();
      const label = (id: string) => record.data.doctrineNodes.find((n) => n.id === id)!.label;
      return {
        data: record.data.doctrine
          .filter((e) => !node || matchesNode(e.source, label(e.source), node) || matchesNode(e.target, label(e.target), node))
          .filter((e) => !topic || e.topic.toLowerCase() === topic.toLowerCase())
          .map((e) => doctrineView(record, e.code)),
      };
    },
  },
  {
    name: 'get_citation',
    title: 'Cite a claim',
    description: `A stable citation for a claim revision, as text, BibTeX and CSL-JSON. ${READ_ONLY_NOTE}`,
    input: z.object({ code: Code, revision: Revision }),
    output: CitationV1,
    run: (args) => {
      const a = z.object({ code: Code, revision: Revision }).parse(args);
      return getCitation(getRecord(), a.code, a.revision);
    },
  },
  {
    name: 'get_record_history',
    title: 'Get the record’s revision history',
    description: `Every published and provisional revision across the record, newest first, with its change note. ${READ_ONLY_NOTE}`,
    input: z.object({ limit: z.number().int().min(1).max(200).default(25) }),
    output: z.object({ data: z.array(ChangelogEntryV1) }),
    run: (args) => {
      const { limit } = z.object({ limit: z.number().int().min(1).max(200).default(25) }).parse(args);
      return { data: changelog(getRecord()).slice(0, limit) };
    },
  },
];

export const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

function clean(schema: Record<string, unknown>): Record<string, unknown> {
  // MCP clients validate with JSON Schema validators that may not load the
  // 2020-12 meta-schema, so the $schema pointer is omitted.
  const { $schema, ...rest } = schema;
  void $schema;
  return rest;
}

export function toolListing(t: ToolDefinition) {
  return {
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: clean(z.toJSONSchema(t.input, { io: 'input' }) as Record<string, unknown>),
    outputSchema: clean(z.toJSONSchema(t.output, { io: 'output' }) as Record<string, unknown>),
    annotations: {
      title: t.title,
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  };
}
