import { UuidSchema } from '@flowboard/contracts';

import type { ErrorCode, WorkspaceRole } from '@flowboard/contracts';

export interface TenantRequest {
  actorUserId: string;
  workspaceId: string;
}

export interface TenantContext extends TenantRequest {
  role: WorkspaceRole;
}

export class DatabaseError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export function exactKeys(
  value: unknown,
  allowed: readonly string[],
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  ) {
    throw new DatabaseError('VALIDATION_FAILED', 'Unexpected repository input');
  }
}

export function tenantRequest(value: TenantRequest): TenantRequest {
  exactKeys(value, ['actorUserId', 'workspaceId']);
  return {
    actorUserId: UuidSchema.parse(value.actorUserId).toLowerCase(),
    workspaceId: UuidSchema.parse(value.workspaceId).toLowerCase(),
  };
}
