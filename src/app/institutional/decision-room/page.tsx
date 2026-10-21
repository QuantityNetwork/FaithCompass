import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DecisionRoomApp } from '@/components/decision-room/room-app';
import { parseRoomParams } from '@/lib/decision-room/room';
import '../workspace/workspace.css';
import '../workspace/deep-analysis/deep-analysis.css';
import './decision-room.css';

export const metadata: Metadata = {
  title: 'Decision Room · Institutional',
  description:
    'A room for each decision in your evidence workspace: the decision record, the cited evidence, Deep Analysis findings, contradictions, an evidence counterfactual, the two-person review and the Decision Passport.',
  alternates: { canonical: '/institutional/decision-room' },
};

export default async function DecisionRoomPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  // Links to the sample case's scenarios (?r=…, ?g=…) predate the sample's own address: send them there unchanged.
  const keys = Object.keys(sp).filter((k) => k !== 'w' && k !== 'd');
  if (keys.length) {
    const q = new URLSearchParams();
    for (const k of keys) for (const v of ([] as string[]).concat(sp[k] ?? [])) q.append(k, v);
    redirect(`/institutional/decision-room/sample?${q.toString()}`);
  }
  return (
    <main id="main" className="ws da-page rm-page">
      <div className="da-wrap">
        <header className="da-masthead">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="da-masthead__logo rm-logo"
            src="/brand/decision-room/logo-decision-room.png"
            srcSet="/brand/decision-room/logo-decision-room.png 1x, /brand/decision-room/logo-decision-room@2x.png 2x"
            alt="AbrahamMoses — Decision Room"
            width={520}
            height={112}
          />
          <p className="da-masthead__status">Institutional</p>
        </header>
        <div className="da-intro">
          <h1>Decision Room</h1>
          <p>
            One room for each decision in your evidence workspace. The decision as proposed, every passage it cites, what Deep Analysis finds in those documents,
            where they contradict each other, what the decision would still rest on if a citation fell away, the two-person review and the exported Decision
            Passport — in one place, from the workspace&rsquo;s own records.
          </p>
        </div>
        <DecisionRoomApp room={parseRoomParams(sp)} />
        <aside className="rm-sample" aria-labelledby="rm-sample-title">
          <h2 id="rm-sample-title">Sample room</h2>
          <p>
            A complete room on a fictional $120M private credit facility: ten synthetic documents, assumptions you can change, an adversarial chamber, a
            contradiction map and a reproducible Decision Passport. Synthetic data; it shows the method and is not a client decision.
          </p>
          <p><a className="da-btn" href="/institutional/decision-room/sample">Open the sample room</a></p>
        </aside>
      </div>
    </main>
  );
}
