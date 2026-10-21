/**
 * Deterministic extraction layer: fixed, documented patterns over the normalised text. No model, no network; the
 * same text always gives the same result. It finds what patterns can find reliably (parties defined in the
 * preamble, dates, amounts, durations, obligations introduced by "shall" / "must", standard clause topics, known
 * risk patterns, the absence of standard clauses) and nothing it would have to guess.
 */
import type { Fact as EngineFact } from '@/lib/contradiction/normalize';
import type { RawClause, Sentence } from './segment';
import { sentences } from './segment';
import type { Finding, Section, Severity, Span } from './schema';
import type { SpanTable } from './spans';

export const TOPICS = {
  definitions: { label: 'Definitions', heading: /definition|interpretation/i, body: /\bmeans\b|"[A-Z][^"]{1,40}" (?:means|shall mean)/ },
  scope: { label: 'Scope and services', heading: /scope|services|deliver|supply|goods|products|statement of work/i, body: /\b(services|deliverables|goods|products)\b.*\b(shall|will)\b/i },
  payment: { label: 'Payment', heading: /fee|payment|price|pricing|charge|invoic|remuneration|compensation|consideration/i, body: /\b(invoice[ds]?|fees?|payable|payment|price)\b/i },
  term: { label: 'Term and renewal', heading: /\bterm\b|duration|commencement|renewal/i, body: /\b(initial term|renew(?:al|s|ed)?|commence)\b/i },
  termination: { label: 'Termination', heading: /terminat|cancel/i, body: /\bterminat(e|ion)\b/i },
  liability: { label: 'Limitation of liability', heading: /liabilit/i, body: /\b(aggregate liability|liable|limitation of liability|consequential)\b/i },
  indemnity: { label: 'Indemnity', heading: /indemn/i, body: /\bindemnif(y|ies|ication)|hold harmless\b/i },
  ip: { label: 'Intellectual property', heading: /intellectual property|\bIP\b|licen[cs]e|ownership/i, body: /\b(intellectual property|copyright|patent|licen[cs]e|ownership of)\b/i },
  confidentiality: { label: 'Confidentiality', heading: /confidential|non-disclosure/i, body: /\bconfidential information\b/i },
  data_protection: { label: 'Data protection', heading: /data protection|privacy|personal data|GDPR/i, body: /\b(personal data|GDPR|data processing|processor)\b/i },
  warranties: { label: 'Warranties', heading: /warrant/i, body: /\bwarrant(s|y|ies)\b/i },
  force_majeure: { label: 'Force majeure', heading: /force majeure/i, body: /\bforce majeure\b/i },
  governing_law: { label: 'Governing law', heading: /governing law|applicable law|choice of law/i, body: /\bgoverned by\b|\blaws? of\b/i },
  dispute_resolution: { label: 'Dispute resolution', heading: /dispute|arbitration|jurisdiction/i, body: /\b(arbitration|courts? of|exclusive jurisdiction|mediation)\b/i },
  assignment: { label: 'Assignment', heading: /assign|transfer|subcontract/i, body: /\bassign(ment)?\b/i },
  notices: { label: 'Notices', heading: /notice/i, body: /\bnotices? (shall|must) be (given|sent|in writing)\b/i },
  entire_agreement: { label: 'Entire agreement', heading: /entire agreement|whole agreement/i, body: /\bentire agreement\b/i },
  non_compete: { label: 'Non-compete / non-solicitation / exclusivity', heading: /non-?compet|non-?solicit|exclusiv|restrictive covenant/i, body: /\b(non-?compete|not solicit|exclusive (supplier|provider|basis)|exclusivity)\b/i },
} as const;
export type Topic = keyof typeof TOPICS;

const TOPIC_SECTION: Partial<Record<Topic, Section>> = {
  payment: 'payment', liability: 'liability', indemnity: 'indemnity', ip: 'ip', confidentiality: 'confidentiality',
  governing_law: 'governing_law', dispute_resolution: 'dispute_resolution', data_protection: 'data_protection',
};

export function topicsOf(heading: string, body: string): Topic[] {
  const out: Topic[] = [];
  for (const [k, t] of Object.entries(TOPICS) as [Topic, (typeof TOPICS)[Topic]][]) {
    if (heading !== 'Preamble' && t.heading.test(heading)) out.push(k);
  }
  if (out.length) return out;
  for (const [k, t] of Object.entries(TOPICS) as [Topic, (typeof TOPICS)[Topic]][]) {
    const hits = body.match(new RegExp(t.body.source, t.body.flags.includes('g') ? t.body.flags : t.body.flags + 'g'));
    if (hits && hits.length >= 2) out.push(k);
  }
  return out;
}

/* ------------------------------------------------------------------ patterns */

const MONTH = '(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)';
export const DATE_RE = new RegExp(`\\b(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\s+\\d{4}|${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4})\\b`, 'g');
export const AMOUNT_RE = /(?:(?:EUR|USD|SEK|GBP|NOK|DKK|CHF)\s?|[€$£])\d{1,3}(?:[ ,.]\d{3})*(?:[.,]\d{1,2})?(?:\s?(?:million|thousand|m|k)\b)?|\b\d{1,3}(?:[ ,.]\d{3})*(?:[.,]\d{1,2})?\s?(?:million\s|thousand\s)?(?:EUR|USD|SEK|GBP|NOK|DKK|CHF|kronor|euros?|dollars?)\b/g;
const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, sixty: 60, ninety: 90 };
export const DURATION_RE = /\b(?:(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|fifteen|twenty|thirty|forty|forty-five|sixty|ninety)\s*\((\d{1,4})\)|(\d{1,4})|(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|fifteen|twenty|thirty|forty|forty-five|sixty|ninety))\s*(?:\(\d{1,4}\)\s*)?(business |calendar |working )?(days?|weeks?|months?|years?)\b/gi;
export const PERCENT_RE = /\b\d{1,3}(?:[.,]\d{1,2})?\s?(?:%|per ?cent)/gi;

export function durationValue(m: RegExpMatchArray): { n: number; unit: 'days' | 'weeks' | 'months' | 'years' } {
  const n = Number(m[2] ?? m[3] ?? NUMBER_WORDS[(m[1] ?? m[4] ?? '').toLowerCase()]);
  const u = m[6].toLowerCase().replace(/s$/, '') + 's';
  return { n, unit: u as 'days' | 'weeks' | 'months' | 'years' };
}
const inDays = (d: { n: number; unit: string }) => d.n * (d.unit === 'days' ? 1 : d.unit === 'weeks' ? 7 : d.unit === 'months' ? 30 : 365);

const ROLE_WORDS = /^(Supplier|Customer|Client|Provider|Service Provider|Contractor|Consultant|Company|Vendor|Buyer|Seller|Purchaser|Licensor|Licensee|Discloser|Disclosing Party|Recipient|Receiving Party|Employer|Employee|Landlord|Tenant|Lender|Borrower|Agency|Distributor|Partner|Party [A-Z])$/;
const LEGAL_FORM = /\b(AB|Ltd|Limited|LLC|Inc|GmbH|plc|AS|ASA|Oy|BV|NV|SA|SAS|SRL|S\.A\.|Corp|Corporation|LLP|LP|ApS|AG)\b\.?/;

/* ------------------------------------------------------------------ result */

export interface DetFact { value: string; span: Span }
export interface Deterministic {
  title: string;
  type: { value: string; span: Span } | null;
  parties: { name: string; role: string | null; span: Span }[];
  roles: string[];
  dates: DetFact[];
  amounts: DetFact[];
  durations: DetFact[];
  governingLaw: DetFact | null;
  clauseTopics: Map<string, Topic[]>;
  clauseTerms: Map<string, string[]>;
  findings: Omit<Finding, 'id'>[];
  facts: EngineFact[];
}

const DOC_TYPES: { type: string; re: RegExp; checklist: Topic[] }[] = [
  { type: 'Non-disclosure agreement', re: /\b(non-disclosure|confidentiality) agreement\b|\bNDA\b|\bmutual non-disclosure\b/i, checklist: ['definitions', 'confidentiality', 'term', 'governing_law', 'dispute_resolution'] },
  { type: 'Supply agreement', re: /\b(supply|supplier|purchase) agreement\b|\bframework agreement for the supply\b/i, checklist: ['scope', 'payment', 'term', 'termination', 'liability', 'warranties', 'force_majeure', 'governing_law', 'dispute_resolution', 'confidentiality', 'assignment'] },
  { type: 'Service agreement', re: /\b(services?|consult(ing|ancy)|master services|professional services|SaaS|subscription) agreement\b/i, checklist: ['scope', 'payment', 'term', 'termination', 'liability', 'ip', 'confidentiality', 'governing_law', 'dispute_resolution', 'data_protection'] },
  { type: 'Employment agreement', re: /\bemployment (agreement|contract)\b/i, checklist: ['scope', 'payment', 'termination', 'confidentiality', 'governing_law'] },
  { type: 'Lease agreement', re: /\b(lease|tenancy) agreement\b/i, checklist: ['payment', 'term', 'termination', 'governing_law'] },
  { type: 'Loan agreement', re: /\b(loan|credit|facility) agreement\b/i, checklist: ['payment', 'term', 'termination', 'governing_law'] },
  { type: 'Licence agreement', re: /\blicen[cs]e agreement\b/i, checklist: ['ip', 'payment', 'term', 'termination', 'liability', 'governing_law'] },
];
const GENERIC_CHECKLIST: Topic[] = ['payment', 'term', 'termination', 'liability', 'governing_law', 'dispute_resolution'];

const sentenceAt = (all: Sentence[], offset: number) => all.find((s) => offset >= s.start && offset < s.end) ?? null;

export function extractDeterministic(text: string, clauses: RawClause[], table: SpanTable, textSha256: string): Deterministic {
  const all = sentences(text);
  const sp = (s: { start: number; end: number }) => table.add(s.start, s.end);
  const findings: Omit<Finding, 'id'>[] = [];
  const add = (f: Omit<Finding, 'id' | 'layer' | 'requiresHumanReview'> & { requiresHumanReview?: boolean }) =>
    findings.push({ layer: 'deterministic', requiresHumanReview: f.requiresHumanReview ?? false, ...f });

  // Title and type.
  const firstLine = text.split('\n').find((l) => l.trim()) ?? '';
  const title = firstLine.replace(/^#+\s*/, '').trim().slice(0, 140);
  const head = text.slice(0, 2500);
  let type: Deterministic['type'] = null;
  let checklist = GENERIC_CHECKLIST;
  for (const t of DOC_TYPES) {
    const m = t.re.exec(head);
    if (m) {
      const s = sentenceAt(all, m.index) ?? { start: m.index, end: m.index + m[0].length };
      type = { value: t.type, span: sp(s) };
      checklist = t.checklist;
      break;
    }
  }

  // Parties: a name followed by a defined role in brackets, in the preamble region.
  const preambleEnd = Math.min(text.length, clauses.find((c) => c.number !== null)?.start ?? 3000, 4000);
  const parties: Deterministic['parties'] = [];
  const PARTY = /([A-Z][A-Za-z0-9&.'’\- ]{1,80}?(?:\s(?:AB|Ltd|Limited|LLC|Inc|GmbH|plc|AS|ASA|Oy|BV|NV|SA|Corp|Corporation|LLP|ApS|AG)\.?)?)(?:,[^()]{0,220}?)?\s*\((?:hereinafter\s+)?(?:referred to as\s+)?(?:the\s+)?["“]([A-Z][A-Za-z ]{1,30})["”]\)/g;
  for (const m of text.slice(0, preambleEnd).matchAll(PARTY)) {
    const role = m[2].trim();
    // The name is the words after the last "between" / "and" / sentence end, up to the first comma.
    const pre = m[0].slice(0, m[0].lastIndexOf('('));
    const seg = pre.split(/\bbetween\s+|\band\s+|[.;:]\s+/).pop() ?? pre;
    const name = seg.split(',')[0].trim();
    if (!name || !/^[A-Z]/.test(name)) continue;
    if (!ROLE_WORDS.test(role) && !LEGAL_FORM.test(name)) continue;
    if (parties.some((p) => p.role === role)) continue;
    const from = m.index! + pre.lastIndexOf(seg);
    parties.push({ name, role, span: table.add(from, m.index! + m[0].length) });
  }
  const roles = parties.map((p) => p.role!).filter(Boolean);

  // Clause topics and key terms.
  const clauseTopics = new Map<string, Topic[]>();
  const clauseTerms = new Map<string, string[]>();
  for (const c of clauses) {
    const body = text.slice(c.start, c.end);
    clauseTopics.set(c.id, topicsOf(c.heading, body));
    const terms = new Set<string>();
    for (const re of [AMOUNT_RE, DURATION_RE, DATE_RE, PERCENT_RE]) for (const m of body.matchAll(new RegExp(re.source, re.flags))) terms.add(m[0].replace(/\s+/g, ' ').trim());
    clauseTerms.set(c.id, [...terms].slice(0, 12));
  }
  const clauseOf = (offset: number) => clauses.find((c) => offset >= c.start && offset < c.end) ?? null;
  const topicsAt = (offset: number) => clauseTopics.get(clauseOf(offset)?.id ?? '') ?? [];

  // Dates, amounts, durations (first 12 of each, with their sentence).
  const collect = (re: RegExp) => {
    const out: DetFact[] = [];
    const seen = new Set<string>();
    for (const m of text.matchAll(new RegExp(re.source, re.flags))) {
      const v = m[0].replace(/\s+/g, ' ').trim();
      if (seen.has(v)) continue;
      seen.add(v);
      out.push({ value: v, span: table.add(m.index!, m.index! + m[0].length) });
      if (out.length >= 12) break;
    }
    return out;
  };
  const dates = collect(DATE_RE);
  const amounts = collect(AMOUNT_RE);
  const durations = collect(DURATION_RE);

  // Governing law.
  const facts: EngineFact[] = [];
  let governingLaw: DetFact | null = null;
  for (const m of text.matchAll(/\bgoverned by(?: and construed in accordance with)?(?: the)? laws? of(?: the)? ([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+){0,3})/g)) {
    const s = sentenceAt(all, m.index!)!;
    const span = sp(s);
    if (!governingLaw) governingLaw = { value: m[1], span };
    facts.push({ id: span.id, entity: 'agreement', concept: 'governing_law', value: m[1], exclusiveGroup: 'governing_law' });
  }
  for (const m of text.matchAll(/\b(?:exclusive jurisdiction of|submit to) the (?:competent )?courts? of ([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+){0,2})/g)) {
    const span = sp(sentenceAt(all, m.index!)!);
    facts.push({ id: span.id, entity: 'agreement', concept: 'forum', value: m[1], exclusiveGroup: 'forum' });
  }

  // Sentence-level rules.
  const roleAlt = [...roles.map((r) => r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'each party', 'either party', 'both parties', 'the parties', 'neither party'].join('|');
  const OBLIGATION = new RegExp(`^(?:.*?\\b)?(?:the\\s+)?(${roleAlt})\\s+(shall not|must not|may not|shall|must|will|agrees to|undertakes to|is responsible for|may)\\b`, 'i');
  for (const s of all) {
    const span = () => sp(s);
    const topics = topicsAt(s.start);
    const ob = OBLIGATION.exec(s.text);
    if (ob && s.text.length < 900) {
      const raw = ob[1].toLowerCase();
      const party = roles.find((r) => r.toLowerCase() === raw) ?? (raw === 'neither party' || raw === 'each party' || raw === 'either party' || raw === 'both parties' || raw === 'the parties' ? 'Both parties' : ob[1]);
      const modal = ob[2].toLowerCase();
      const kind = /not$/.test(modal) || raw === 'neither party' ? 'Restriction' : modal === 'may' ? 'Right' : 'Obligation';
      add({ section: 'obligation', title: `${kind}: ${party}`, detail: s.text.length > 240 ? s.text.slice(0, 237) + '…' : s.text, party, spans: [span().id] });
    }
    // Deadlines.
    const dur = [...s.text.matchAll(new RegExp(DURATION_RE.source, DURATION_RE.flags))];
    if (dur.length && /\b(within|no later than|not later than|at least|prior to|before|after|from|following|upon)\b/i.test(s.text)) {
      const kind = topics.includes('payment') || /\binvoice|payment|payable\b/i.test(s.text) ? 'Payment deadline'
        : /\b(renew|non-renewal)\b/i.test(s.text) ? 'Renewal notice' : /\bterminat/i.test(s.text) ? 'Termination notice'
        : /\bnotice\b/i.test(s.text) ? 'Notice period' : 'Time limit';
      add({ section: 'deadline', title: `${kind}: ${dur.map((d) => d[0]).join(', ')}`, detail: s.text, spans: [span().id] });
      // Payment term as an engine fact (contradiction check).
      if (kind === 'Payment deadline' && /\b(invoice|payable|pay|payment)\b/i.test(s.text) && /\bwithin\b|\bdays? (?:of|from|after) (?:the )?(?:date of |receipt of )?(?:the )?invoice/i.test(s.text) && !/\b(late|interest|dispute)\b/i.test(s.text)) {
        const d = durationValue(dur[0]);
        facts.push({ id: span().id, entity: 'agreement', concept: 'payment_term', value: inDays(d), unit: 'days' });
      }
    }
    // Renewal and termination.
    if (/\b(automatic(?:ally)? renew|renew(?:s|ed)? automatically|successive (?:periods|terms)|tacit(?:ly)? renew)/i.test(s.text)) {
      add({ section: 'renewal_termination', title: 'Automatic renewal', detail: s.text, spans: [span().id] });
    } else if (/\bterminat(e|ion)\b/i.test(s.text) && (topics.includes('termination') || topics.includes('term'))) {
      const why = /for convenience|without cause|for any reason/i.test(s.text) ? 'Termination for convenience' : /material breach|for cause|insolven|bankrupt/i.test(s.text) ? 'Termination for cause' : 'Termination';
      add({ section: 'renewal_termination', title: why, detail: s.text, spans: [span().id] });
      const conv = /for convenience|without cause/i.test(s.text) && dur[0];
      if (conv) facts.push({ id: span().id, entity: 'agreement', concept: 'convenience_notice', value: inDays(durationValue(dur[0])), unit: 'days' });
    }
    const initial = /\binitial (?:term|period) of\b/i.test(s.text) && dur[0];
    if (initial) facts.push({ id: span().id, entity: 'agreement', concept: 'initial_term', value: inDays(durationValue(dur[0])), unit: 'days' });

    // Liability cap as an engine fact: "unlimited" and a stated cap for the same party are exclusive options.
    if (/\bliabilit/i.test(s.text)) {
      const who = roles.find((r) => new RegExp(`\\b${r}\\b`).test(s.text)) ?? 'agreement';
      const cap = /\b(?:shall not exceed|is limited to|limited to|capped at)\s+([^.;]{3,80})/i.exec(s.text);
      if (/\bunlimited liability\b/i.test(s.text)) facts.push({ id: span().id, entity: who, concept: 'liability_cap', value: 'unlimited', exclusiveGroup: 'liability_cap' });
      else if (cap) facts.push({ id: span().id, entity: who, concept: 'liability_cap', value: cap[1].trim().toLowerCase(), exclusiveGroup: 'liability_cap' });
    }
    // Risk and unusual-term rules.
    const risk = (severity: Severity, title: string, reasoning: string, section: Section = 'risk') => add({ section, title, detail: s.text, severity, reasoning, spans: [span().id], requiresHumanReview: true });
    if (/\bunlimited liability\b|\bliability[^.]{0,60}\b(?:shall not be|is not) (?:limited|capped)\b|\bwithout (?:any )?limit(?:ation)?\b[^.]{0,40}\bliab/i.test(s.text)) risk('high', 'Uncapped liability', 'The sentence leaves a party’s liability without a financial cap, so exposure is open-ended.');
    if (/\bindemnif/i.test(s.text) && /\b(any and all|all) (losses|claims|liabilities|damages)\b/i.test(s.text) && !/\b(cap|limit|shall not exceed)\b/i.test(s.text)) risk('medium', 'Broad indemnity', 'An indemnity for “any and all” losses with no cap in the same sentence; check whether the liability clause caps it.');
    if (/\b(may|reserves the right to) (?:unilaterally )?(amend|change|modify|vary|update)\b[^.]{0,100}\b(at any time|in its (?:sole )?discretion|without (?:prior )?(?:notice|consent))/i.test(s.text)) risk('high', 'Unilateral right to change terms', 'One party may change the terms on its own; the other party’s commitments can move without its agreement.');
    if (/\b(?:interest|late payment)[^.]{0,80}\b(\d{1,2}(?:[.,]\d+)?)\s?(?:%|per ?cent)/i.test(s.text)) {
      const pct = Number(/(\d{1,2}(?:[.,]\d+)?)\s?(?:%|per ?cent)/i.exec(s.text)![1].replace(',', '.'));
      const monthly = /per month|monthly/i.test(s.text);
      if ((monthly && pct >= 1) || pct >= 12) risk('medium', 'High late-payment interest', `Late-payment interest of ${pct}%${monthly ? ' per month' : ''} is high compared with typical statutory reference rates.`);
    }
    if (/\b(exclusive (?:supplier|provider|basis|right)|exclusivity|shall not[^.]{0,60}\b(compete|engage[^.]{0,40}competing|solicit))/i.test(s.text)) risk('medium', 'Exclusivity or restrictive covenant', 'Restricts a party’s freedom to work with others; check its scope, territory and duration.', 'unusual');
    if (/\b(in perpetuity|perpetual|indefinitely|survive[^.]{0,40}indefinitely)\b/i.test(s.text) && /confidential|obligation|licen[cs]e/i.test(s.text)) risk('low', 'Perpetual obligation or licence', 'An obligation or licence without an end date; confirm that this is intended.', 'unusual');
    if (/\b(all|any) (?:intellectual property|IP)[^.]{0,120}\b(pre-existing|background|whether created before|prior to)\b/i.test(s.text) && /\bassign|vest|transfer/i.test(s.text)) risk('high', 'Assignment of pre-existing IP', 'Transfers intellectual property that existed before the agreement, not only the results of the work.');
    if (/\b(liquidated damages|penalt(?:y|ies)|service credits?)\b/i.test(s.text)) risk('medium', 'Liquidated damages or penalties', 'A fixed payment on breach or delay; check the amount, the trigger and whether it is the sole remedy.', 'unusual');
    if (/\bsole (?:and absolute )?discretion\b/i.test(s.text)) risk('low', '“Sole discretion” wording', 'A decision left to one party alone, with no objective standard.', 'unusual');
    const longPay = dur.find((d) => (topics.includes('payment') || /invoice|payable/i.test(s.text)) && inDays(durationValue(d)) > 60);
    if (longPay) risk('medium', 'Long payment period', `Payment within ${longPay[0]} is longer than the usual 30 days and delays cash flow for the party being paid.`, 'unusual');
    const noticeAt = s.text.search(/\bnotice\b/i);
    const longNotice = /renew/i.test(s.text) && noticeAt >= 0 && dur.find((d) => d.index! > noticeAt && inDays(durationValue(d)) >= 90);
    if (longNotice) risk('medium', 'Long notice to stop automatic renewal', `Notice of ${longNotice[0]} must be given to avoid renewal; missing it extends the commitment.`);
  }

  // Topic sections: one finding per clause for the topics with their own report section.
  for (const c of clauses) {
    for (const t of clauseTopics.get(c.id) ?? []) {
      const section = TOPIC_SECTION[t];
      if (!section) continue;
      const ss = sentences(text, c.start, c.end).filter((x) => x.text !== c.heading && x.text.length > 20);
      const first = ss.find((x) => TOPICS[t].body.test(x.text)) ?? ss[0] ?? { start: c.start, end: c.end, text: '' };
      add({ section, title: `${c.number ? `Clause ${c.number}` : c.heading}: ${TOPICS[t].label}`, detail: first.text.length > 300 ? first.text.slice(0, 297) + '…' : first.text, spans: [sp(first).id] });
    }
  }

  // Absence of standard clauses for this type of document.
  // A topic is present when a clause heading names it or its wording occurs anywhere in the text.
  const present = new Set([...clauseTopics.values()].flat());
  for (const [k, t] of Object.entries(TOPICS) as [Topic, (typeof TOPICS)[Topic]][]) if (t.body.test(text)) present.add(k);
  for (const t of checklist) {
    if (present.has(t)) continue;
    if (t === 'governing_law' && governingLaw) continue;
    add({ section: 'missing', title: `No ${TOPICS[t].label.toLowerCase()} clause found`, detail: `No clause heading or passage matched the ${TOPICS[t].label.toLowerCase()} patterns${type ? ` expected in a ${type.value.toLowerCase()}` : ''}.`, severity: t === 'liability' || t === 'governing_law' ? 'medium' : 'low', reasoning: 'Absence found by pattern search over the whole text; the term may exist under another wording.', spans: [], absence: { searched: `${TOPICS[t].heading.source} | ${TOPICS[t].body.source}`, textSha256 }, requiresHumanReview: true });
  }

  return { title, type, parties, roles, dates, amounts, durations, governingLaw, clauseTopics, clauseTerms, findings, facts };
}
