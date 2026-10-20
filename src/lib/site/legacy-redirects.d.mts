export interface LegacyRedirect {
  source: string;
  has: Array<{ type: 'host'; value: string }>;
  destination: string;
  permanent: boolean;
}
export function legacyHostRedirects(env?: Record<string, string | undefined>): LegacyRedirect[];
