const express = require('express');

const router = express.Router();
const rooms = new Map();

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

function generateUniqueRoomCode() {
  let attempts = 0;
  let roomCode = generateRoomCode();

  while (rooms.has(roomCode) && attempts < 20) {
    attempts += 1;
    roomCode = generateRoomCode();
  }

  if (rooms.has(roomCode)) {
    const error = new Error('Failed to generate unique room code');
    error.status = 500;
    throw error;
  }

  return roomCode;
}

router.post('/', (req, res, next) => {
  try {
    const { roomName, password, maxPlayers, mapId, channel } = req.body || {};
    const roomCode = generateUniqueRoomCode();

    const room = {
      roomCode,
      roomName: roomName || '포켓몬 숨바꼭질',
      password: password || null,
      maxPlayers: Number(maxPlayers || 8),
      currentPlayers: 1,
      mapId: mapId || 'default',
      channel: channel || 'all',
      createdAt: new Date().toISOString(),
    };

    rooms.set(roomCode, room);

    const { password: _, ...safeRoom } = room;
    res.status(201).json(safeRoom);
  } catch (error) {
    next(error);
  }
});

router.get('/', (req, res) => {
  const list = Array.from(rooms.values()).map((room) => {
    const { password, ...safeRoom } = room;
    return safeRoom;
  });

  res.json(list);
});

router.post('/:roomCode/join', (req, res, next) => {
  try {
    const roomCode = String(req.params.roomCode || '').toUpperCase();
    const room = rooms.get(roomCode);

    if (!room) {
      const error = new Error('Room not found');
      error.status = 404;
      throw error;
    }

    if (room.password && room.password !== (req.body && req.body.password)) {
      const error = new Error('Invalid room password');
      error.status = 403;
      throw error;
    }

    if (room.currentPlayers >= room.maxPlayers) {
      const error = new Error('Room is full');
      error.status = 409;
      throw error;
    }

    room.currentPlayers += 1;
    rooms.set(roomCode, room);

    const { password, ...safeRoom } = room;
    res.json(safeRoom);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
