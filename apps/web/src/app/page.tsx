'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/chat');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center max-w-2xl px-6">
        <div className="text-6xl mb-6">💬</div>
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Chat System
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          High-performance real-time chat application with WebSocket support
        </p>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            <div className="flex items-start space-x-3">
              <span className="text-2xl">⚡</span>
              <div>
                <h3 className="font-semibold text-gray-900">Real-time Messaging</h3>
                <p className="text-sm text-gray-600">Instant message delivery via WebSocket</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-2xl">👥</span>
              <div>
                <h3 className="font-semibold text-gray-900">Group Chats</h3>
                <p className="text-sm text-gray-600">Create and manage group conversations</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-2xl">🔒</span>
              <div>
                <h3 className="font-semibold text-gray-900">Secure</h3>
                <p className="text-sm text-gray-600">Optional message encryption</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-2xl">📱</span>
              <div>
                <h3 className="font-semibold text-gray-900">Responsive</h3>
                <p className="text-sm text-gray-600">Works on all devices</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-x-4">
          <Link
            href="/login"
            className="inline-block px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-lg shadow-lg"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="inline-block px-8 py-4 bg-white text-gray-900 rounded-lg hover:bg-gray-50 transition font-semibold text-lg shadow-lg"
          >
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}

