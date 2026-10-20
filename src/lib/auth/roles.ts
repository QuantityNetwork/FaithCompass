/**
 * Roles and permissions (Master Prompt 3, §3).
 *
 * The server decides what an actor may do. A role is never read from a request body,
 * a query string or a client-set header: it comes only from a verified identity
 * (see ./actor.ts), and without one every request is a public reader. Deny by default:
 * a permission not listed for a role is refused.
 */

export const ROLES = [
  'public_reader',
  'research_contributor',
  'research_editor',
  'scholarly_reviewer',
  'editorial_admin',
  'system_admin',
] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  /** Read published records. Needs no account. */
  'record.read',
  /** Submit a challenge as a proposal, kept apart from the published assessment. */
  'proposal.create',
  /** Generate a provisional analysis as an isolated draft (never published by doing so). */
  'draft.create',
  /** Approve or reject someone else's proposal, creating a versioned revision. */
  'proposal.decide',
  /** Attest a review in one's own name (qualified reviewers only; never the AI). */
  'review.attest',
  /** Assign reviewers, publish, withdraw or supersede. */
  'publication.manage',
  /** Operate the service: migrations, keys, quotas. Grants no scholarly authority. */
  'system.operate',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const GRANTS: Record<Role, readonly Permission[]> = {
  public_reader: ['record.read', 'proposal.create', 'draft.create'],
  research_contributor: ['record.read', 'proposal.create', 'draft.create'],
  research_editor: ['record.read', 'proposal.create', 'draft.create', 'proposal.decide'],
  scholarly_reviewer: ['record.read', 'proposal.create', 'draft.create', 'review.attest'],
  editorial_admin: ['record.read', 'proposal.create', 'draft.create', 'proposal.decide', 'publication.manage'],
  // Least privilege: operating the system confers no editorial or review authority.
  system_admin: ['record.read', 'system.operate'],
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role, permission: Permission): boolean {
  return GRANTS[role]?.includes(permission) ?? false;
}

export function grantsOf(role: Role): readonly Permission[] {
  return GRANTS[role];
}
