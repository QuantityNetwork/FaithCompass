'use client';

/**
 * The Proof Inspector console — the command-line form of the explorer, for
 * readers who prefer typing codes. Same engine, same record, read-only.
 */

import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { COUNTER_STATUS_LABELS, STATUS_LABELS, simulate, upstreamOf, downstreamOf, type DependencyGraph } from '@/lib/record/engine';
import { explain, lookupFor } from '@/lib/record/explain';

const HELP = `Commands
  reject <CODE…>    simulate rejecting claims (AM-CLAIM-…) or principles (AM-AX-…)
  restore <CODE>    undo one rejection
  lens <tradition>  read through a tradition's lens; "lens none" to clear
  inspect <CODE>    show what a claim or principle rests on and supports
  axioms            list reading principles
  claims [topic]    list claims, optionally by topic
  status            show the current simulation
  reset             clear every rejection
  clear             clear the console
Codes can be abbreviated: 191 for AM-CLAIM-000191, AX-2 for AM-AX-002.`;

export function ProofConsole({ graph, traditions }: { graph: DependencyGraph; traditions: Array<{ id: string; name: string }> }) {
  const [lines, setLines] = useState<string[]>([
    'AbrahamMoses proof inspector · read-only · AND/OR semantics',
    `Record version ${graph.recordVersion}. Type "help".`,
  ]);
  const [reject, setReject] = useState<string[]>([]);
  const [lens, setLens] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const out = useRef<HTMLDivElement>(null);
  const lookup = useMemo(() => lookupFor(graph), [graph]);

  const resolve = (token: string): string | null => {
    const t = token.trim().toUpperCase();
    if (graph.claims.some((c) => c.code === t) || graph.axioms.some((a) => a.code === t)) return t;
    const claim = t.match(/^(?:AM-CLAIM-|CLAIM-?|C)?0*(\d{1,6})$/);
    if (claim) {
      const code = `AM-CLAIM-${claim[1].padStart(6, '0')}`;
      if (graph.claims.some((c) => c.code === code)) return code;
    }
    const axiom = t.match(/^(?:AM-)?AX-?0*(\d{1,3})$/);
    if (axiom) {
      const code = `AM-AX-${axiom[1].padStart(3, '0')}`;
      if (graph.axioms.some((a) => a.code === code)) return code;
    }
    return null;
  };

  const report = (nextReject: string[], nextLens: string | null): string[] => {
    const r = simulate(graph, {
      rejectClaims: nextReject.filter((c) => c.startsWith('AM-CLAIM-')),
      rejectAxioms: nextReject.filter((c) => c.startsWith('AM-AX-')),
      lens: nextLens,
    });
    if (r.affected.length === 0 && r.effectiveAxioms.length === 0) return ['Nothing set aside. Every claim is supported under the full set of assumptions.'];
    const rows = [
      `Rejected: ${[...nextReject, ...r.effectiveAxioms.filter((a) => !nextReject.includes(a))].join(', ') || 'none'}${nextLens ? `  (lens ${nextLens})` : ''}`,
      `${r.summary.broken} not established under selected assumptions · ${r.summary.unwarranted} partially supported · ${r.summary.weakened} support weakened · ${r.summary.edgesUngrounded} map edges not established · ${r.summary.edgesWeakened} support weakened`,
    ];
    for (const a of r.affected.filter((x) => x.status !== 'rejected').slice(0, 30)) {
      rows.push(`  ${STATUS_LABELS[a.status].padEnd(43)} ${a.code}  via ${a.via.join(' → ')}`);
      for (const reason of a.reasons.slice(0, 3)) rows.push(`      ${explain(reason, lookup)}`);
    }
    if (r.affected.length > 31) rows.push(`  … ${r.affected.length - 31} more`);
    const counters = r.counterModels.filter((m) => m.status !== 'unaffected');
    if (counters.length) rows.push(`Counter-models: ${counters.map((m) => `${m.code} ${COUNTER_STATUS_LABELS[m.status].toLowerCase()}`).join(', ')}`);
    rows.push('No source was changed.');
    return rows;
  };

  const run = (raw: string) => {
    const [cmd, ...args] = raw.trim().split(/\s+/);
    const echo = `am› ${raw}`;
    let output: string[] = [];
    let nextReject = reject;
    let nextLens = lens;
    switch ((cmd ?? '').toLowerCase()) {
      case '':
        return;
      case 'help':
        output = HELP.split('\n');
        break;
      case 'clear':
        setLines([]);
        return;
      case 'reset':
        nextReject = [];
        nextLens = null;
        output = ['Cleared.'];
        break;
      case 'reject': {
        const codes = args.map((a) => ({ a, code: resolve(a) }));
        const bad = codes.filter((c) => !c.code).map((c) => c.a);
        if (bad.length) {
          output = [`Unknown code: ${bad.join(', ')}`];
          break;
        }
        nextReject = [...new Set([...reject, ...codes.map((c) => c.code!)])].sort();
        output = report(nextReject, nextLens);
        break;
      }
      case 'restore': {
        const code = resolve(args[0] ?? '');
        if (!code) {
          output = ['Usage: restore <CODE>'];
          break;
        }
        nextReject = reject.filter((c) => c !== code);
        output = report(nextReject, nextLens);
        break;
      }
      case 'lens': {
        const id = (args[0] ?? '').toLowerCase();
        if (!id || id === 'none') nextLens = null;
        else if (traditions.some((t) => t.id === id)) nextLens = id;
        else {
          output = [`Unknown tradition. Known: ${traditions.map((t) => t.id).join(', ')}`];
          break;
        }
        output = report(nextReject, nextLens);
        break;
      }
      case 'status':
        output = report(reject, lens);
        break;
      case 'axioms':
        output = graph.axioms.map((a) => `${a.code}  ${a.label} — ${a.heldBy}`);
        break;
      case 'claims': {
        const topic = args.join(' ').toLowerCase();
        output = graph.claims
          .filter((c) => !topic || c.topic.toLowerCase() === topic)
          .map((c) => `${c.code}  [${c.role}] ${c.statement.slice(0, 90)}${c.statement.length > 90 ? '…' : ''}`);
        break;
      }
      case 'inspect': {
        const code = resolve(args[0] ?? '');
        if (!code) {
          output = ['Usage: inspect <CODE>'];
          break;
        }
        if (code.startsWith('AM-AX-')) {
          const a = graph.axioms.find((x) => x.code === code)!;
          output = [
            `${a.code}  ${a.label} — ${a.heldBy}`,
            `Stances: ${a.stances.map((s) => `${s.tradition} ${s.stance}`).join(', ') || 'none recorded'}`,
            `Rests on it: ${downstreamOf(graph, code).join(', ') || 'nothing'}`,
          ];
        } else {
          const c = graph.claims.find((x) => x.code === code)!;
          const up = upstreamOf(graph, code);
          output = [
            `${c.code}  [${c.role} · ${c.classification}${c.grounded ? ' · grounded in its witness' : ''}]`,
            c.statement,
            ...graph.derivations
              .filter((d) => d.claim === code)
              .map(
                (d) =>
                  `  ${d.code} ${d.label}: ${d.premises.map((p) => `${p.claim} (${p.necessity}${p.use === 'warrant' ? ', warrant' : ''})`).join(', ') || '—'}${
                    d.axioms.length ? ` | ${d.axioms.map((x) => `${x.axiom} (${x.role})`).join(', ')}` : ''
                  }`,
              ),
            `Upstream: ${up.claims.join(', ') || 'none'}; principles ${up.axioms.join(', ') || 'none'}`,
            `Downstream: ${downstreamOf(graph, code).join(', ') || 'nothing'}`,
          ];
        }
        break;
      }
      default:
        output = [`Unknown command "${cmd}". Type "help".`];
    }
    setReject(nextReject);
    setLens(nextLens);
    setLines((l) => [...l, echo, ...output].slice(-400));
    requestAnimationFrame(() => out.current?.scrollTo({ top: out.current.scrollHeight }));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim()) setHistory((h) => [input, ...h].slice(0, 50));
    run(input);
    setInput('');
    setCursor(-1);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault();
      const next = Math.min(cursor + 1, history.length - 1);
      setCursor(next);
      setInput(history[next]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = cursor - 1;
      setCursor(next);
      setInput(next >= 0 ? history[next] : '');
    }
  };

  return (
    <div className="console">
      <div className="console__out" ref={out} role="log" aria-live="polite" aria-label="Proof inspector output" tabIndex={0}>
        {lines.join('\n')}
      </div>
      <form className="console__in" onSubmit={onSubmit}>
        <label htmlFor="console-input" className="console__prompt">
          am›
        </label>
        <input
          id="console-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          autoComplete="off"
          spellCheck={false}
          placeholder="reject AX-2"
        />
      </form>
    </div>
  );
}
