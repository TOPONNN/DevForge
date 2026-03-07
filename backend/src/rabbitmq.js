const amqp = require('amqplib');

const { pool } = require('./database');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://pokemon:pokemon1234@rabbitmq:5672';
const EXCHANGE = 'pokemon.exchange';
const RESULTS_QUEUE = 'pokemon.game-results';
const EVENTS_QUEUE = 'pokemon.game-events';
const RESULT_ROUTING_KEY = 'pokemon.game-results';
const EVENT_ROUTING_KEY = 'pokemon.game-events';

let connection = null;
let channel = null;
let isConnecting = false;
let retryDelayMs = 1000;
let consumerStarted = false;

function roleWins(role, trainerWin) {
  const normalized = String(role || '').toLowerCase();
  const trainerRole = normalized === 'trainer' || normalized === 'hunter' || normalized === 'seeker';
  return trainerWin ? trainerRole : !trainerRole;
}

async function setupChannel() {
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(RESULTS_QUEUE, { durable: true });
  await channel.assertQueue(EVENTS_QUEUE, { durable: true });
  await channel.bindQueue(RESULTS_QUEUE, EXCHANGE, RESULT_ROUTING_KEY);
  await channel.bindQueue(EVENTS_QUEUE, EXCHANGE, EVENT_ROUTING_KEY);
}

async function connectRabbitMQ() {
  if (channel) {
    return channel;
  }

  if (isConnecting) {
    return null;
  }

  isConnecting = true;

  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await setupChannel();
    retryDelayMs = 1000;

    connection.on('error', (error) => {
      console.error('RabbitMQ connection error', error.message);
    });

    connection.on('close', () => {
      channel = null;
      connection = null;
      consumerStarted = false;
      scheduleReconnect();
    });

    return channel;
  } catch (error) {
    console.error('RabbitMQ connect failed', error.message);
    scheduleReconnect();
    return null;
  } finally {
    isConnecting = false;
  }
}

function scheduleReconnect() {
  const wait = retryDelayMs;
  retryDelayMs = Math.min(retryDelayMs * 2, 30000);

  setTimeout(() => {
    connectRabbitMQ()
      .then(() => {
        if (channel && !consumerStarted) {
          return startConsumer(pool);
        }
        return null;
      })
      .catch((error) => {
        console.error('RabbitMQ reconnect failed', error.message);
      });
  }, wait);
}

function ensureChannel() {
  if (!channel) {
    throw new Error('RabbitMQ channel unavailable');
  }

  return channel;
}

async function publishGameResult(data) {
  const activeChannel = ensureChannel();
  activeChannel.publish(EXCHANGE, RESULT_ROUTING_KEY, Buffer.from(JSON.stringify(data)), {
    persistent: true,
    contentType: 'application/json',
  });
}

async function publishGameEvent(event) {
  const activeChannel = ensureChannel();
  activeChannel.publish(EXCHANGE, EVENT_ROUTING_KEY, Buffer.from(JSON.stringify(event)), {
    persistent: true,
    contentType: 'application/json',
  });
}

async function consumeResultMessage(dbPool, payload) {
  const connectionHandle = await dbPool.getConnection();

  try {
    await connectionHandle.beginTransaction();

    const [sessionResult] = await connectionHandle.query(
      `
      INSERT INTO game_sessions (room_code, map_id, player_count, trainer_win, duration)
      VALUES (?, ?, ?, ?, ?)
      `,
      [payload.roomCode, payload.mapId, payload.playerCount, payload.trainerWin, payload.duration]
    );

    const gameSessionId = sessionResult.insertId;
    const logs = Array.isArray(payload.logs) ? payload.logs : [];

    for (const log of logs) {
      await connectionHandle.query(
        `
        INSERT INTO game_logs (game_session_id, member_id, player_name, role, species, caught)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          gameSessionId,
          log.memberId || null,
          log.playerName || 'Unknown',
          log.role || 'pokemon',
          log.species || null,
          Boolean(log.caught),
        ]
      );

      if (log.memberId) {
        await connectionHandle.query(
          `
          UPDATE members
          SET
            total_games = total_games + 1,
            total_wins = total_wins + ?,
            total_catches = total_catches + ?
          WHERE id = ?
          `,
          [roleWins(log.role, Boolean(payload.trainerWin)) ? 1 : 0, log.caught ? 1 : 0, log.memberId]
        );
      }
    }

    await connectionHandle.commit();
  } catch (error) {
    await connectionHandle.rollback();
    throw error;
  } finally {
    connectionHandle.release();
  }
}

async function startConsumer(dbPool = pool) {
  const activeChannel = channel || (await connectRabbitMQ());
  if (!activeChannel || consumerStarted) {
    return;
  }

  await activeChannel.consume(
    RESULTS_QUEUE,
    async (message) => {
      if (!message) {
        return;
      }

      try {
        const payload = JSON.parse(message.content.toString());
        await consumeResultMessage(dbPool, payload);
        activeChannel.ack(message);
      } catch (error) {
        console.error('Failed processing game result message', error.message);
        activeChannel.nack(message, false, false);
      }
    },
    { noAck: false }
  );

  consumerStarted = true;
}

function isRabbitMQUp() {
  return Boolean(channel);
}

module.exports = {
  connectRabbitMQ,
  publishGameResult,
  publishGameEvent,
  startConsumer,
  isRabbitMQUp,
};
