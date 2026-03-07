const express = require('express');
const { v4: uuidv4 } = require('uuid');

const { pool } = require('../database');
const { cacheSession, cacheRoomState, updateLeaderboard } = require('../redis');
const { publishGameResult, publishGameEvent } = require('../rabbitmq');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const payload = req.body || {};
    const sessionId = uuidv4();

    await cacheSession(sessionId, payload);
    await cacheRoomState(payload.roomCode || 'unknown', {
      sessionId,
      roomCode: payload.roomCode,
      mapId: payload.mapId,
      updatedAt: Date.now(),
    });

    if (Array.isArray(payload.logs)) {
      await Promise.all(
        payload.logs
          .filter((log) => log && log.memberId != null)
          .map((log) => updateLeaderboard(log.memberId, log.caught ? 3 : 1))
      );
    }

    await publishGameEvent({ type: 'game.submitted', sessionId, roomCode: payload.roomCode, at: Date.now() });
    await publishGameResult({ ...payload, sessionId });

    res.status(202).json({ status: 'queued', sessionId });
  } catch (error) {
    next(error);
  }
});

router.get('/recent', async (req, res, next) => {
  try {
    const parsedLimit = Number.parseInt(String(req.query.limit || '10'), 10);
    const limit = Number.isNaN(parsedLimit) ? 10 : Math.min(Math.max(parsedLimit, 1), 100);

    const [rows] = await pool.query(
      `
      SELECT id, room_code, map_id, player_count, trainer_win, duration, created_at
      FROM game_sessions
      ORDER BY created_at DESC
      LIMIT ?
      `,
      [limit]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
