'use client';

import { createContext } from 'react';
import { createRealtimeBus } from './realtimeEvents';

export const RealtimeContext = createContext<ReturnType<typeof createRealtimeBus> | null>(null);
