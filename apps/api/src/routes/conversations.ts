import { Router } from 'express';
import { prisma } from '@chat/database';
import { createConversationSchema, updateConversationSchema } from '@chat/shared';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
import { encryptionService } from '@chat/encryption';
import type { ApiResponse } from '@chat/shared';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get user's conversations
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, email: true },
            },
          },
        },
        _count: {
          select: { messages: true },
        }
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Get last message and calculate unread counts for each conversation
    const conversationData = await Promise.all(
      conversations.map(async (conv) => {
        // Get the last message in this conversation
        const lastMessage = await prisma.message.findFirst({
          where: { conversationId: conv.id },
          select: { body: true, createdAt: true, encrypted: true, keyVersion: true, iv: true, authTag: true },
          orderBy: { createdAt: 'desc' },
        });

        // Find the last message the user read in this conversation
        const lastReadReceipt = await prisma.readReceipt.findFirst({
          where: {
            userId,
            message: {
              conversationId: conv.id,
            },
          },
          include: {
            message: {
              select: { createdAt: true },
            },
          },
          orderBy: {
            message: {
              createdAt: 'desc',
            },
          },
        });

        // If no read receipt, count all messages from others as unread
        let unreadCount = 0;
        if (!lastReadReceipt) {
          unreadCount = await prisma.message.count({
            where: {
              conversationId: conv.id,
              senderId: { not: userId },
            },
          });
        } else {
          // Count messages created after the last read message from other users
          unreadCount = await prisma.message.count({
            where: {
              conversationId: conv.id,
              createdAt: { gt: lastReadReceipt.message.createdAt },
              senderId: { not: userId },
            },
          });
        }

        return {
          conversationId: conv.id,
          unreadCount,
          lastMessage: lastMessage ? {
            body: encryptionService.decryptMessage({
              body: lastMessage.body,
              encrypted: lastMessage.encrypted,
              keyVersion: lastMessage.keyVersion,
              iv: lastMessage.iv,
              authTag: lastMessage.authTag,
            }),
            createdAt: lastMessage.createdAt.toISOString(),
          } : undefined,
        };
      })
    );

    const dataMap = new Map(conversationData.map(d => [d.conversationId, d]));

    // Transform the response to have friendly field names
    const formattedConversations = conversations.map(conv => {
      const { _count, ...rest } = conv;
      const data = dataMap.get(conv.id);
      return {
        ...rest,
        count: _count.messages,
        unreadCount: data?.unreadCount || 0,
        lastMessage: data?.lastMessage,
      };
    });

    res.json({ success: true, data: formattedConversations } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    } as ApiResponse);
  }
});

// Get conversation by ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, email: true },
            },
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: { message: 'Conversation not found' },
      } as ApiResponse);
    }

    // Get the last message in this conversation
    const lastMessage = await prisma.message.findFirst({
      where: { conversationId: id },
      select: { body: true, createdAt: true, encrypted: true, keyVersion: true, iv: true, authTag: true },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate unread count based on last read message
    const lastReadReceipt = await prisma.readReceipt.findFirst({
      where: {
        userId,
        message: {
          conversationId: id,
        },
      },
      include: {
        message: {
          select: { createdAt: true },
        },
      },
      orderBy: {
        message: {
          createdAt: 'desc',
        },
      },
    });

    let unreadCount = 0;
    if (!lastReadReceipt) {
      // No read receipt, count all messages from others as unread
      unreadCount = await prisma.message.count({
        where: {
          conversationId: id,
          senderId: { not: userId },
        },
      });
    } else {
      // Count messages created after the last read message from other users
      unreadCount = await prisma.message.count({
        where: {
          conversationId: id,
          createdAt: { gt: lastReadReceipt.message.createdAt },
          senderId: { not: userId },
        },
      });
    }

    // Transform the response to have friendly field names
    const { _count, ...rest } = conversation;
    const formattedConversation = {
      ...rest,
      count: _count.messages,
      unreadCount,
      lastMessage: lastMessage ? {
        body: encryptionService.decryptMessage({
          body: lastMessage.body,
          encrypted: lastMessage.encrypted,
          keyVersion: lastMessage.keyVersion,
          iv: lastMessage.iv,
          authTag: lastMessage.authTag,
        }),
        createdAt: lastMessage.createdAt.toISOString(),
      } : undefined,
    };

    res.json({ success: true, data: formattedConversation } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    } as ApiResponse);
  }
});

// Create conversation
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const input = createConversationSchema.parse(req.body);

    // Ensure creator is in participants
    const participantIds = Array.from(new Set([userId, ...input.participantIds]));

    // For direct conversations, ensure exactly 2 participants
    if (input.type === 'direct' && participantIds.length !== 2) {
      return res.status(400).json({
        success: false,
        error: { message: 'Direct conversations must have exactly 2 participants' },
      } as ApiResponse);
    }

    // Check if direct conversation already exists
    if (input.type === 'direct') {
      const existing = await prisma.conversation.findFirst({
        where: {
          type: 'direct',
          participants: {
            every: {
              userId: { in: participantIds },
            },
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, username: true, email: true },
              },
            },
          },
          _count: {
            select: { messages: true },
          },
        },
      });

      if (existing && existing.participants.length === 2) {
        // Get the last message in this conversation
        const lastMessage = await prisma.message.findFirst({
          where: { conversationId: existing.id },
          select: { body: true, createdAt: true, encrypted: true, keyVersion: true, iv: true, authTag: true },
          orderBy: { createdAt: 'desc' },
        });

        // Calculate unread count based on last read message
        const lastReadReceipt = await prisma.readReceipt.findFirst({
          where: {
            userId,
            message: {
              conversationId: existing.id,
            },
          },
          include: {
            message: {
              select: { createdAt: true },
            },
          },
          orderBy: {
            message: {
              createdAt: 'desc',
            },
          },
        });

        let unreadCount = 0;
        if (!lastReadReceipt) {
          // No read receipt, count all messages from others as unread
          unreadCount = await prisma.message.count({
            where: {
              conversationId: existing.id,
              senderId: { not: userId },
            },
          });
        } else {
          // Count messages created after the last read message from other users
          unreadCount = await prisma.message.count({
            where: {
              conversationId: existing.id,
              createdAt: { gt: lastReadReceipt.message.createdAt },
              senderId: { not: userId },
            },
          });
        }

        const { _count, ...rest } = existing;
        const formattedExisting = {
          ...rest,
          count: _count.messages,
          unreadCount,
          lastMessage: lastMessage ? {
            body: encryptionService.decryptMessage({
              body: lastMessage.body,
              encrypted: lastMessage.encrypted,
              keyVersion: lastMessage.keyVersion,
              iv: lastMessage.iv,
              authTag: lastMessage.authTag,
            }),
            createdAt: lastMessage.createdAt.toISOString(),
          } : undefined,
        };

        return res.json({ success: true, data: formattedExisting } as ApiResponse);
      }
    }

    // Create conversation
    const conversation = await prisma.conversation.create({
      data: {
        type: input.type,
        name: input.name,
        participants: {
          create: participantIds.map((id) => ({
            userId: id,
            role: id === userId ? 'admin' : 'member',
          })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, email: true },
            },
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    // Create inbox entries for all participants
    await prisma.inbox.createMany({
      data: participantIds.map((id) => ({
        userId: id,
        conversationId: conversation.id,
        unreadCount: 0,
      })),
    });

    // Transform the response to have friendly field names
    const { _count, ...rest } = conversation;
    const formattedConversation = {
      ...rest,
      count: _count.messages,
      unreadCount: 0, // New conversation has no unread messages
      lastMessage: undefined, // New conversation has no messages yet
    };

    res.json({ success: true, data: formattedConversation } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message },
    } as ApiResponse);
  }
});

// Update conversation
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const input = updateConversationSchema.parse(req.body);

    // Check if user is admin
    const participant = await prisma.participant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId,
        },
      },
    });

    if (!participant || participant.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Only admins can update conversations' },
      } as ApiResponse);
    }

    const conversation = await prisma.conversation.update({
      where: { id },
      data: input,
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, email: true },
            },
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    // Get the last message in this conversation
    const lastMessage = await prisma.message.findFirst({
      where: { conversationId: id },
      select: { body: true, createdAt: true, encrypted: true, keyVersion: true, iv: true, authTag: true },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate unread count based on last read message
    const lastReadReceipt = await prisma.readReceipt.findFirst({
      where: {
        userId,
        message: {
          conversationId: id,
        },
      },
      include: {
        message: {
          select: { createdAt: true },
        },
      },
      orderBy: {
        message: {
          createdAt: 'desc',
        },
      },
    });

    let unreadCount = 0;
    if (!lastReadReceipt) {
      // No read receipt, count all messages from others as unread
      unreadCount = await prisma.message.count({
        where: {
          conversationId: id,
          senderId: { not: userId },
        },
      });
    } else {
      // Count messages created after the last read message from other users
      unreadCount = await prisma.message.count({
        where: {
          conversationId: id,
          createdAt: { gt: lastReadReceipt.message.createdAt },
          senderId: { not: userId },
        },
      });
    }

    // Transform the response to have friendly field names
    const { _count, ...rest } = conversation;
    const formattedConversation = {
      ...rest,
      count: _count.messages,
      unreadCount,
      lastMessage: lastMessage ? {
        body: encryptionService.decryptMessage({
          body: lastMessage.body,
          encrypted: lastMessage.encrypted,
          keyVersion: lastMessage.keyVersion,
          iv: lastMessage.iv,
          authTag: lastMessage.authTag,
        }),
        createdAt: lastMessage.createdAt.toISOString(),
      } : undefined,
    };

    res.json({ success: true, data: formattedConversation } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message },
    } as ApiResponse);
  }
});

export default router;

