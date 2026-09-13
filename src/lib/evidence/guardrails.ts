/**
 * Request guardrails.
 *
 * The single hardest constraint on this product is that it must not produce a
 * truth ranking for a religious tradition. "Give Islam a truth score" is not a
 * question the methodology can answer, and answering it anyway — in either
 * direction — would discredit every honest assessment in the system.
 *
 * These requests are not refused. They are redirected into the specific,
 * analysable claims that sit underneath them, which is what the user usually
 * wanted.
 */

export type GuardrailKind =
  | 'TRADITION_SCORE'
  | 'PREDETERMINED_CONCLUSION'
  | 'DEBUNK_REQUEST'
  | 'PERFECT_SCORE_REQUEST';

export interface GuardrailFinding {
  kind: GuardrailKind;
  /** Shown to the user in place of an assessment. */
  message: string;
  /** Concrete, analysable reformulations. */
  suggestedClaims: string[];
}

export interface GuardrailResult {
  allowed: boolean;
  finding: GuardrailFinding | null;
}

const TRADITIONS = [
  'christianity',
  'christian faith',
  'judaism',
  'islam',
  'mormonism',
  'buddhism',
  'hinduism',
  'catholicism',
  'protestantism',
  'the lds church',
  'latter-day saints',
  'the church of jesus christ of latter-day saints',
  'the bible',
  'the quran',
  'the koran',
  'the book of mormon',
  'the torah',
  'the talmud',
  'the new testament',
  'the old testament',
];

const SCORE_WORDS =
  /\b(truth\s*score|score|rate|rating|rank|ranking|percentage|percent|out of\s*100|\d{1,3}\s*\/\s*100|how true|how likely.*true)\b/i;

const PROVE_WORDS = /\b(prove|proof that|demonstrate that|show that|confirm that|establish that)\b/i;
const DEBUNK_WORDS = /\b(debunk|disprove|expose|refute|show .* is (fake|false|a fraud|made up)|prove .* (is )?(false|fake))\b/i;
const PERFECT_WORDS = /\b(100\s*\/\s*100|100%|perfect score|full marks|give .* 100)\b/i;

function mentionsTradition(text: string): string | null {
  const lower = text.toLowerCase();
  for (const t of TRADITIONS) {
    if (lower.includes(t)) return t;
  }
  return null;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Claims worth suggesting when someone asks for a tradition-level verdict.
 * Each is genuinely analysable by at least one dimension of the framework.
 */
const REDIRECTS: Record<string, string[]> = {
  christianity: [
    'What is the evidence for the crucifixion of Jesus under Pontius Pilate?',
    'How early is the creedal material preserved in 1 Corinthians 15:3–7?',
    'How securely is the wording of the Gospel of Mark reconstructed?',
    'What independent sources mention Jesus of Nazareth within a century of his life?',
  ],
  judaism: [
    'What evidence supports the historical existence of the House of David?',
    'How securely is the wording of Isaiah 53 reconstructed?',
    'What archaeological evidence bears on the settlement patterns of early Israel?',
  ],
  islam: [
    'How securely is the consonantal text of the Quran reconstructed from early manuscripts?',
    'What do the Birmingham and Sanaa manuscripts establish about early Quranic transmission?',
    'What contemporary documentary evidence exists for the early Islamic conquests?',
  ],
  'the book of mormon': [
    'What independent evidence bears on Near Eastern migrations to the pre-Columbian Americas?',
    'What is the manuscript and publication history of the 1830 Book of Mormon text?',
    'What does population genetics indicate about the ancestry of Indigenous American populations?',
  ],
  'the bible': [
    'How securely is the wording of Isaiah 53 reconstructed?',
    'What evidence supports the existence of Pontius Pilate?',
    'How strongly supported is the identification of Michael as an angelic prince in Daniel 12:1?',
  ],
};

function redirectsFor(tradition: string): string[] {
  return (
    REDIRECTS[tradition] ?? [
      'Which specific historical claim within this tradition would you like assessed?',
      'Which passage would you like the textual transmission of?',
      'Which interpretive question would you like compared across traditions?',
    ]
  );
}

const TRADITION_MESSAGE =
  'I cannot meaningfully assign a single truth percentage to an entire religious tradition or scriptural corpus. A tradition is not the kind of object evidence bears on — it contains thousands of distinct textual, historical, archaeological, interpretive and metaphysical claims, and they are supported to wildly different degrees. What I can do is assess those claims individually.';

const PREDETERMINED_MESSAGE =
  'I can assess this claim, but not toward a conclusion fixed in advance. An assessment written to reach a predetermined answer is not evidence work. I will lay out the supporting evidence, the counter-evidence, the assumptions each reading requires, and where the assessment could be overturned — and the conclusion will follow from those.';

const DEBUNK_MESSAGE =
  'I do not run analyses aimed at discrediting a tradition, any more than I run analyses aimed at vindicating one. I can assess specific claims on their evidence, including claims where external corroboration turns out to be weak — and say so plainly, without treating weak evidence as a verdict on the faith of the people who hold it.';

const PERFECT_MESSAGE =
  'Scores above 95 are reserved for claims resting on multiple independent primary sources with negligible counter-evidence, and no corpus receives a single aggregate score at all. I can show you which specific claims in this text are the most securely established, and why.';

/**
 * Inspect an incoming request before any analysis is run.
 */
export function checkRequest(query: string): GuardrailResult {
  const text = query.trim();
  if (!text) return { allowed: true, finding: null };

  const tradition = mentionsTradition(text);

  if (PERFECT_WORDS.test(text)) {
    return {
      allowed: false,
      finding: {
        kind: 'PERFECT_SCORE_REQUEST',
        message: PERFECT_MESSAGE,
        suggestedClaims: redirectsFor(tradition ?? 'the bible'),
      },
    };
  }

  if (tradition && SCORE_WORDS.test(text)) {
    return {
      allowed: false,
      finding: {
        kind: 'TRADITION_SCORE',
        message: `${TRADITION_MESSAGE} Here are analysable claims relating to ${titleCase(
          tradition,
        )}:`,
        suggestedClaims: redirectsFor(tradition),
      },
    };
  }

  if (DEBUNK_WORDS.test(text)) {
    return {
      allowed: false,
      finding: {
        kind: 'DEBUNK_REQUEST',
        message: DEBUNK_MESSAGE,
        suggestedClaims: redirectsFor(tradition ?? ''),
      },
    };
  }

  if (PROVE_WORDS.test(text) && tradition) {
    return {
      allowed: false,
      finding: {
        kind: 'PREDETERMINED_CONCLUSION',
        message: PREDETERMINED_MESSAGE,
        suggestedClaims: redirectsFor(tradition),
      },
    };
  }

  return { allowed: true, finding: null };
}
