const { WebSocketServer } = require('ws');

const PORT = 3001;
const MAX_PLAYERS = 8;
const PREP_TIME = 15;
const HUNT_TIME = 180;
const BASE_RATE = 0.75;
const MAX_RANGE = 80;
const MAP_HALF_EXTENT = 80;
const SPAWN_EDGE_BAND = 8;
const SPAWN_HEIGHT = 1.1;

const speciesStats = {
  Pikachu: { speed: 6, catchDifficulty: 0.4, size: 'small', color: '#FFD60A', modelScale: 0.9 },
  Charmander: { speed: 5, catchDifficulty: 0.5, size: 'small', color: '#F77F00', modelScale: 0.95 },
  Bulbasaur: { speed: 4.5, catchDifficulty: 0.5, size: 'medium', color: '#2A9D8F', modelScale: 1 },
  Squirtle: { speed: 4.5, catchDifficulty: 0.5, size: 'medium', color: '#5FA8D3', modelScale: 0.95 },
  Eevee: { speed: 7, catchDifficulty: 0.35, size: 'small', color: '#B08968', modelScale: 0.85 },
  Snorlax: { speed: 2.5, catchDifficulty: 0.7, size: 'large', color: '#4D908E', modelScale: 1.45 },
  Gengar: { speed: 5.5, catchDifficulty: 0.3, size: 'medium', color: '#4361EE', modelScale: 1.05 },
  Jigglypuff: { speed: 4, catchDifficulty: 0.6, size: 'small', color: '#F6BDC0', modelScale: 0.85 },
};

const rooms = new Map();
const clients = new Map();

const wss = new WebSocketServer({ port: PORT });

function randomRoomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function ensureRoom(roomCode, hostId) {
  if (rooms.has(roomCode)) {
    return rooms.get(roomCode);
  }
  const room = {
    roomCode,
    hostId,
    phase: 'lobby',
    timer: 0,
    players: new Map(),
    ready: new Map(),
  };
  rooms.set(roomCode, room);
  return room;
}

function generateUniqueRoomCode() {
  let code = randomRoomCode();
  while (rooms.has(code)) {
    code = randomRoomCode();
  }
  return code;
}

function toPlayerPayload(player, room) {
  return {
    id: player.id,
    name: player.name,
    role: player.role,
    position: player.position,
    rotation: player.rotation,
    species: player.species,
    isAlive: player.isAlive,
    isCaught: player.isCaught,
    score: player.score,
    ready: room ? !!room.ready.get(player.id) : false,
  };
}

function send(ws, type, data) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

function broadcast(room, type, data) {
  for (const player of room.players.values()) {
    const ws = clients.get(player.id);
    if (ws) {
      send(ws, type, data);
    }
  }
}

function emitRoomState(room) {
  broadcast(room, 'room_state', {
    roomCode: room.roomCode,
    hostId: room.hostId,
    phase: room.phase,
    players: [...room.players.values()].map((p) => toPlayerPayload(p, room)),
    timer: room.timer,
  });
}

function assignRoles(room) {
  const players = [...room.players.values()];
  if (players.length === 0) {
    return;
  }
  players.forEach((player, index) => {
    player.role = index === 0 ? 'trainer' : 'pokemon';
  });
}

function allPokemonCaught(room) {
  const pokemon = [...room.players.values()].filter((player) => player.role === 'pokemon');
  return pokemon.length > 0 && pokemon.every((player) => player.isCaught);
}

function setPhase(room, phase, timer) {
  room.phase = phase;
  room.timer = timer;
  broadcast(room, 'phase_change', { phase, timer });
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomEdgeSpawn() {
  const side = Math.floor(Math.random() * 4);
  const edge = MAP_HALF_EXTENT - SPAWN_EDGE_BAND;
  const randomLane = randomBetween(-MAP_HALF_EXTENT * 0.85, MAP_HALF_EXTENT * 0.85);

  if (side === 0) {
    return [edge, SPAWN_HEIGHT, randomLane];
  }
  if (side === 1) {
    return [-edge, SPAWN_HEIGHT, randomLane];
  }
  if (side === 2) {
    return [randomLane, SPAWN_HEIGHT, edge];
  }
  return [randomLane, SPAWN_HEIGHT, -edge];
}

function getSpawnPosition(role) {
  if (role === 'trainer') {
    return [0, SPAWN_HEIGHT, 0];
  }
  return randomEdgeSpawn();
}

function startRound(room) {
  if (room.players.size < 2) {
    return;
  }
  assignRoles(room);
  for (const player of room.players.values()) {
    player.isCaught = false;
    player.isAlive = true;
    player.position = getSpawnPosition(player.role);
    player.rotation = [0, Math.random() * Math.PI * 2, 0];
    if (player.role === 'pokemon' && !player.species) {
      player.species = { name: 'Pikachu', ...speciesStats.Pikachu };
    }
  }
  setPhase(room, 'preparing', PREP_TIME);
  emitRoomState(room);
}

function distance(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function calculateCatchChance(throwData, target) {
  const d = distance(throwData.origin, target.position);
  const distanceFactor = Math.max(0, 1 - d / MAX_RANGE);
  const difficultyFactor = Math.max(0.1, 1 - (target.species?.catchDifficulty ?? 0.5));
  const chance = BASE_RATE * distanceFactor * difficultyFactor;
  return Math.max(0.05, Math.min(0.9, chance));
}

function handleCatchAttempt(room, trainerId, throwData) {
  const trainer = room.players.get(trainerId);
  if (!trainer || trainer.role !== 'trainer' || room.phase !== 'hunting') {
    return;
  }

  let target = null;
  if (throwData.pokemonTarget) {
    target = room.players.get(throwData.pokemonTarget) || null;
  }
  if (!target) {
    const candidates = [...room.players.values()].filter((player) => player.role === 'pokemon' && !player.isCaught);
    candidates.sort((a, b) => distance(throwData.origin, a.position) - distance(throwData.origin, b.position));
    target = candidates[0] || null;
  }

  if (!target || target.role !== 'pokemon' || target.isCaught) {
    return;
  }

  const chance = calculateCatchChance(throwData, target);
  const success = Math.random() < chance;
  const shakeCount = 1 + Math.floor(Math.random() * 3);
  if (success) {
    target.isCaught = true;
    target.isAlive = false;
    trainer.score += 1;
  }

  broadcast(room, 'catch_result', {
    result: success ? 'caught' : 'escaped',
    pokemonId: target.id,
    pokemonName: target.species?.name || target.name,
    shakeCount,
  });

  if (allPokemonCaught(room)) {
    setPhase(room, 'ended', 0);
  }
  emitRoomState(room);
}

function handleJoin(ws, data) {
  const clientId = ws.clientId;
  const requestedCode = String(data.roomCode || '').trim();
  const roomCode = requestedCode.length === 4 ? requestedCode : generateUniqueRoomCode();
  let room = rooms.get(roomCode);

  if (!room) {
    room = ensureRoom(roomCode, clientId);
  }

  if (room.players.size >= MAX_PLAYERS) {
    send(ws, 'error', { message: 'Room is full.' });
    return;
  }

  const role = room.players.size === 0 ? 'trainer' : 'pokemon';
  const player = {
    id: clientId,
    name: String(data.playerName || 'Trainer').slice(0, 20),
    role,
    position: getSpawnPosition(role),
    rotation: [0, 0, 0],
    species: role === 'pokemon' ? { name: 'Pikachu', ...speciesStats.Pikachu } : undefined,
    isAlive: true,
    isCaught: false,
    score: 0,
  };

  room.players.set(clientId, player);
  room.ready.set(clientId, false);
  ws.roomCode = roomCode;

  send(ws, 'joined', { playerId: clientId, roomCode, isHost: room.hostId === clientId });
  broadcast(room, 'player_joined', toPlayerPayload(player));
  emitRoomState(room);
}

function handleReady(ws, data) {
  const room = rooms.get(ws.roomCode);
  if (!room) {
    return;
  }
  room.ready.set(ws.clientId, !!data.ready);
  emitRoomState(room);
}

function handleSpeciesSelect(ws, data) {
  const room = rooms.get(ws.roomCode);
  if (!room) {
    return;
  }
  const player = room.players.get(ws.clientId);
  if (!player || player.role !== 'pokemon') {
    return;
  }
  const speciesName = String(data.speciesName || 'Pikachu');
  const stats = speciesStats[speciesName] || speciesStats.Pikachu;
  player.species = { name: speciesName, ...stats };
  emitRoomState(room);
}

function handlePosition(ws, data) {
  const room = rooms.get(ws.roomCode);
  if (!room) {
    return;
  }
  const player = room.players.get(ws.clientId);
  if (!player) {
    return;
  }
  player.position = data.position;
  player.rotation = data.rotation;
}

function handleStartGame(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room || room.hostId !== ws.clientId) {
    return;
  }
  if (room.players.size < 2) {
    send(ws, 'error', { message: 'Need at least 2 players.' });
    return;
  }
  const nonHostReady = [...room.ready.entries()].filter(([id]) => id !== ws.clientId);
  const allOthersReady = nonHostReady.length === 0 || nonHostReady.every(([, r]) => r);
  if (!allOthersReady) {
    send(ws, 'error', { message: 'All players must be ready.' });
    return;
  }
  startRound(room);
}

function handleChat(ws, data) {
  const room = rooms.get(ws.roomCode);
  if (!room) {
    return;
  }
  const player = room.players.get(ws.clientId);
  if (!player) {
    return;
  }
  const message = {
    playerId: player.id,
    playerName: player.name,
    text: String(data.text || '').slice(0, 140),
    timestamp: Date.now(),
  };
  if (!message.text.trim()) {
    return;
  }
  broadcast(room, 'chat', message);
}

function leaveRoom(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) {
    return;
  }

  room.players.delete(ws.clientId);
  room.ready.delete(ws.clientId);

  if (room.players.size === 0) {
    rooms.delete(room.roomCode);
    return;
  }

  if (room.hostId === ws.clientId) {
    room.hostId = [...room.players.keys()][0];
  }

  assignRoles(room);
  broadcast(room, 'player_left', { playerId: ws.clientId });
  emitRoomState(room);
}

wss.on('connection', (ws) => {
  ws.clientId = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  ws.roomCode = '';
  ws.isAlive = true;
  clients.set(ws.clientId, ws);

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }

    const data = message.data || {};
    switch (message.type) {
      case 'join':
        handleJoin(ws, data);
        break;
      case 'leave':
        leaveRoom(ws);
        break;
      case 'ready':
        handleReady(ws, data);
        break;
      case 'position':
        handlePosition(ws, data);
        break;
      case 'throw': {
        const room = rooms.get(ws.roomCode);
        if (room) {
          broadcast(room, 'throw', { playerId: ws.clientId, throwData: data.throwData });
        }
        break;
      }
      case 'catch_attempt': {
        const room = rooms.get(ws.roomCode);
        if (room) {
          handleCatchAttempt(room, ws.clientId, data.throwData);
        }
        break;
      }
      case 'species_select':
        handleSpeciesSelect(ws, data);
        break;
      case 'start_game':
        handleStartGame(ws);
        break;
      case 'chat':
        handleChat(ws, data);
        break;
      default:
        break;
    }
  });

  ws.on('close', () => {
    leaveRoom(ws);
    clients.delete(ws.clientId);
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.phase !== 'preparing' && room.phase !== 'hunting') {
      continue;
    }
    for (const player of room.players.values()) {
      for (const recipient of room.players.values()) {
        if (recipient.id === player.id) {
          continue;
        }
        const ws = clients.get(recipient.id);
        if (ws) {
          send(ws, 'position', {
            playerId: player.id,
            position: player.position,
            rotation: player.rotation,
          });
        }
      }
    }
  }
}, 50);

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.phase !== 'preparing' && room.phase !== 'hunting') {
      continue;
    }
    room.timer = Math.max(0, room.timer - 1);
    if (room.phase === 'preparing' && room.timer === 0) {
      setPhase(room, 'hunting', HUNT_TIME);
      emitRoomState(room);
      continue;
    }
    if (room.phase === 'hunting' && room.timer === 0) {
      setPhase(room, 'ended', 0);
      emitRoomState(room);
      continue;
    }
    broadcast(room, 'phase_change', { phase: room.phase, timer: room.timer });
  }
}, 1000);

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

console.log(`Pokemon Prop Hunt WS server running on :${PORT}`);
