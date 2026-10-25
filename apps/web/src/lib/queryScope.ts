export interface QueryScope {
  readonly revision: number;
  readonly userId: string;
  readonly workspaceId: string | null;
}

/** Keep the generated first-item structure; its query functions read that item. */
export function withQueryScope<T extends { queryKey: readonly [{ tags?: readonly string[] }] }>(
  options: T,
  { revision, userId, workspaceId }: QueryScope,
  tags: readonly string[] = [],
): T {
  return {
    ...options,
    queryKey: [
      {
        ...options.queryKey[0],
        tags: [
          ...(options.queryKey[0].tags ?? []),
          ...tags,
          `flowboard:${JSON.stringify({ revision, userId, workspaceId })}`,
        ],
      },
    ],
  };
}
