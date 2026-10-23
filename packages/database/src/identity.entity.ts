import type { WorkspaceRole } from '@flowboard/contracts';

export interface IdentityUser {
  createdAt: Date;
  email: string;
  id: string;
  name: string;
  updatedAt: Date;
}
export interface IdentityWorkspace {
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
export interface SessionCredential {
  expiresAt: Date;
  familyId: string;
  tokenDigest: string;
}
