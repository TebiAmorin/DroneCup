import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Dummy no-op socket that satisfies the Socket.IO interface
 * enough for useCompetition / useCreatorOverlay to call .on()/.off()/.emit()
 * without crashing when the real server is offline (static mode).
 */
class NoopSocket {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  on(_event: string, _fn: (...args: unknown[]) => void) { return this; }
  off(_event: string, _fn: (...args: unknown[]) => void) { return this; }
  emit(_event: string, ..._args: unknown[]) { return this; }
  get connected() { return false; }
}

let noopSocket: NoopSocket | null = null;

export function getSocket(): Socket {
  // In static mode the backend is unreachable; return a harmless stub.
  if ((globalThis as Record<string, unknown>).__DRONECUP_STATIC__) {
    if (!noopSocket) noopSocket = new NoopSocket();
    return noopSocket as unknown as Socket;
  }

  if (!socket) {
    socket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3,
      timeout: 5000,
    });

    // If the socket can't connect, flip to noop mode to avoid
    // console noise and keep the page working.
    socket.on('connect_error', () => {
      (globalThis as Record<string, unknown>).__DRONECUP_STATIC__ = true;
      socket?.disconnect();
      socket = null;
    });
  }
  return socket;
}
