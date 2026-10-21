/**
 * Who is calling a workspace route: a verified Firebase ID token (AUTH_PROVIDER=firebase), its workspace roles from
 * the custom claim `am_tenants`, and the token itself, forwarded to Firestore so the security rules decide again.
 */
import { firebaseProjectId, firestoreConfigFromEnv, FirestoreRest } from '@/lib/firebase/firestore-rest';
import { verifyFirebaseIdToken, type VerifiedFirebaseUser } from '@/lib/firebase/id-token';
import { tenantRoles, type TenantRole } from './model';

export interface WorkspaceActor {
  uid: string;
  email: string | null;
  tenants: Record<string, TenantRole>;
  db: FirestoreRest;
}

export class WorkspaceAccessError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'WorkspaceAccessError';
  }
}

type Verifier = (token: string) => Promise<Pick<VerifiedFirebaseUser, 'id' | 'email' | 'tenants'> | null>;
let override: Verifier | null = null;

/** Test seam: replaces ID token verification (the emulator's unsigned tokens). */
export function setWorkspaceVerifier(v: Verifier | null): void {
  override = v;
}

export function workspacesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.AUTH_PROVIDER || '').toLowerCase() === 'firebase' && Boolean(firebaseProjectId(env));
}

/**
 * Previews and production share the project's (default) database unless FIRESTORE_DATABASE_ID names another one.
 * A preview therefore writes nothing unless the owner opts in with WORKSPACE_PREVIEW_WRITES=default-db (test data
 * in the production database is an owner decision), or a separate database is configured.
 */
export function previewWriteBlock(env: Record<string, string | undefined> = process.env): string | null {
  if (env.VERCEL_ENV !== 'preview') return null;
  if (env.FIRESTORE_DATABASE_ID && env.FIRESTORE_DATABASE_ID !== '(default)') return null;
  if (env.WORKSPACE_PREVIEW_WRITES === 'default-db') return null;
  return 'This preview shares the production database; workspace writes are disabled here until the owner allows them (WORKSPACE_PREVIEW_WRITES=default-db) or a separate database is configured (FIRESTORE_DATABASE_ID).';
}

export async function workspaceActor(request: Request): Promise<WorkspaceActor> {
  if (!workspacesEnabled()) throw new WorkspaceAccessError(503, 'NOT_CONFIGURED', 'Workspaces need Firebase Auth (AUTH_PROVIDER=firebase) on this deployment.');
  const m = /^Bearer\s+([A-Za-z0-9._~+/=-]{20,4096})$/.exec((request.headers.get('authorization') ?? '').trim());
  if (!m) throw new WorkspaceAccessError(401, 'SIGN_IN_REQUIRED', 'Sign in first.');
  let user: Awaited<ReturnType<Verifier>> = null;
  try {
    user = await (override ?? ((t: string) => verifyFirebaseIdToken(t, firebaseProjectId()!)))(m[1]);
  } catch {
    user = null;
  }
  if (!user) throw new WorkspaceAccessError(401, 'INVALID_TOKEN', 'The sign-in token is invalid or expired. Sign in again.');
  return { uid: user.id, email: user.email, tenants: tenantRoles(user.tenants), db: new FirestoreRest(firestoreConfigFromEnv(), m[1]) };
}

/** The caller's role in workspace `t`; refuses non-members before any database call (the rules refuse them too). */
export function requireMember(actor: WorkspaceActor, t: string): TenantRole {
  const role = actor.tenants[t];
  if (!role) throw new WorkspaceAccessError(403, 'NOT_A_MEMBER', 'You are not a member of this workspace.');
  return role;
}
