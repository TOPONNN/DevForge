const express = require('express');

const { redis } = require('../redis');
const { isRabbitMQUp } = require('../rabbitmq');

const router = express.Router();

router.get('/', async (req, res) => {
  let redisStatus = 'up';
  let rabbitmqStatus = 'up';

  try {
    await redis.ping();
  } catch (error) {
    redisStatus = 'down';
  }

  if (!isRabbitMQUp()) {
    rabbitmqStatus = 'down';
  }

  const status = redisStatus === 'up' && rabbitmqStatus === 'up' ? 'ok' : 'degraded';

  res.json({
    status,
    service: 'pokemon-prophunt-backend',
    redis: redisStatus,
    rabbitmq: rabbitmqStatus,
  });
});

module.exports = router;
