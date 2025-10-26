import { Router } from 'express';
import { prisma } from '@chat/database';
import { sendMessageSchema, getMessagesSchema, markAsReadSchema } from '@chat/shared';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
import { messageRateLimiter } from '../middleware/rateLimiter';
import { publishEvent } from '../lib/kafka';
import { encryptionService } from '@chat/encryption';
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

    // Decrypt messages if needed
    const decryptedMessages = data.map((msg) => ({
      ...msg,
      body: encryptionService.decryptMessage({
        body: msg.body,
        encrypted: msg.encrypted,
        keyVersion: msg.keyVersion,
        iv: msg.iv,
        authTag: msg.authTag,
      }),
    }));

    const response: PaginatedResponse<typeof decryptedMessages[0]> = {
      data: decryptedMessages,
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

    // Encrypt message if enabled
    const encrypted = encryptionService.encryptMessage(input.body);

    // Create message
    const message = await prisma.message.create({
      data: {
        id: idempotencyKey || undefined,
        conversationId: input.conversationId,
        senderId: userId,
        body: encrypted.body,
        encrypted: encrypted.encrypted,
        keyVersion: encrypted.keyVersion,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
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
        body: input.body, // Send plaintext to Kafka for other services
        encrypted: encrypted.encrypted,
        keyVersion: encrypted.keyVersion || undefined,
        createdAt: message.createdAt.toISOString(),
      },
    };

    await publishEvent(event);

    // Return decrypted message
    const response = {
      ...message,
      body: input.body,
    };

    res.json({ success: true, data: response } as ApiResponse);
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

    // Create read receipt
    const receipt = await prisma.readReceipt.upsert({
      where: {
        messageId_userId: {
          messageId: input.messageId,
          userId,
        },
      },
      update: {},
      create: {
        messageId: input.messageId,
        userId,
      },
    });

    // Update inbox unread count
    await prisma.inbox.update({
      where: {
        userId_conversationId: {
          userId,
          conversationId: input.conversationId,
        },
      },
      data: {
        unreadCount: { decrement: 1 },
      },
    });

    // Publish to Kafka
    await publishEvent({
      type: 'message.read',
      data: {
        messageId: input.messageId,
        conversationId: input.conversationId,
        userId,
        readAt: receipt.readAt.toISOString(),
      },
    });

    res.json({ success: true, data: receipt } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message },
    } as ApiResponse);
  }
});

export default router;

