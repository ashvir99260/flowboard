import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../../core/common/errors/api-exception.ts';
import { ApiLoggerKey } from '../../core/common/tokens/logger.token.ts';
import { PermissionService } from '../permissions/permission.service.ts';

import type { CursorCodec } from '../../core/common/cursor.ts';
import type { SearchPage, SearchWorkspaceQuery } from '@flowboard/contracts';
import type { Database, IdentitySession } from '@flowboard/database';
import type { Logger } from '@flowboard/logger';

export const SearchRuntimeKey = 'flowboard:search-runtime';

export interface SearchRuntime {
  cursor?: CursorCodec;
  database?: Database;
}

@Injectable()
export class SearchService {
  constructor(
    @Inject(SearchRuntimeKey) private readonly runtime: SearchRuntime,
    private readonly permissions: PermissionService,
    @Inject(ApiLoggerKey) private readonly logger: Logger,
  ) {}
  search(identity: IdentitySession, query: SearchWorkspaceQuery): Promise<SearchPage> {
    const { database, cursor } = this.runtime;
    if (!database || !cursor)
      throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Search unavailable');

    if (!identity.activeWorkspace)
      throw new ApiException(403, 'MEMBERSHIP_REQUIRED', 'Workspace membership required');

    const context = { actorUserId: identity.user.id, workspaceId: identity.activeWorkspace.id };
    const binding = {
      caller: context.actorUserId,
      workspaceId: context.workspaceId,
      resource: 'search',
      limit: query.limit,
      fingerprint: createHash('sha256').update(query.q).digest('hex'),
    };
    const previous = cursor.decodeSearch(query.cursor, binding);

    return this.logger.observe('search.workspace', () =>
      database.read(context, async (store) => {
        this.permissions.assert(store.context, 'workspace.read', context.workspaceId);
        const { items: rows, ...revisions } = await store.search.list(query, previous?.after);
        if (
          previous &&
          (previous.configVersion !== revisions.configVersion ||
            previous.dataVersion !== revisions.dataVersion)
        )
          throw new ApiException(409, 'CURSOR_STALE', 'Search results changed; restart pagination');

        const items = rows.slice(0, query.limit);
        const last = items.at(-1);
        const hasNextPage = rows.length > query.limit;

        return {
          items,
          ...revisions,
          pageInfo: {
            hasNextPage,
            nextCursor:
              hasNextPage && last
                ? cursor.encodeSearch(
                    binding,
                    { type: last.type, id: last.id },
                    revisions,
                    previous,
                  )
                : null,
          },
        };
      }),
    );
  }
}
