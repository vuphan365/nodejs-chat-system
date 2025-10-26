import { z } from 'zod';

// User schemas
export const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Conversation schemas
export const createConversationSchema = z.object({
  type: z.enum(['direct', 'group']),
  name: z.string().min(1).max(100).optional(),
  participantIds: z.array(z.string()).min(1),
});

export const updateConversationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

// Message schemas
export const sendMessageSchema = z.object({
  conversationId: z.string(),
  body: z.string().min(1).max(10000),
});

export const getMessagesSchema = z.object({
  conversationId: z.string(),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
});

// Participant schemas
export const addParticipantSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
  role: z.enum(['admin', 'member']).default('member'),
});

export const removeParticipantSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
});

// Read receipt schemas
export const markAsReadSchema = z.object({
  conversationId: z.string(),
  messageId: z.string(),
});

// WebSocket event schemas
export const wsJoinRoomSchema = z.object({
  conversationId: z.string(),
});

export const wsLeaveRoomSchema = z.object({
  conversationId: z.string(),
});

export const wsTypingSchema = z.object({
  conversationId: z.string(),
  isTyping: z.boolean(),
});

export const wsSendMessageSchema = z.object({
  conversationId: z.string(),
  body: z.string().min(1).max(10000),
  idempotencyKey: z.string(),
});

// Types
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type GetMessagesInput = z.infer<typeof getMessagesSchema>;
export type AddParticipantInput = z.infer<typeof addParticipantSchema>;
export type RemoveParticipantInput = z.infer<typeof removeParticipantSchema>;
export type MarkAsReadInput = z.infer<typeof markAsReadSchema>;
export type WsJoinRoomInput = z.infer<typeof wsJoinRoomSchema>;
export type WsLeaveRoomInput = z.infer<typeof wsLeaveRoomSchema>;
export type WsTypingInput = z.infer<typeof wsTypingSchema>;
export type WsSendMessageInput = z.infer<typeof wsSendMessageSchema>;

