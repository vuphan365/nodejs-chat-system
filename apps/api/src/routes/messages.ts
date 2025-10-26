import { Router } from 'express';
import { prisma } from '@chat/database';
import { sendMessageSchema, getMessagesSchema, markAsReadSchema } from '@chat/shared';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
import { messageRateLimiter } from '../middleware/rateLimiter';
import { publishEvent } from '../lib/kafka';
import type { ApiResponse, PaginatedResponse, MessageCreatedEvent } from '@chat/shared';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get messages for a conversation
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const input = getMessagesSchema.parse({
      conversationId: req.query.conversationId,
      cursor: req.query.cursor,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    });

    // Check if user is participant
    const participant = await prisma.participant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      return res.status(403).json({
        success: false,
        error: { message: 'Not a participant of this conversation' },
      } as ApiResponse);
    }

    // Fetch messages
    const messages = await prisma.message.findMany({
      where: {
        conversationId: input.conversationId,
        ...(input.cursor && {
          createdAt: { lt: new Date(input.cursor) },
        }),
      },
      include: {
        sender: {
          select: { id: true, username: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: input.limit + 1,
    });

    const hasMore = messages.length > input.limit;
    const data = messages.slice(0, input.limit);

    const response: PaginatedResponse<typeof data[0]> = {
      data,
      cursor: hasMore ? data[data.length - 1].createdAt.toISOString() : undefined,
      hasMore,
    };

    res.json({ success: true, data: response } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message },
    } as ApiResponse);
  }
});

// Send message
router.post('/', messageRateLimiter, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const input = sendMessageSchema.parse(req.body);
    const idempotencyKey = req.headers['idempotency-key'] as string;

    // Check if user is participant
    const participant = await prisma.participant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      return res.status(403).json({
        success: false,
        error: { message: 'Not a participant of this conversation' },
      } as ApiResponse);
    }

    // Check for duplicate (idempotency)
    if (idempotencyKey) {
      const existing = await prisma.message.findFirst({
        where: {
          id: idempotencyKey,
        },
      });

      if (existing) {
        return res.json({ success: true, data: existing } as ApiResponse);
      }
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        id: idempotencyKey || undefined,
        conversationId: input.conversationId,
        senderId: userId,
        body: input.body,
        encrypted: false,
        keyVersion: null,
        iv: null,
        authTag: null,
      },
      include: {
        sender: {
          select: { id: true, username: true, email: true },
        },
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: input.conversationId },
      data: { updatedAt: new Date() },
    });

    // Update inbox for all participants except sender
    const participants = await prisma.participant.findMany({
      where: {
        conversationId: input.conversationId,
        userId: { not: userId },
      },
    });

    await Promise.all(
      participants.map((p) =>
        prisma.inbox.upsert({
          where: {
            userId_conversationId: {
              userId: p.userId,
              conversationId: input.conversationId,
            },
          },
          update: {
            unreadCount: { increment: 1 },
            lastMessageId: message.id,
            lastActivity: new Date(),
          },
          create: {
            userId: p.userId,
            conversationId: input.conversationId,
            unreadCount: 1,
            lastMessageId: message.id,
            lastActivity: new Date(),
          },
        })
      )
    );

    // Publish to Kafka
    const event: MessageCreatedEvent = {
      type: 'message.created',
      data: {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        body: input.body,
        encrypted: false,
        keyVersion: undefined,
        createdAt: message.createdAt.toISOString(),
      },
    };

    await publishEvent(event);

    res.json({ success: true, data: message } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message },
    } as ApiResponse);
  }
});

// Mark message as read
router.post('/read', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const input = markAsReadSchema.parse(req.body);

    // Check if user is participant
    const participant = await prisma.participant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      return res.status(403).json({
        success: false,
        error: { message: 'Not a participant of this conversation' },
      } as ApiResponse);
    }

    // Get the message that was just marked as read
    const readMessage = await prisma.message.findUnique({
      where: { id: input.messageId },
      select: { id: true, conversationId: true, createdAt: true },
    });

    if (!readMessage) {
      return res.status(404).json({
        success: false,
        error: { message: 'Message not found' },
      } as ApiResponse);
    }

    // Verify the message belongs to the conversation
    if (readMessage.conversationId !== input.conversationId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Message does not belong to this conversation' },
      } as ApiResponse);
    }

    // Count unread messages: messages created after this read message
    // that were sent by other users (not the current user)
    const unreadCount = await prisma.message.count({
      where: {
        conversationId: input.conversationId,
        createdAt: { gt: readMessage.createdAt },
        senderId: { not: userId }, // Don't count own messages as unread
      },
    });

    const readAt = new Date();

    // Update inbox with the correct unread count and lastMessageId
    const inbox = await prisma.inbox.update({
      where: {
        userId_conversationId: {
          userId,
          conversationId: input.conversationId,
        },
      },
      data: {
        unreadCount: unreadCount,
        lastMessageId: input.messageId,
        lastActivity: readAt,
      },
    });

    // Publish to Kafka
    await publishEvent({
      type: 'message.read',
      data: {
        messageId: input.messageId,
        conversationId: input.conversationId,
        userId,
        readAt: readAt.toISOString(),
      },
    });

    res.json({
      success: true,
      data: {
        messageId: input.messageId,
        conversationId: input.conversationId,
        userId,
        readAt: readAt.toISOString(),
        unreadCount: inbox.unreadCount,
      }
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message },
    } as ApiResponse);
  }
});

export default router;

