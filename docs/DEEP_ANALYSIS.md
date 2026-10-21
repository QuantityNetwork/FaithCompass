# Deep Analysis (preview)

Route: `/institutional/workspace/deep-analysis`; API: `POST /api/deep-analysis` (JSON: `filename`, `contentBase64`, optional `useAi`), `GET /api/deep-analysis` (what the deployment offers).

**Not legal advice; not reviewed by a lawyer.** Preview only: no confidential client documents; nothing is stored.

## Pipeline (`src/lib/deep-analysis`)

1. **Parse** (`parse.ts`): PDF text layer via `unpdf` (pdf.js), DOCX via `mammoth`, TXT/MD as UTF-8; max 3 MB, 300,000 characters. Scanned PDFs (no text layer) are refused with `SCANNED_PDF`; there is no OCR. Text is normalised (NFC, `\n`, no NBSP/zero-width, trimmed lines) and hashed (`textSha256`); the file is hashed too (`bytesSha256`).
2. **Segment** (`segment.ts`): clauses at numbered headings, schedule/annex headings and short capitals lines; sentences with offsets.
3. **Deterministic layer** (`extract.ts`): type, parties (preamble defined terms), dates, amounts, periods, governing law, clause topics, obligations per party ("shall", "must", "may"…), deadlines, renewal and termination, rated risk patterns, unusual terms, missing standard clauses (absence findings anchored to the text hash), and engine facts (payment term, governing law, forum, liability cap, initial term, convenience notice).
4. **AI layer** (`ai.ts`, provider interface `DeepAiProvider`): one call, JSON answer. Default model `gpt-5.6-terra` (chosen for quality per dollar; `gpt-5.6-luna` is the budget option) through the Responses API with reasoning effort `medium` and `text.format` json_object. Spend guard: input capped at 300,000 characters (the report says when it was truncated), `max_output_tokens` 32,000 including reasoning (at most about $0.38 output per run on terra) (stops runaway generations), a 690 s timeout inside the route's 800 s `maxDuration`, one retry on 429/5xx only while time is left.
5. **Verification** (`analyze.ts`, `spans.ts`): every AI quotation must occur in the text verbatim (only whitespace may differ); otherwise the finding is dropped and counted. AI findings are marked `layer: "ai"` and `requiresHumanReview: true`. AI confidence is capped at "moderate".
6. **Contradictions**: the existing contradiction engine (`combineLayers`): deterministic findings on the engine facts, AI pairs as candidates capped at `POTENTIAL_CONFLICT` and subject to the deterministic veto. An AI quotation inside a passage the rules read as a fact is mapped to that fact, so pairs are deduplicated.
7. **Seal** (`bundle.ts`): SHA-256 over canonical JSON (`canonical-json/1`). `verifyBundle` re-checks the digest and every span (offset and hash). Not signed: the passport key is reserved for Decision Passports.

## AI access (`access.ts`)

| Deployment | AI layer |
| --- | --- |
| Production (`DEEP_ANALYSIS_AI_ACCESS=signed-in`) | any signed-in, non-anonymous Firebase user (Google or email/password) with a verified email address. No token or an invalid/anonymous token: 401. Unverified email: 403. |
| Preview with `DEEP_ANALYSIS_AI_ACCESS=deployment-protected` | anyone who can reach the deployment (Vercel Authentication: team members and share-link holders) |
| Other previews | as production |
| Local (no `VERCEL_ENV`) | allowed |

Plus abuse brakes: `DEEP_ANALYSIS_AI_USER_DAILY_LIMIT` per user per day (default 10), `DEEP_ANALYSIS_AI_DAILY_LIMIT` in total per day (default 300) and 6 AI analyses per client per 10 minutes. The counters are per server instance: Firestore has no admin key here, and a counter the user's own token could write would be under the user's control unless firestore.rules made it increment-only, which is a rules change for the owner. Requests send `store: false` to OpenAI; the privacy notice (/privacy#deep-analysis) names OpenAI as processor. Configuration: `OPENAI_API_KEY` (server only, Vercel type *sensitive*), optional `AI_PROVIDER=openai`, `DEEP_ANALYSIS_MODEL` (default `gpt-5.6-terra`, called through the Responses API; gpt-4.x models use Chat Completions), `DEEP_ANALYSIS_REASONING_EFFORT` (default `medium`), `DEEP_ANALYSIS_AI=off`.

## Samples

`public/deep-analysis/samples/*.md` are fictional documents written for the demonstration, each with deliberate problems; `*.report.json` are recorded runs with the AI layer (`npx tsx scripts/deep-analysis/run-samples.ts`, needs `OPENAI_API_KEY`). The tests check that each recorded report is schema-valid, its seal and every span verify, and its text hash matches the committed sample.

## Large files (3–15 MB)

Vercel functions cap request bodies at about 4.5 MB, so files over 3 MB are not uploaded. The browser reads them with the same libraries and rules as the server (`lib/deep-analysis/text.ts`, unpdf/pdf.js and mammoth's browser build) and sends only the extracted text (at most 300,000 characters, well under the cap); the server re-normalises, re-checks and hashes the text itself. The file never leaves the device and nothing is stored anywhere, so no temporary storage is needed. The report marks such documents `extraction: "browser"` and says the file size and hash are as the browser reported them.
