'use client';

import { useContext } from 'react';
import { NotificationContext } from './notificationContext';

export function useNotifications() {
  const store = useContext(NotificationContext);

  if (!store) throw new Error('Notifications require NotificationProvider');

  return store;
}
