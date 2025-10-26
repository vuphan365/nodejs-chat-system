# Web App User Guide

This guide explains how to use the Chat System web application.

## Getting Started

### 1. Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

### 2. Create an Account

1. Click the **Register** button on the home page
2. Fill in your details:
   - Email address
   - Username
   - Password (minimum 6 characters)
   - Confirm password
3. Click **Create Account**
4. You'll be automatically logged in and redirected to the chat interface

### 3. Login

If you already have an account:
1. Click the **Login** button
2. Enter your email and password
3. Click **Sign In**

**Test Credentials** (if you ran the seed script):
- Email: `alice@example.com` or `bob@example.com`
- Password: `password123`

## Using the Chat Interface

### Main Interface Layout

The chat interface consists of three main areas:

1. **Sidebar (Left)**: Conversation list and user profile
2. **Main Area (Center)**: Active chat window
3. **Connection Status**: Green dot = connected, Gray dot = disconnected

### Creating a New Conversation

#### Direct Chat (1-on-1)

1. Click the **+ New Conversation** button in the sidebar
2. Select **Direct Chat**
3. Choose one user from the list
4. Click **Create**

#### Group Chat

1. Click the **+ New Conversation** button
2. Select **Group Chat**
3. Enter a group name
4. Select multiple users from the list
5. Click **Create**

### Sending Messages

1. Select a conversation from the sidebar
2. Type your message in the input box at the bottom
3. Press **Enter** to send (or click the **Send** button)
4. Press **Shift+Enter** to add a new line without sending

### Real-time Features

#### Typing Indicators

When someone is typing in the conversation, you'll see:
- Animated dots
- "[Username] is typing..." message

#### Online Status

- **Green dot** next to your name = Connected to WebSocket
- **Gray dot** = Disconnected (messages will still be delivered when reconnected)

#### Unread Messages

- **Blue badge** with number shows unread message count
- Messages are automatically marked as read when you view them

### Message Display

#### Your Messages
- Appear on the **right side**
- **Blue background**
- Show timestamp

#### Other Users' Messages
- Appear on the **left side**
- **White background** with border
- Show sender's name (in group chats)
- Show timestamp

### Group Chat Features

In group chats, you'll see:
- **Sender names** above each message
- **Member count** in the conversation header
- **Purple avatar** icon (vs blue for direct chats)

## Features Overview

### ✅ Implemented Features

- **Real-time Messaging**: Instant message delivery via WebSocket
- **Direct Chats**: 1-on-1 conversations
- **Group Chats**: Multi-user conversations with custom names
- **Typing Indicators**: See when others are typing
- **Read Receipts**: Messages marked as read automatically
- **Unread Counts**: Badge showing unread messages per conversation
- **Message History**: Scroll through past messages
- **Auto-scroll**: Automatically scrolls to newest messages
- **Connection Status**: Visual indicator of WebSocket connection
- **Responsive Design**: Works on desktop and mobile devices

### 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Passwords are securely hashed with bcrypt
- **Protected Routes**: Automatic redirect to login if not authenticated
- **Secure WebSocket**: WebSocket connections require authentication
- **Rate Limiting**: API endpoints are rate-limited to prevent abuse

## Keyboard Shortcuts

- **Enter**: Send message
- **Shift+Enter**: New line in message
- **Escape**: Close modal (when open)

## Troubleshooting

### "Disconnected" Status

If you see a gray dot or "Disconnected" status:

1. **Check Backend Services**: Ensure the WebSocket gateway is running
   ```bash
   # In terminal, check if services are running
   pnpm dev
   ```

2. **Check Browser Console**: Open Developer Tools (F12) and check for errors

3. **Refresh the Page**: Sometimes a simple refresh reconnects the WebSocket

### Messages Not Sending

1. **Check Connection**: Ensure you're connected (green dot)
2. **Check Message Length**: Very long messages may fail
3. **Check Browser Console**: Look for error messages
4. **Try Logging Out and Back In**: This refreshes your authentication token

### Conversations Not Loading

1. **Check API Service**: Ensure the API service is running on port 3001
2. **Check Browser Console**: Look for network errors
3. **Clear Browser Cache**: Sometimes cached data causes issues
4. **Check Database**: Ensure PostgreSQL is running

### Can't Create New Conversation

1. **Check User List**: Ensure other users exist in the database
2. **Run Seed Script**: Create test users if needed
   ```bash
   tsx scripts/seed-test-data.ts
   ```

## Technical Details

### Authentication Flow

1. User enters credentials on login/register page
2. API validates credentials and returns JWT token
3. Token is stored in localStorage
4. Token is sent with every API request and WebSocket connection
5. Token expires after 24 hours (configurable)

### Message Flow

1. User types message and clicks Send
2. Message sent via HTTP POST to `/api/messages`
3. API saves message to database
4. API publishes event to Kafka
5. WebSocket gateway receives event from Kafka
6. WebSocket broadcasts message to all users in conversation
7. UI updates in real-time for all connected users

### WebSocket Events

The app listens for these WebSocket events:

- `message:new` - New message in conversation
- `typing` - User typing indicator
- `read:receipt` - Message read confirmation
- `presence` - User online/offline status

## API Endpoints Used

The web app communicates with these API endpoints:

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login to existing account

### Users
- `GET /api/users` - Get all users (for creating conversations)

### Conversations
- `GET /api/conversations` - Get user's conversations
- `POST /api/conversations` - Create new conversation
- `GET /api/conversations/:id` - Get conversation details

### Messages
- `GET /api/messages?conversationId=...` - Get messages
- `POST /api/messages` - Send new message
- `POST /api/messages/read` - Mark messages as read

## Browser Compatibility

The app works best on modern browsers:

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Performance Tips

### For Best Performance

1. **Keep Conversations Reasonable**: Very large group chats may be slower
2. **Close Unused Tabs**: Multiple tabs with the app open may cause issues
3. **Use Modern Browser**: Older browsers may have performance issues
4. **Stable Internet**: WebSocket requires stable connection

### Message Limits

- **Message Length**: Up to 10,000 characters
- **Messages per Conversation**: Unlimited (pagination loads 50 at a time)
- **Conversations per User**: Unlimited

## Privacy & Data

### What's Stored

- **User Profile**: Email, username, hashed password
- **Messages**: All messages are stored in the database
- **Read Receipts**: When you read messages
- **Conversation Membership**: Which conversations you're part of

### What's NOT Stored

- **Typing Indicators**: Only sent in real-time, not stored
- **Online Status**: Tracked in Redis with 30s TTL, not permanently stored
- **Plain Passwords**: Only hashed passwords are stored

### Optional Encryption

If encryption is enabled (via `CHAT_ENCRYPTION_ENABLED=true`):
- Messages are encrypted at rest in the database
- Messages are decrypted when displayed to you
- This is application-level encryption, not end-to-end

## Next Steps

### Planned Features

- 📎 File attachments
- 🔍 Message search
- 📌 Pin important messages
- 🔕 Mute conversations
- 👤 User profiles with avatars
- 🎨 Theme customization
- 📱 Mobile app
- 🔔 Browser push notifications

## Support

If you encounter issues:

1. Check the browser console for errors (F12)
2. Check the backend logs in your terminal
3. Verify all services are running (`pnpm dev`)
4. Check the documentation in `README.md` and `GETTING_STARTED.md`

## Development

To modify the web app:

```bash
# Navigate to web app directory
cd apps/web

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

The web app is built with:
- **Next.js 15** - React framework
- **React 18** - UI library
- **Tailwind CSS** - Styling
- **Socket.IO Client** - WebSocket connection
- **Axios** - HTTP requests
- **date-fns** - Date formatting

