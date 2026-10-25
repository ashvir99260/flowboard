import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { assembleTaskDetail } from '../tasks/taskDetailData';
import type { Task } from '@flowboard/contracts';

export type BulkTaskDetail = Extract<ReturnType<typeof assembleTaskDetail>, { state: 'ready' }>;

export type BulkTaskEditorProps = {
  listId: string;
  onClose: () => void;
  onSaved: () => void;
  runtime: ClientRuntime;
  scope: QueryScope;
  tasks: readonly Task[];
};
