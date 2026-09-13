'use client';
import { useEffect } from 'react';
import { API_BASE_URL } from './api';
import { AuthScope, getCustomerSession, getSession } from './auth';

declare global {
  interface Window { io?: (url: string, options?: Record<string, unknown>) => Socket; }
}
type Socket = { on: (event: string, callback: (value: unknown) => void) => void; disconnect: () => void };

export function useOrderSocket(onEvent: (event: 'created' | 'updated', value: unknown) => void, scope: AuthScope = 'STAFF') {
  useEffect(() => {
    const token = (scope === 'CUSTOMER' ? getCustomerSession() : getSession())?.accessToken;
    if (!token) return;
    let socket: Socket | undefined;
    let cancelled = false;
    const connect = () => {
      if (cancelled || !window.io) return;
      socket = window.io(API_BASE_URL, { auth: { token }, transports: ['websocket', 'polling'] });
      socket.on('order.created', value => onEvent('created', value));
      socket.on('order.updated', value => onEvent('updated', value));
    };
    if (window.io) connect();
    else {
      const script = document.createElement('script');
      script.src = `${API_BASE_URL}/socket.io/socket.io.js`;
      script.async = true;
      script.onload = connect;
      document.head.appendChild(script);
    }
    return () => { cancelled = true; socket?.disconnect(); };
  }, [onEvent, scope]);
}
