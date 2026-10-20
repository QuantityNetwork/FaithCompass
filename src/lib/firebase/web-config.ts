/**
 * Public Firebase web config for the browser SDK (not secret; it identifies the project, it grants nothing).
 * Pasted by the owner into Vercel as NEXT_PUBLIC_FIREBASE_* variables. Access is decided by Firebase Auth and
 * firestore.rules, not by these values.
 */
export const WEB_CONFIG_VARS = ['NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID'] as const;

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

/**
 * Next.js inlines NEXT_PUBLIC_* only for literal `process.env.NAME` reads, so the default reads each one literally.
 */
export function firebaseWebConfig(
  env: Record<string, string | undefined> = {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  },
): { ok: true; config: FirebaseWebConfig } | { ok: false; missing: string[] } {
  const missing = WEB_CONFIG_VARS.filter((k) => !env[k]);
  if (missing.length) return { ok: false, missing };
  return {
    ok: true,
    config: {
      apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
      projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      appId: env.NEXT_PUBLIC_FIREBASE_APP_ID!,
      ...(env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? { storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET } : {}),
      ...(env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? { messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID } : {}),
    },
  };
}
