const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: Number(process.env.REDIS_PORT || 6379),
});

async function cacheSession(sessionId, data) {
  await redis.set(`session:${sessionId}`, JSON.stringify(data), 'EX', 60 * 30);
}

async function getSession(sessionId) {
  const raw = await redis.get(`session:${sessionId}`);
  return raw ? JSON.parse(raw) : null;
}

async function cacheRoomState(roomId, state) {
  await redis.set(`room:${roomId}`, JSON.stringify(state), 'EX', 60 * 60 * 2);
}

async function updateLeaderboard(memberId, score) {
  await redis.zincrby('leaderboard', Number(score || 0), String(memberId));
}

async function getTopPlayers(count) {
  const limit = Number(count || 10);
  return redis.zrevrange('leaderboard', 0, Math.max(0, limit - 1), 'WITHSCORES');
}

module.exports = {
  redis,
  cacheSession,
  getSession,
  cacheRoomState,
  updateLeaderboard,
  getTopPlayers,
};
