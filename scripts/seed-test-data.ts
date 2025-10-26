import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding test data...');

  // Create test users
  const password = await bcrypt.hash('password123', 10);

  const user1 = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      username: 'alice',
      passwordHash: password,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      username: 'bob',
      passwordHash: password,
    },
  });

  console.log('✅ Created test users:', user1.username, user2.username);

  // Create a test conversation
  const conversation = await prisma.conversation.create({
    data: {
      type: 'direct',
      participants: {
        create: [
          { userId: user1.id, role: 'member' },
          { userId: user2.id, role: 'member' },
        ],
      },
    },
  });

  console.log('✅ Created test conversation:', conversation.id);

  // Create inbox entries
  await prisma.inbox.createMany({
    data: [
      {
        userId: user1.id,
        conversationId: conversation.id,
        unreadCount: 0,
      },
      {
        userId: user2.id,
        conversationId: conversation.id,
        unreadCount: 0,
      },
    ],
  });

  console.log('✅ Created inbox entries');

  // Create some test messages
  const message1 = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: user1.id,
      body: 'Hello Bob!',
      encrypted: false,
    },
  });

  const message2 = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: user2.id,
      body: 'Hi Alice! How are you?',
      encrypted: false,
    },
  });

  console.log('✅ Created test messages');

  console.log('\n📊 Test Data Summary:');
  console.log('Users:');
  console.log('  - alice@example.com / password123');
  console.log('  - bob@example.com / password123');
  console.log(`Conversation ID: ${conversation.id}`);
  console.log(`Messages: ${message1.id}, ${message2.id}`);
  console.log('\n✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

