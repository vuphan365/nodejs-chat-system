import { Router } from 'express';
import { prisma } from '@chat/database';
import { createConversationSchema, updateConversationSchema } from '@chat/shared';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
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
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ success: true, data: conversations } as ApiResponse);
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
      },
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: { message: 'Conversation not found' },
      } as ApiResponse);
    }

    res.json({ success: true, data: conversation } as ApiResponse);
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
          participants: true,
        },
      });

      if (existing && existing.participants.length === 2) {
        return res.json({ success: true, data: existing } as ApiResponse);
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

    res.json({ success: true, data: conversation } as ApiResponse);
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
      },
    });

    res.json({ success: true, data: conversation } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message },
    } as ApiResponse);
  }
});

export default router;

