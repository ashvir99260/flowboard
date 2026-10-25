import {
  resolveVisibleTree,
  SearchPositionSchema,
  SearchWorkspaceQuerySchema,
} from '@flowboard/contracts';

import { Prisma } from './generated/client.js';
import { DatabaseError } from './tenant-context.js';

import type { accessRepository } from './access-repository.js';
import type { TenantContext } from './tenant-context.js';
import type { SearchHit, SearchPosition, SearchWorkspaceQuery } from '@flowboard/contracts';

export function searchRepository(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  assertActive: () => void,
  access: ReturnType<typeof accessRepository>['read'],
) {
  return Object.freeze({
    async list(input: SearchWorkspaceQuery, after?: SearchPosition) {
      assertActive();
      const parsed = SearchWorkspaceQuerySchema.safeParse({ ...input, limit: String(input.limit) });
      if (!parsed.success) throw new DatabaseError('VALIDATION_FAILED', 'Invalid search query');

      const query = parsed.data;
      const { nodes, grants, workspace } = await access.snapshot();
      const visible = resolveVisibleTree(nodes, grants, context.workspaceId, context.role);
      const lists = visible.filter(({ node }) => node.type === 'list');
      const revisions = {
        configVersion: workspace.configVersion,
        dataVersion: workspace.dataVersion,
      };
      if (lists.length === 0) return { items: [], ...revisions };

      const listIds = Prisma.join(lists.map(({ node }) => Prisma.sql`${node.id}::uuid`));
      const cursor = after ? SearchPositionSchema.parse(after) : undefined;
      const continuation = cursor
        ? Prisma.sql`WHERE (type COLLATE "C", id) > (${cursor.type}::text COLLATE "C", ${cursor.id}::uuid)`
        : Prisma.empty;
      const rows = await tx.$queryRaw<Omit<SearchHit, 'path'>[]>(Prisma.sql`
        SELECT * FROM (
          SELECT t.id, 'task'::text AS type, t.title, t.primary_list_id AS "containerId"
          FROM tasks t
          WHERE t.workspace_id=${context.workspaceId}::uuid AND t.archived_at IS NULL
            AND t.primary_list_id IN (${listIds})
            AND to_tsvector('simple', coalesce(t.title, '') || ' ' || coalesce(t.description, '')) @@ websearch_to_tsquery('simple', ${query.q})
          UNION ALL
          SELECT n.id, 'list'::text AS type, n.name AS title, n.parent_id AS "containerId"
          FROM nodes n
          WHERE n.workspace_id=${context.workspaceId}::uuid AND n.archived_at IS NULL
            AND n.id IN (${listIds})
            AND to_tsvector('simple', n.name) @@ websearch_to_tsquery('simple', ${query.q})
        ) hits ${continuation}
        ORDER BY type COLLATE "C" ASC, id ASC LIMIT ${query.limit + 1}`);
      const names = new Map(visible.map(({ node }) => [node.id, node.name]));
      const paths = new Map(
        lists.map(({ node, path }) => [node.id, path.map((part) => names.get(part.id)!)]),
      );

      return {
        items: rows.map((row) => ({
          ...row,
          path:
            row.type === 'task' ? paths.get(row.containerId!)! : paths.get(row.id)!.slice(0, -1),
        })),
        ...revisions,
      };
    },
  });
}
