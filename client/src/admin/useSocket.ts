import { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../socket';
import type { Socket } from 'socket.io-client';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export function useSocketStatus() {
  const [status, setStatus] = useState<ConnectionStatus>(() => {
    const socket = getSocket();
    return socket.connected ? 'connected' : 'disconnected';
  });
  const reconnectedRef = useRef(false);

  useEffect(() => {
    const socket = getSocket();

    function onConnect() {
      const wasReconnect = reconnectedRef.current;
      setStatus('connected');
      if (wasReconnect) {
        window.dispatchEvent(new Event('socket:reconnected'));
      }
      reconnectedRef.current = true;
    }

    function onDisconnect() {
      setStatus('disconnected');
    }

    function onReconnectAttempt() {
      setStatus('reconnecting');
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);

    if (socket.connected) {
      setStatus('connected');
      reconnectedRef.current = true;
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
    };
  }, []);

  return status;
}

export function useRefetchOnReconnect(refetch: () => void) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    function handleReconnect() {
      refetchRef.current();
    }

    window.addEventListener('socket:reconnected', handleReconnect);
    return () => window.removeEventListener('socket:reconnected', handleReconnect);
  }, []);
}
