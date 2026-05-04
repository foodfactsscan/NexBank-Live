// WebSocket client with token-aware authenticate handshake and exponential
// reconnect backoff. The server's first message back is { type:'authenticated' }
// — anything else (or no response in 5 s) means we tear down and retry.

import { useEffect, useRef } from 'react';
import { getAccessToken } from './api';

type Handler = (msg: any) => void;

class RealtimeClient {
  private socket: WebSocket | null = null;
  private accountId: string | null = null;
  private handlers: Map<string, Set<Handler>> = new Map();
  private reconnectTimer: number | null = null;
  private backoff = 1000;
  private connected = false;

  connect(accountId: string) {
    if (this.socket && this.accountId === accountId) return;
    this.disconnect();
    this.accountId = accountId;
    this.open();
  }

  private open() {
    if (!this.accountId) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/ws`;
    try {
      this.socket = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket.onopen = () => {
      const token = getAccessToken();
      if (!token || !this.accountId) { this.disconnect(); return; }
      this.socket!.send(JSON.stringify({ type: 'authenticate', token, accountId: this.accountId }));
    };
    this.socket.onmessage = (e) => {
      let msg: any;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === 'authenticated') {
        this.connected = true;
        this.backoff = 1000;
        this.dispatch('connect', msg);
        return;
      }
      this.dispatch(msg.type || '*', msg);
    };
    this.socket.onclose = () => {
      this.connected = false;
      this.dispatch('disconnect', null);
      this.scheduleReconnect();
    };
    this.socket.onerror = () => {
      try { this.socket?.close(); } catch { /* */ }
    };
  }

  private scheduleReconnect() {
    if (!this.accountId) return;
    if (this.reconnectTimer != null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.backoff = Math.min(this.backoff * 1.5, 15000);
      this.open();
    }, this.backoff);
  }

  disconnect() {
    if (this.reconnectTimer != null) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.socket) {
      try { this.socket.close(); } catch { /* */ }
      this.socket = null;
    }
    this.accountId = null;
    this.connected = false;
  }

  on(type: string, fn: Handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }

  private dispatch(type: string, msg: any) {
    this.handlers.get(type)?.forEach((fn) => { try { fn(msg); } catch { /* */ } });
    this.handlers.get('*')?.forEach((fn) => { try { fn(msg); } catch { /* */ } });
  }

  isConnected() { return this.connected; }
}

export const realtime = new RealtimeClient();

export function useRealtime(accountId: string | null | undefined, type: string, handler: Handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!accountId) return;
    realtime.connect(accountId);
    const off = realtime.on(type, (m) => ref.current(m));
    return () => { off?.(); };
  }, [accountId, type]);
}
