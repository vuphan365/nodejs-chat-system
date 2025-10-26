import { Kafka, Consumer } from 'kafkajs';
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

let consumer: Consumer;

export async function connectKafkaConsumer(
  onMessage: (event: KafkaEvent) => Promise<void>
) {
  consumer = kafka.consumer({
    groupId: config.kafka.groupId,
  });

  await consumer.connect();
  logger.info('Kafka consumer connected');

  // Subscribe to topics
  await consumer.subscribe({
    topics: ['chat.message.created', 'chat.message.read', 'presence.user.changed'],
    fromBeginning: false,
  });

  // Process messages
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        if (!message.value) return;

        const event = JSON.parse(message.value.toString()) as KafkaEvent;
        await onMessage(event);
      } catch (error) {
        logger.error({ error, topic, partition }, 'Error processing Kafka message');
      }
    },
  });
}

export async function disconnectKafkaConsumer() {
  if (consumer) {
    await consumer.disconnect();
    logger.info('Kafka consumer disconnected');
  }
}

