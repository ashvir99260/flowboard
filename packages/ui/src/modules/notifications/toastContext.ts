'use client';
import { createContext } from 'react';

export const RegionContext = createContext<((element: HTMLElement) => () => void) | null>(null);
