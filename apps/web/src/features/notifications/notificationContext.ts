'use client';

import { createContext } from 'react';
import { createNotificationStore } from './notificationStore';

export const NotificationContext = createContext<ReturnType<typeof createNotificationStore> | null>(
  null,
);
