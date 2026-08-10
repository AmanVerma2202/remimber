import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ORIGIN } from '../../api/client';

/**
 * Live collaboration over a single WebSocket to /ws.
 * - joins a room for one note (owner joins by id, invitees by share code)
 * - surfaces other members via `presence`
 * - sends our edits + cursor (client-callbacks let the editor subscribe)
 */
export function useRealtime(noteId, code, access) {
  const wsRef = useRef(null);
  const retryRef = useRef(null);
  const [members, setMembers] = useState([]);
  const callbacksRef = useRef({ onEdit: null, onCursor: null, onMembers: null });
  const noteIdRef = useRef(noteId);
  noteIdRef.current = noteId;
  const codeRef = useRef(code);
  codeRef.current = code;

  useEffect(() => {
    if (!noteId) return;
    let closed = false;

    const connect = () => {
      // Same-origin when API_ORIGIN is empty, else the real API host (Render).
      const base = API_ORIGIN ? new URL(API_ORIGIN) : window.location;
      const wsProto = base.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${wsProto}://${base.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () =>
        ws.send(JSON.stringify({ type: 'join', noteId: noteIdRef.current, code: codeRef.current, access }));

      ws.onmessage = (e) => {
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        if (msg.type === 'presence') {
          setMembers(msg.members || []);
          callbacksRef.current.onMembers?.(msg.members || []);
        } else if (msg.type === 'edit') {
          callbacksRef.current.onEdit?.(msg);
        } else if (msg.type === 'cursor') {
          callbacksRef.current.onCursor?.(msg);
        }
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {}
      };
      ws.onclose = () => {
        if (!closed) retryRef.current = setTimeout(connect, 1500);
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retryRef.current);
      try {
        wsRef.current?.close();
      } catch {}
    };
  }, [noteId]);

  const send = useCallback((payload) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ noteId: noteIdRef.current, ...payload }));
  }, []);

  const sendEdit = useCallback((elements) => send({ type: 'edit', elements }), [send]);
  const sendCursor = useCallback((x, y) => send({ type: 'cursor', x, y }), [send]);
  /** register a handler for remote edits (returns nothing, single slot) */
  const onEdit = useCallback((cb) => (callbacksRef.current.onEdit = cb), []);
  const onCursor = useCallback((cb) => (callbacksRef.current.onCursor = cb), []);

  return { members, sendEdit, sendCursor, onEdit, onCursor };
}

export default useRealtime;