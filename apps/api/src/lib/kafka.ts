import { Kafka, Producer } from 'kafkajs';
import { config } from '../config';
import { logger } from './logger';
import type { KafkaEvent } from '@chat/shared';

const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
  retry: {
    retries: 5,
    initialRetryTime: 100,
  },
});

let producer: Producer;

export async function connectKafka() {
  producer = kafka.producer({
    allowAutoTopicCreation: true,
    transactionTimeout: 30000,
  });

  await producer.connect();
  logger.info('Kafka producer connected');
}

export async function disconnectKafka() {
  if (producer) {
    await producer.disconnect();
    logger.info('Kafka producer disconnected');
  }
}

export async function publishEvent(event: KafkaEvent) {
  if (!producer) {
    throw new Error('Kafka producer not initialized');
  }

  const topic = getTopicForEvent(event.type);
  
  await producer.send({
    topic,
    messages: [
      {
        key: getKeyForEvent(event),
        value: JSON.stringify(event),
        timestamp: Date.now().toString(),
      },
    ],
  });

  logger.debug({ event: event.type, topic }, 'Published Kafka event');
}

function getTopicForEvent(eventType: string): string {
  const topicMap: Record<string, string> = {
    'message.created': 'chat.message.created',
    'message.read': 'chat.message.read',
    'conversation.updated': 'chat.conversation.updated',
    'presence.user.changed': 'presence.user.changed',
  };

  return topicMap[eventType] || 'chat.events';
}

function getKeyForEvent(event: KafkaEvent): string {
  switch (event.type) {
    case 'message.created':
      return event.data.conversationId;
    case 'message.read':
      return event.data.conversationId;
    case 'conversation.updated':
      return event.data.id;
    case 'presence.user.changed':
      return event.data.userId;
    default:
      return '';
  }
}

