// Kafka event types
export interface MessageCreatedEvent {
  type: 'message.created';
  data: {
    id: string;
    conversationId: string;
    senderId: string;
    body: string;
    encrypted: boolean;
    keyVersion?: number;
    createdAt: string;
  };
}

export interface MessageReadEvent {
  type: 'message.read';
  data: {
    messageId: string;
    conversationId: string;
    userId: string;
    readAt: string;
  };
}

export interface ConversationUpdatedEvent {
  type: 'conversation.updated';
  data: {
    id: string;
    type: string;
    name?: string;
    updatedAt: string;
  };
}

export interface UserPresenceChangedEvent {
  type: 'presence.user.changed';
  data: {
    userId: string;
    status: 'online' | 'offline';
    timestamp: string;
  };
}

export type KafkaEvent =
  | MessageCreatedEvent
  | MessageReadEvent
  | ConversationUpdatedEvent
  | UserPresenceChangedEvent;

// WebSocket event types
export interface WsMessageNewEvent {
  type: 'message:new';
  data: {
    id: string;
    conversationId: string;
    senderId: string;
    body: string;
    createdAt: string;
  };
}

export interface WsTypingEvent {
  type: 'typing';
  data: {
    conversationId: string;
    userId: string;
    username: string;
    isTyping: boolean;
  };
}

export interface WsReadReceiptEvent {
  type: 'read:receipt';
  data: {
    messageId: string;
    conversationId: string;
    userId: string;
    readAt: string;
  };
}

export interface WsPresenceEvent {
  type: 'presence';
  data: {
    userId: string;
    status: 'online' | 'offline';
  };
}

export interface WsErrorEvent {
  type: 'error';
  data: {
    message: string;
    code?: string;
  };
}

export type WsEvent =
  | WsMessageNewEvent
  | WsTypingEvent
  | WsReadReceiptEvent
  | WsPresenceEvent
  | WsErrorEvent;

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  cursor?: string;
  hasMore: boolean;
}

// Session types
export interface SessionUser {
  id: string;
  email: string;
  username: string;
}

