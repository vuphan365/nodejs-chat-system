'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface User {
  id: string;
  username: string;
  email: string;
}

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: () => void;
  currentUserId: string;
}

export default function NewConversationModal({
  isOpen,
  onClose,
  onConversationCreated,
  currentUserId,
}: NewConversationModalProps) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [conversationType, setConversationType] = useState<'direct' | 'group'>('direct');
  const [groupName, setGroupName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    try {
      // Note: You'll need to implement a /api/users endpoint in the API service
      const response = await api.get('/api/users');
      setUsers(response.data.data.filter((u: User) => u.id !== currentUserId));
    } catch (error) {
      console.error('Failed to load users:', error);
      setError('Failed to load users. Please try again.');
    }
  };

  const handleCreateConversation = async () => {
    if (selectedUsers.length === 0) {
      setError('Please select at least one user');
      return;
    }

    if (conversationType === 'group' && !groupName.trim()) {
      setError('Please enter a group name');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/api/conversations', {
        type: conversationType,
        participantIds: selectedUsers,
        name: conversationType === 'group' ? groupName : undefined,
      });

      const newConversationId = response.data.data.id;

      onConversationCreated();
      handleClose();

      // Navigate to the new conversation
      router.push(`/chat/${newConversationId}`);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to create conversation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setGroupName('');
    setConversationType('direct');
    setError('');
    onClose();
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">New Conversation</h2>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Conversation Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conversation Type
            </label>
            <div className="flex space-x-4">
              <button
                onClick={() => setConversationType('direct')}
                className={`flex-1 py-2 px-4 rounded-lg border-2 transition ${
                  conversationType === 'direct'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                Direct Chat
              </button>
              <button
                onClick={() => setConversationType('group')}
                className={`flex-1 py-2 px-4 rounded-lg border-2 transition ${
                  conversationType === 'group'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                Group Chat
              </button>
            </div>
          </div>

          {/* Group Name */}
          {conversationType === 'group' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          )}

          {/* User Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Users {conversationType === 'direct' && '(1 user)'}
            </label>
            <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
              {users.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No users available
                </div>
              ) : (
                users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      if (conversationType === 'direct') {
                        setSelectedUsers([user.id]);
                      } else {
                        toggleUserSelection(user.id);
                      }
                    }}
                    className={`w-full p-3 text-left hover:bg-gray-50 transition border-b border-gray-100 last:border-b-0 ${
                      selectedUsers.includes(user.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{user.username}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      {selectedUsers.includes(user.id) && (
                        <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path d="M5 13l4 4L19 7"></path>
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex space-x-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateConversation}
            disabled={isLoading || selectedUsers.length === 0}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

