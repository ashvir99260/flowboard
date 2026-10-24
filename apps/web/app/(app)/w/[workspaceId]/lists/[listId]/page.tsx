import { UuidSchema } from '@flowboard/contracts';
import { notFound } from 'next/navigation';

import { ListDetails } from '../../../../../../src/features/workspaces/workspace-shell';

export default async function ListPage({ params }: PageProps<'/w/[workspaceId]/lists/[listId]'>) {
  const { workspaceId, listId } = await params;
  const workspace = UuidSchema.safeParse(workspaceId);
  const list = UuidSchema.safeParse(listId);
  if (!workspace.success || !list.success) notFound();

  return <ListDetails listId={list.data} />;
}
