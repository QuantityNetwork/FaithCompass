import type { Metadata } from 'next';
import { PageIntro, Section } from '@/components/record/ui';
import { corpus } from '@/lib/api/operations';
import { getRecord } from '@/lib/record/record';
import { FAMILY_META, type TraditionFamily } from '@/lib/record/taxonomy';

export const metadata: Metadata = {
  title: 'Corpus and coverage',
  description:
    'Every work the AbrahamMoses record cites, the edition it is cited from, how often, and what is not yet covered.',
  alternates: { canonical: '/corpus' },
};

const GAPS = [
  'Dead Sea Scrolls and other Second Temple manuscripts are not yet cited as witnesses in their own right.',
  'Ḥadīth collections and sīra are not yet entered; Islamic claims rest on the Qurʾān and on named tafsīr.',
  'Early Qurʾān manuscripts (e.g. the Birmingham and Ṣanʿāʾ leaves) are discussed in the Evidence Intelligence module, not yet in the Claim Ledger.',
  'Targumim, the Peshitta and the Vulgate are not yet cited.',
  'Anglican, Methodist, Pentecostal and Oriental Orthodox traditions, Karaite Judaism and Community of Christ are not yet entered as traditions.',
  'Editions are named for every work, but quotations have not yet been checked against them by an editor.',
];

export default function CorpusPage() {
  const record = getRecord();
  const c = corpus(record);
  return (
    <main id="main" className="shell page">
      <PageIntro
        eyebrow="Corpus"
        title="Start with the sources"
        lede="AbrahamMoses begins with texts, not generated conclusions. Every work below is cited from a named edition; the counts show how much of the record rests on it, and the gaps say plainly what is not yet covered."
      />

      <div className="layers">
        {c.categories.map((cat) => (
          <div className="layer" key={cat.id}>
            <div className="layer__n">{cat.ordinal}</div>
            <div className="layer__name">{cat.label}</div>
            <p className="small muted" style={{ margin: '0 0 8px' }}>
              {cat.description}
            </p>
            <p className="small faint" style={{ margin: 0 }}>
              {cat.works} works · {cat.citations} citations
            </p>
          </div>
        ))}
      </div>
      <p className="small faint" style={{ marginTop: 10 }}>
        “Historical witnesses and material evidence” replaces the earlier label “Contemporary witness”: manuscripts,
        versions, inscriptions and early printings are witnesses to transmission and history, not contemporary sources.
        Classification is by provenance, and a source’s classification is never silently altered.
      </p>

      {c.categories.map((cat) => {
        const works = c.works.filter((w) => w.category === cat.id);
        if (!works.length) return null;
        return (
          <Section key={cat.id} id={cat.id} title={cat.label} eyebrow={cat.ordinal}>
            <div className="table-wrap">
              <table className="table table--stack">
                <thead>
                  <tr>
                    <th scope="col">Work</th>
                    <th scope="col">Edition cited</th>
                    <th scope="col">Scripture for</th>
                    <th scope="col">Citations</th>
                  </tr>
                </thead>
                <tbody>
                  {works.map((w) => (
                    <tr key={w.id}>
                      <td data-label="Work">
                        {w.title}
                        <div className="faint">
                          {w.collection}
                          {w.author ? ` · ${w.author}` : ''}
                          {w.date ? ` · ${w.date}` : ''}
                        </div>
                      </td>
                      <td data-label="Edition cited">
                        {w.edition}
                        <div className="faint">
                          {[w.publisher, w.year, w.language].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td data-label="Scripture for">
                        {w.canonical_for.length ? w.canonical_for.map((f) => FAMILY_META[f as TraditionFamily].label).join(', ') : '—'}
                      </td>
                      <td data-label="Citations">{w.citations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        );
      })}

      <Section id="translations" title="Translations used in quotations">
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Translation</th>
                <th scope="col">Licence</th>
                <th scope="col">Quotations verified</th>
              </tr>
            </thead>
            <tbody>
              {c.translations.map((t) => (
                <tr key={t.id}>
                  <td data-label="Translation">{t.name}</td>
                  <td data-label="Licence">{t.license}</td>
                  <td data-label="Quotations verified">{t.verified ? 'Yes' : 'Not yet'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="gaps" title="Not yet covered">
        <ul className="prose-block">
          {GAPS.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
        <p className="small faint">
          Growing the corpus is curation, not generation: a work enters when an editor has checked the edition.{' '}
          <a className="link" href="/api/v1/corpus">
            JSON
          </a>
        </p>
      </Section>
    </main>
  );
}
