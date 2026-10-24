import type { WorkspaceRole } from '@flowboard/contracts';

export interface MembershipPosition {
  createdAt: Date;
  id: string;
}

export interface MembershipPageQuery {
  after?: MembershipPosition;
  assignableToListId?: string;
  limit: number;
}

export interface MemberProfile {
  createdAt: Date;
  email: string;
  name: string;
  role: WorkspaceRole;
  updatedAt: Date;
  userId: string;
  workspaceId: string;
}
