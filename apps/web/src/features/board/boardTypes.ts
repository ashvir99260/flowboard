import type { ResolvedStatus, Task } from '@flowboard/contracts';

export type Selection = { configVersion: number; status: ResolvedStatus; task: Task };
