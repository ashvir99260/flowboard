'use client';

import { useContext } from 'react';
import { TaskEditorContext } from './taskEditorContext';

export function useTaskEditor() {
  const open = useContext(TaskEditorContext);

  if (!open) throw new Error('Task controls require TaskEditorProvider');

  return open;
}
