import { Server as SocketIOServer, Socket } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import { verifyAccessToken } from '../auth/jwt.js';
import { Roles } from '@restaurant-os/shared';

export interface RealtimeEvent<T = any> {
  id: string; // event id (UUID or timestamp cursor)
  event: string;
  data: T;
  timestamp: number;
}

// In-memory event log for catch-up on reconnect (per restaurant)
const eventLog: Map<string, RealtimeEvent[]> = new Map();
const MAX_EVENT_LOG = 500;

let ioInstance: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export function initRealtimeServer(fastifyApp: FastifyInstance): SocketIOServer {
  const io = new SocketIOServer(fastifyApp.server, {
    cors: {
      origin: true,
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Handshake authentication
  io.use((socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.slice(7)
          : null);

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = verifyAccessToken(token);
      (socket as any).user = payload;
      next();
    } catch (err: any) {
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    if (!user || !user.restaurantId) {
      socket.disconnect(true);
      return;
    }

    const { restaurantId, role } = user;

    // Join room based on role
    // Base restaurant room
    socket.join(`restaurant:${restaurantId}`);

    if (role === Roles.OWNER || role === Roles.MANAGER) {
      socket.join(`restaurant:${restaurantId}:owner`);
      socket.join(`restaurant:${restaurantId}:kitchen`);
      socket.join(`restaurant:${restaurantId}:floor`);
    } else if (role === Roles.KITCHEN) {
      socket.join(`restaurant:${restaurantId}:kitchen`);
    } else if (role === Roles.WAITER) {
      socket.join(`restaurant:${restaurantId}:floor`);
    }

    // Role-scoped join request guard (waiter cannot join owner room)
    socket.on(
      'join_room',
      (roomName: string, ack?: (res: { ok: boolean; error?: string }) => void) => {
        if (roomName.includes(':owner') && role !== Roles.OWNER && role !== Roles.MANAGER) {
          if (ack) ack({ ok: false, error: 'Unauthorized to join owner room' });
          return;
        }
        socket.join(roomName);
        if (ack) ack({ ok: true });
      },
    );

    // Reconnection catch-up: client sends `since` cursor timestamp
    socket.on(
      'catch_up',
      (data: { since?: number }, callback?: (events: RealtimeEvent[]) => void) => {
        const since = data?.since || 0;
        const history = eventLog.get(restaurantId) || [];
        const missed = history.filter((e) => e.timestamp > since);
        if (callback) {
          callback(missed);
        }
      },
    );
  });

  ioInstance = io;
  return io;
}

/**
 * Emits realtime event to specified role rooms or whole restaurant.
 */
export function emitRealtimeEvent(
  restaurantId: string,
  event: string,
  data: any,
  target: 'all' | 'kitchen' | 'floor' | 'owner' = 'all',
) {
  if (!ioInstance) return;

  const eventPayload: RealtimeEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    event,
    data,
    timestamp: Date.now(),
  };

  // Append to event log for catch-up
  if (!eventLog.has(restaurantId)) {
    eventLog.set(restaurantId, []);
  }
  const history = eventLog.get(restaurantId)!;
  history.push(eventPayload);
  if (history.length > MAX_EVENT_LOG) {
    history.shift();
  }

  // Determine rooms
  if (target === 'all') {
    ioInstance.to(`restaurant:${restaurantId}`).emit(event, eventPayload);
  } else {
    ioInstance.to(`restaurant:${restaurantId}:${target}`).emit(event, eventPayload);
  }
}
