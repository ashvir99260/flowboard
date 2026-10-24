import { UuidSchema } from '@flowboard/contracts';
import { notFound } from 'next/navigation';

import { WorkspaceShell } from '../../../../src/features/workspaces/workspace-shell';

export default async function WorkspaceLayout({
  params,
  children,
}: LayoutProps<'/w/[workspaceId]'>) {
  const { workspaceId } = await params;
  const parsed = UuidSchema.safeParse(workspaceId);
  if (!parsed.success) notFound();

  return <WorkspaceShell workspaceId={parsed.data}>{children}</WorkspaceShell>;
}
