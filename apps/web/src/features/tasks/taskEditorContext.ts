'use client';

import { createContext } from 'react';

export const TaskEditorContext = createContext<
  ((taskId: string | null, targetListId?: string) => void) | null
>(null);
