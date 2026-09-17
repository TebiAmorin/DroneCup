import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { setIO } from './emitter.js';

export function setupSocketIO(httpServer: HttpServer): SocketServer {
  const corsOrigin = process.env.CORS_ORIGIN || '*';
  const io = new SocketServer(httpServer, {
    cors: { origin: corsOrigin },
  });

  setIO(io);

  io.on('connection', (socket) => {
    socket.join('competition');

    socket.on('disconnect', () => {
      // Client disconnected — no cleanup needed
    });
  });

  return io;
}
