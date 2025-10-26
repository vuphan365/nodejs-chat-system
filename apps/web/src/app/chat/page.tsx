"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ConversationList from "@/components/ConversationList";
import NewConversationModal from "@/components/NewConversationModal";
import { api } from "@/lib/api";
import { useSocket } from "@/contexts/SocketContext";

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
  lastMessage?: {
    body: string;
    createdAt: string;
  };
  _count?: {
    messages: number;
  };
  unreadCount: number;
}

export default function ChatPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isNewConversationModalOpen, setIsNewConversationModalOpen] =
    useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  // Listen for new messages to update unread counts globally
  // This works even when user hasn't joined the conversation room
  useEffect(() => {
    if (socket && isConnected) {
      const handleNewMessage = (event: any) => {
        console.log('New message in conversation list', event)
        // The event structure is: { type: 'message:new', data: { id, conversationId, senderId, body, createdAt } }
        const messageData = event.data;

        // Update conversation list with new message and increment unread count
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id === messageData.conversationId) {
              return {
                ...conv,
                lastMessage: {
                  body: messageData.body,
                  createdAt: messageData.createdAt,
                },
                unreadCount: (conv.unreadCount || 0) + 1,
              };
            }
            return conv;
          })
        );
      };

      socket.on("message:new", handleNewMessage);

      return () => {
        socket.off("message:new", handleNewMessage);
      };
    }
  }, [socket, isConnected]);

  const loadConversations = async () => {
    try {
      const response = await api.get("/api/conversations");
      setConversations(response.data.data);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const handleConversationSelect = (conversation: Conversation) => {
    // Navigate to the conversation URL
    router.push(`/chat/${conversation.id}`);
  };

  const handleNewConversation = () => {
    setIsNewConversationModalOpen(true);
  };

  const handleConversationCreated = async () => {
    await loadConversations();
    setIsNewConversationModalOpen(false);
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <ConversationList
          conversations={conversations}
          selectedConversation={null}
          onSelectConversation={handleConversationSelect}
          onNewConversation={handleNewConversation}
          isLoading={isLoadingConversations}
          currentUserId={user.id}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="text-6xl mb-4">💬</div>
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">
              Select a conversation
            </h2>
            <p className="text-gray-500">
              Choose a conversation from the list to start chatting
            </p>
          </div>
        </div>
      </div>

      {/* New Conversation Modal */}
      <NewConversationModal
        isOpen={isNewConversationModalOpen}
        onClose={() => setIsNewConversationModalOpen(false)}
        onConversationCreated={handleConversationCreated}
        currentUserId={user.id}
      />
    </div>
  );
}
