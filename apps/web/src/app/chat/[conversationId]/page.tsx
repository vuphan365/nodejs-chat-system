'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ConversationList from '@/components/ConversationList';
import ChatWindow from '@/components/ChatWindow';
import NewConversationModal from '@/components/NewConversationModal';
import { api } from '@/lib/api';
import { useSocket } from '@/contexts/SocketContext';

interface Conversation {
  id: string;
  type: 'direct' | 'group';
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
  unreadCount: number;
}

export default function ConversationPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const conversationId = params.conversationId as string;
  const { socket, isConnected } = useSocket();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isNewConversationModalOpen, setIsNewConversationModalOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
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
        // The event structure is: { type: 'message:new', data: { id, conversationId, senderId, body, createdAt } }
        const messageData = event.data;

        // Update conversation list with new message
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id === messageData.conversationId) {
              // Only increment unread if not currently viewing this conversation
              const isCurrentConversation = conversationId === messageData.conversationId;
              return {
                ...conv,
                lastMessage: {
                  body: messageData.body,
                  createdAt: messageData.createdAt,
                },
                unreadCount: isCurrentConversation ? conv.unreadCount : conv.unreadCount + 1,
              };
            }
            return conv;
          })
        );
      };

      socket.on('message:new', handleNewMessage);

      return () => {
        socket.off('message:new', handleNewMessage);
      };
    }
  }, [socket, isConnected, conversationId]);

  // Load and select conversation based on URL
  useEffect(() => {
    if (conversations.length > 0 && conversationId) {
      const conversation = conversations.find((c) => c.id === conversationId);
      if (conversation) {
        setSelectedConversation(conversation);
      } else {
        // Conversation not found, redirect to chat page
        router.push('/chat');
      }
    }
  }, [conversations, conversationId, router]);

  const loadConversations = async () => {
    try {
      const response = await api.get('/api/conversations');
      setConversations(response.data.data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const handleConversationSelect = (conversation: Conversation) => {
    // Update URL when selecting a conversation
    router.push(`/chat/${conversation.id}`);
  };

  const handleNewConversation = () => {
    setIsNewConversationModalOpen(true);
  };

  const handleConversationCreated = async () => {
    await loadConversations();
    setIsNewConversationModalOpen(false);
  };

  const handleConversationUpdate = () => {
    // Reload conversations to update unread counts
    loadConversations();
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
          selectedConversation={selectedConversation}
          onSelectConversation={handleConversationSelect}
          onNewConversation={handleNewConversation}
          isLoading={isLoadingConversations}
          currentUserId={user.id}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <ChatWindow
            conversation={selectedConversation}
            currentUserId={user.id}
            onConversationUpdate={handleConversationUpdate}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">
                Loading conversation...
              </h2>
              <p className="text-gray-500">
                Please wait while we load your conversation
              </p>
            </div>
          </div>
        )}
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

