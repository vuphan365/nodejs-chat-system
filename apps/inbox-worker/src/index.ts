import { Kafka, Consumer } from 'kafkajs';
import { prisma } from '@chat/database';
import pino from 'pino';
import dotenv from 'dotenv';
import path from 'path';
import type { KafkaEvent } from '@chat/shared';

// Load .env from the monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const config = {
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:19092').split(','),
    clientId: 'chat-inbox-worker',
    groupId: 'inbox-worker-group',
  },
};

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
  retry: {
    retries: 5,
    initialRetryTime: 100,
  },
});

let consumer: Consumer;

async function handleEvent(event: KafkaEvent) {
  try {
    switch (event.type) {
      case 'message.created': {
        // Inbox updates are already handled in the API service
        // This worker can be used for additional processing like:
        // - Sending push notifications
        // - Updating analytics
        // - Triggering webhooks
        logger.debug({ messageId: event.data.id }, 'Message created event received');
        break;
      }

      case 'message.read': {
        // Additional processing for read receipts
        logger.debug({ messageId: event.data.messageId }, 'Message read event received');
        break;
      }

      case 'conversation.updated': {
        logger.debug({ conversationId: event.data.id }, 'Conversation updated event received');
        break;
      }

      case 'presence.user.changed': {
        logger.debug({ userId: event.data.userId, status: event.data.status }, 'User presence changed');
        break;
      }

      default:
        logger.warn({ event }, 'Unknown event type');
    }
  } catch (error) {
    logger.error({ error, event }, 'Error handling event');
    throw error; // Let Kafka retry
  }
}

async function start() {
  try {
    consumer = kafka.consumer({
      groupId: config.kafka.groupId,
    });

    await consumer.connect();
    logger.info('Kafka consumer connected');

    // Subscribe to topics
    await consumer.subscribe({
      topics: [
        'chat.message.created',
        'chat.message.read',
        'chat.conversation.updated',
        'presence.user.changed',
      ],
      fromBeginning: false,
    });

    // Process messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          if (!message.value) return;

          const event = JSON.parse(message.value.toString()) as KafkaEvent;
          await handleEvent(event);
        } catch (error) {
          logger.error({ error, topic, partition }, 'Error processing message');
        }
      },
    });

    logger.info('Inbox worker started');
  } catch (error) {
    logger.error({ error }, 'Failed to start inbox worker');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (consumer) {
    await consumer.disconnect();
  }
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (consumer) {
    await consumer.disconnect();
  }
  await prisma.$disconnect();
  process.exit(0);
});

start();

