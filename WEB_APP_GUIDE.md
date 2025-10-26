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
