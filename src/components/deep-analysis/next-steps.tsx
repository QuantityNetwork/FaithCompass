/** A quiet closing note under every Deep Analysis report: where to take the analysis next. */
export function ReportNextSteps() {
  return (
    <aside className="da-next" aria-labelledby="da-next-h">
      <h2 id="da-next-h">Next steps</h2>
      <div className="da-next__grid">
        <div>
          <h3>Take this into a Decision Room</h3>
          <p>Work on the document with your colleagues in a private workspace: cited passages, contradictions across documents, a two-person review and a signed Decision Passport.</p>
          <a href="/institutional/decision-room">The Decision Room</a>
        </div>
        <div>
          <h3>Discuss a pilot</h3>
          <p>A 90-day pilot for one workspace and up to ten users, with onboarding, under a signed data processing agreement.</p>
          <a href="/institutional/decision-twin#pricing">Pilot terms and pricing</a>
          <span aria-hidden="true"> · </span>
          <a href="/institutional/trust">Trust and security</a>
        </div>
      </div>
    </aside>
  );
}
