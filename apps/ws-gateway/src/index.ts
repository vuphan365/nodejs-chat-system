import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';
import { prisma } from '@chat/database';
import { config } from './config';
import { logger } from './lib/logger';
import { connectKafkaConsumer, disconnectKafkaConsumer } from './lib/kafka';
import {
  wsJoinRoomSchema,
  wsLeaveRoomSchema,
  wsTypingSchema,
  type SessionUser,
  type KafkaEvent,
  type WsEvent,
} from '@chat/shared';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

// Redis adapter for horizontal scaling
const pubClient = createClient({ url: config.redis.url });
const subClient = pubClient.duplicate();

// Socket authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, config.jwt.secret) as SessionUser;
    socket.data.user = decoded;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
});

// Connection handler
io.on('connection', (socket: Socket) => {
  const user = socket.data.user as SessionUser;
  logger.info({ userId: user.id, socketId: socket.id }, 'Client connected');

  // Join user's personal room for direct messages
  socket.join(`user:${user.id}`);

  // Handle join conversation room
  socket.on('join', async (data) => {
    try {
      const input = wsJoinRoomSchema.parse(data);

      // Verify user is participant
      const participant = await prisma.participant.findUnique({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: user.id,
          },
        },
      });

      if (!participant) {
        socket.emit('error', {
          type: 'error',
          data: { message: 'Not a participant of this conversation' },
        });
        return;
      }

      socket.join(`conversation:${input.conversationId}`);
      logger.debug({ userId: user.id, conversationId: input.conversationId }, 'Joined conversation');

      socket.emit('joined', { conversationId: input.conversationId });
    } catch (error: any) {
      socket.emit('error', {
        type: 'error',
        data: { message: error.message },
      });
    }
  });

  // Handle leave conversation room
  socket.on('leave', async (data) => {
    try {
      const input = wsLeaveRoomSchema.parse(data);
      socket.leave(`conversation:${input.conversationId}`);
      logger.debug({ userId: user.id, conversationId: input.conversationId }, 'Left conversation');
    } catch (error: any) {
      socket.emit('error', {
        type: 'error',
        data: { message: error.message },
      });
    }
  });

  // Handle typing indicator
  socket.on('typing', async (data) => {
    try {
      const input = wsTypingSchema.parse(data);

      // Verify user is participant
      const participant = await prisma.participant.findUnique({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: user.id,
          },
        },
      });

      if (!participant) {
        return;
      }

      // Broadcast to conversation room (except sender)
      socket.to(`conversation:${input.conversationId}`).emit('typing', {
        type: 'typing',
        data: {
          conversationId: input.conversationId,
          userId: user.id,
          username: user.username,
          isTyping: input.isTyping,
        },
      });
    } catch (error: any) {
      logger.error({ error }, 'Error handling typing event');
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    logger.info({ userId: user.id, socketId: socket.id }, 'Client disconnected');
  });
});

// Handle Kafka events and broadcast to WebSocket clients
async function handleKafkaEvent(event: KafkaEvent) {
  try {
    switch (event.type) {
      case 'message.created': {
        const wsEvent: WsEvent = {
          type: 'message:new',
          data: {
            id: event.data.id,
            conversationId: event.data.conversationId,
            senderId: event.data.senderId,
            body: event.data.body,
            createdAt: event.data.createdAt,
          },
        };

        // Broadcast to conversation room
        io.to(`conversation:${event.data.conversationId}`).emit('message:new', wsEvent);
        logger.debug({ conversationId: event.data.conversationId }, 'Broadcasted message:new');
        break;
      }

      case 'message.read': {
        const wsEvent: WsEvent = {
          type: 'read:receipt',
          data: {
            messageId: event.data.messageId,
            conversationId: event.data.conversationId,
            userId: event.data.userId,
            readAt: event.data.readAt,
          },
        };

        // Broadcast to conversation room
        io.to(`conversation:${event.data.conversationId}`).emit('read:receipt', wsEvent);
        break;
      }

      case 'presence.user.changed': {
        const wsEvent: WsEvent = {
          type: 'presence',
          data: {
            userId: event.data.userId,
            status: event.data.status,
          },
        };

        // Broadcast to all connected clients (or specific rooms if needed)
        io.emit('presence', wsEvent);
        break;
      }
    }
  } catch (error) {
    logger.error({ error, event }, 'Error handling Kafka event');
  }
}

// Startup
async function start() {
  try {
    // Connect Redis clients
    await pubClient.connect();
    await subClient.connect();
    logger.info('Redis clients connected');

    // Setup Redis adapter
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO Redis adapter configured');

    // Connect Kafka consumer
    await connectKafkaConsumer(handleKafkaEvent);

    // Start server
    httpServer.listen(config.port, () => {
      logger.info(`WebSocket gateway listening on port ${config.port}`);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start WebSocket gateway');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await disconnectKafkaConsumer();
  await pubClient.quit();
  await subClient.quit();
  httpServer.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await disconnectKafkaConsumer();
  await pubClient.quit();
  await subClient.quit();
  httpServer.close();
  process.exit(0);
});

start();

