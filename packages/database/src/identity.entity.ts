import type { WorkspaceRole } from '@flowboard/contracts';

export interface IdentityUser {
  createdAt: Date;
  email: string;
  id: string;
  name: string;
  updatedAt: Date;
}

export interface IdentityWorkspace {
  archivedAt: Date | null;
  createdAt: Date;
  id: string;
  name: string;
  role: WorkspaceRole;
  updatedAt: Date;
}

export interface IdentitySession {
  activeWorkspace: IdentityWorkspace | null;
  expiresAt: Date;
  familyId: string;
  user: IdentityUser;
}

export interface AuthenticatedIdentity extends IdentitySession {
  selectedWorkspaceId: string | null;
}

export interface SessionIdentity {
  familyId: string;
  userId: string;
  workspaceId: string | null;
}

export interface SessionCredential {
  expiresAt: Date;
  familyId: string;
  tokenDigest: string;
}

export type RefreshResult =
  { status: 'invalid' } | { status: 'reused' } | { session: IdentitySession; status: 'rotated' };
