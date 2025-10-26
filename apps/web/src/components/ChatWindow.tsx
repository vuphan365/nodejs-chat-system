"use client";

import { useEffect, useState, useRef } from "react";
import { useSocket } from "@/contexts/SocketContext";
import { api } from "@/lib/api";
import { format } from "date-fns";
import MessageInput from "./MessageInput";
import TypingIndicator from "./TypingIndicator";

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  sender: {
    id: string;
    username: string;
  };
}

interface Conversation {
  id: string;
  type: "direct" | "group";
  name?: string;
  participants: Array<{
    user: {
      id: string;
      username: string;
      email: string;
    };
  }>;
}

interface ChatWindowProps {
  conversation: Conversation;
  currentUserId: string;
  onConversationUpdate: () => void;
}

export default function ChatWindow({
  conversation,
  currentUserId,
  onConversationUpdate,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const { socket, isConnected } = useSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  useEffect(() => {
    loadMessages();

    if (socket && isConnected) {
      // Join conversation room
      socket.emit("join", { conversationId: conversation.id });

      // Listen for new messages
      socket.on("message:new", handleNewMessage);

      // Listen for typing indicators
      socket.on("typing", handleTyping);

      return () => {
        socket.emit("leave", { conversationId: conversation.id });
        socket.off("message:new", handleNewMessage);
        socket.off("typing", handleTyping);
      };
    }
  }, [conversation.id, socket, isConnected]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/api/messages", {
        params: {
          conversationId: conversation.id,
          limit: 50,
        },
      });
      const result = [...(response?.data?.data?.data || [])].reverse();
      setMessages(result);

      // Mark messages as read
      if (response?.data?.data.data?.length > 0) {
        const lastMessage = response.data.data.data[0];
        await api.post("/api/messages/read", {
          conversationId: conversation.id,
          messageId: lastMessage.id,
        });
        onConversationUpdate();
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewMessage = (event: any) => {
    if (event.data.conversationId === conversation.id) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === event.data.id)) {
          return prev;
        }
        return [...prev, event.data];
      });

      // Mark as read if not sent by current user
      if (event.data.senderId !== currentUserId) {
        api.post("/api/messages/read", {
          conversationId: conversation.id,
          messageId: event.data.id,
        });
        onConversationUpdate();
      }
    }
  };

  const handleTyping = (event: any) => {
    if (
      event.data.conversationId === conversation.id &&
      event.data.userId !== currentUserId
    ) {
      const userId = event.data.userId;

      if (event.data.isTyping) {
        setTypingUsers((prev) => new Set(prev).add(userId));

        // Clear existing timeout
        if (typingTimeoutRef.current[userId]) {
          clearTimeout(typingTimeoutRef.current[userId]);
        }

        // Set new timeout to remove typing indicator
        typingTimeoutRef.current[userId] = setTimeout(() => {
          setTypingUsers((prev) => {
            const newSet = new Set(prev);
            newSet.delete(userId);
            return newSet;
          });
        }, 3000);
      } else {
        setTypingUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });

        if (typingTimeoutRef.current[userId]) {
          clearTimeout(typingTimeoutRef.current[userId]);
        }
      }
    }
  };

  const handleSendMessage = async (body: string) => {
    try {
      const response = await api.post("/api/messages", {
        conversationId: conversation.id,
        body,
      });

      // Message will be added via WebSocket event
      onConversationUpdate();
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message. Please try again.");
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getConversationName = () => {
    if (conversation.type === "group") {
      return conversation.name || "Group Chat";
    }

    const otherUser = conversation.participants.find(
      (p) => p.user.id !== currentUserId
    );
    return otherUser?.user.username || "Unknown User";
  };

  const getTypingUsernames = () => {
    return conversation.participants
      .filter((p) => typingUsers.has(p.user.id))
      .map((p) => p.user.username);
  };

  const getSenderUsernames = (senderId: string) => {
    return conversation.participants
      .filter((p) => p.user.id === senderId)
      .map((p) => p.user.username);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {getConversationName()}
            </h2>
            <p className="text-sm text-gray-500">
              {conversation.type === "group"
                ? `${conversation.participants.length} members`
                : isConnected
                ? "Online"
                : "Offline"}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? "bg-green-500" : "bg-gray-400"
              }`}
              title={isConnected ? "Connected" : "Disconnected"}
            />
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading messages...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <div className="text-5xl mb-4">💬</div>
              <p className="text-lg">No messages yet</p>
              <p className="text-sm mt-2">
                Send a message to start the conversation
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => {
              const isOwnMessage = message.senderId === currentUserId;
              const showSender =
              conversation.type === "group" &&
              !isOwnMessage &&
              (index === 0 ||
                messages[index - 1].senderId !== message.senderId);

              return (
                <div
                  key={message.id}
                  className={`flex ${
                    isOwnMessage ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md ${
                      isOwnMessage ? "order-2" : "order-1"
                    }`}
                  >
                    {showSender && (
                      <p className="text-xs text-gray-600 mb-1 px-3">
                        {message?.sender?.username || getSenderUsernames(message.senderId)}
                      </p>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2 ${
                        isOwnMessage
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-900 border border-gray-200"
                      }`}
                    >
                      <p className="break-words">{message.body}</p>
                      <p
                        className={`text-xs mt-1 ${
                          isOwnMessage ? "text-blue-100" : "text-gray-500"
                        }`}
                      >
                        {format(new Date(message.createdAt), "HH:mm")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        {typingUsers.size > 0 && (
          <TypingIndicator usernames={getTypingUsernames()} />
        )}
      </div>

      {/* Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        conversationId={conversation.id}
        disabled={!isConnected}
      />
    </div>
  );
}
