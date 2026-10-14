import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro } from '@/components/record/ui';
import { getRecord } from '@/lib/record/record';
import { FAMILY_META, TRADITION_FAMILIES } from '@/lib/record/taxonomy';

export const metadata: Metadata = {
  title: 'Traditions',
  description:
    'Different traditions, clearly attributed. Each tradition in the record with its own authorities, its own categories, and its recorded stance on each reading principle.',
  alternates: { canonical: '/traditions' },
};

export default function TraditionsPage() {
  const record = getRecord();
  return (
    <main id="main" className="shell page">
      <PageIntro
        eyebrow="Tradition Layer"
        title="Different traditions. Clearly attributed."
        lede="AbrahamMoses does not flatten traditions into one consensus, and it does not open on any one tradition's lens. Each is recorded with its own authorities and its own categories, so a comparison can say when traditions are asking different questions."
      />
      {TRADITION_FAMILIES.map((family) => {
        const traditions = record.data.traditions.filter((t) => t.family === family);
        if (traditions.length === 0) return null;
        return (
          <section key={family} className="section--tight" aria-labelledby={`family-${family}`}>
            <h2 className="section-title" id={`family-${family}`}>
              {FAMILY_META[family].label}
            </h2>
            <div className="grid-2">
              {traditions.map((t) => {
                const held = record.data.axioms.filter((a) => a.stances.some((s) => s.tradition === t.id && s.stance === 'holds')).length;
                const rejected = record.data.axioms.filter((a) => a.stances.some((s) => s.tradition === t.id && (s.stance === 'rejects' || s.stance === 'brackets'))).length;
                return (
                  <Link key={t.id} href={`/traditions/${t.id}`} className="card card--link">
                    <span className="card__title" style={{ display: 'block' }}>
                      {t.name}
                    </span>
                    <span className="small muted" style={{ display: 'block' }}>
                      {t.description}
                    </span>
                    <span className="stat-row">
                      <span>
                        Reads with <strong>{held}</strong> recorded principles
                      </span>
                      <span>
                        sets aside <strong>{rejected}</strong>
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
      <p className="small faint" style={{ marginTop: 32 }}>
        Families are listed in the historical order of their emergence; scholarly standpoints follow. A stance records which
        reading principle a tradition uses — it is an attribution, not a verdict. Stances are provisional until verified by an
        editor.
      </p>
    </main>
  );
}
