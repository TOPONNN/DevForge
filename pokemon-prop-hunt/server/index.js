const { WebSocketServer } = require('ws');

const PORT = 3001;
const DEFAULT_MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 12;
const DEFAULT_ROOM_NAME = '포켓몬 숨바꼭질';
const DEFAULT_MAP_ID = 'nature';
const PREP_TIME = 15;
const HUNT_TIME = 180;
const BASE_RATE = 0.75;
const MAX_RANGE = 50;
const MAP_HALF_EXTENT = 50;
const SPAWN_EDGE_BAND = 5;
const SPAWN_HEIGHT = 0.5;

const speciesStats = {
  Bulbasaur: { speed: 4.5, catchDifficulty: 0.5, size: 'medium', color: '#2A9D8F', modelScale: 1.0 },
  Ivysaur: { speed: 4, catchDifficulty: 0.55, size: 'medium', color: '#1E8449', modelScale: 0.9 },
  Venusaur: { speed: 3, catchDifficulty: 0.7, size: 'large', color: '#196F3D', modelScale: 1.3 },
  Charmander: { speed: 5, catchDifficulty: 0.5, size: 'small', color: '#F77F00', modelScale: 0.95 },
  Charmeleon: { speed: 5.5, catchDifficulty: 0.45, size: 'medium', color: '#E74C3C', modelScale: 1.0 },
  Charizard: { speed: 6, catchDifficulty: 0.35, size: 'large', color: '#D35400', modelScale: 1.4 },
  Squirtle: { speed: 4.5, catchDifficulty: 0.5, size: 'small', color: '#5FA8D3', modelScale: 0.95 },
  Wartortle: { speed: 5, catchDifficulty: 0.45, size: 'medium', color: '#2E86C1', modelScale: 1.0 },
  Blastoise: { speed: 3.5, catchDifficulty: 0.65, size: 'large', color: '#1A5276', modelScale: 1.35 },
};

const rooms = new Map();
const clients = new Map();
const lobbyClients = new Map();

const wss = new WebSocketServer({ port: PORT });

function randomRoomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function sanitizeChannel(channel) {
  const parsed = Number(channel);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) {
    return 1;
  }
  return parsed;
}

function sanitizeMaxPlayers(maxPlayers) {
  const parsed = Number(maxPlayers);
  if (!Number.isInteger(parsed)) {
    return DEFAULT_MAX_PLAYERS;
  }
  return Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, parsed));
}

function sanitizeRoomName(roomName) {
  const name = String(roomName || '').trim();
  return name ? name.slice(0, 30) : DEFAULT_ROOM_NAME;
}

function sanitizePassword(password) {
  const value = String(password || '').trim();
  return value ? value.slice(0, 30) : null;
}

function sanitizeMapId(mapId) {
  const value = String(mapId || '').trim();
  return value ? value.slice(0, 30) : DEFAULT_MAP_ID;
}

function ensureRoom(roomCode, hostId, options = {}) {
  if (rooms.has(roomCode)) {
    return rooms.get(roomCode);
  }
  const room = {
    roomCode,
    roomName: sanitizeRoomName(options.roomName),
    password: sanitizePassword(options.password),
    maxPlayers: sanitizeMaxPlayers(options.maxPlayers),
    mapId: sanitizeMapId(options.mapId),
    channel: sanitizeChannel(options.channel),
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
    isBot: !!player.isBot,
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

function broadcastRoomList(channel) {
  const roomList = [...rooms.values()]
    .filter((room) => room.channel === channel)
    .map((room) => ({
      roomCode: room.roomCode,
      roomName: room.roomName,
      channel: room.channel,
      status: room.phase === 'lobby' ? '대기중' : '게임중',
      current: room.players.size,
      max: room.maxPlayers,
      locked: !!room.password,
      mapId: room.mapId,
    }));

  for (const [clientId, ch] of lobbyClients.entries()) {
    if (ch !== channel) {
      continue;
    }
    const ws = clients.get(clientId);
    if (ws) {
      send(ws, 'room_list', { rooms: roomList });
    }
  }
}

function assignRoles(room) {
  const players = [...room.players.values()];
  if (players.length === 0) {
    return;
  }

  const trainers = players.filter((player) => player.role === 'trainer');
  const pokemons = players.filter((player) => player.role === 'pokemon');
  if (trainers.length > 0 && pokemons.length > 0) {
    return;
  }

  const humans = players.filter((player) => !player.isBot);
  const bots = players.filter((player) => player.isBot);
  if (humans.length > 0) {
    humans[0].role = 'trainer';
    humans.slice(1).forEach((player) => {
      player.role = 'pokemon';
    });
  }
  bots.forEach((player) => {
    player.role = 'pokemon';
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
  broadcastRoomList(room.channel);
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
  if (room.players.size < MIN_PLAYERS) {
    return;
  }
  assignRoles(room);
  for (const player of room.players.values()) {
    player.isCaught = false;
    player.isAlive = true;
    player.position = getSpawnPosition(player.role);
    player.rotation = [0, Math.random() * Math.PI * 2, 0];
    if (player.role === 'pokemon' && !player.species) {
      player.species = { name: 'Bulbasaur', ...speciesStats.Bulbasaur };
    }
  }
  setPhase(room, 'preparing', PREP_TIME);
  emitRoomState(room);
}

function randomPokemonName() {
  const names = Object.keys(speciesStats);
  return names[Math.floor(Math.random() * names.length)] || 'Bulbasaur';
}

function nextBotId(room) {
  let index = 1;
  while (room.players.has(`bot-${index}`)) {
    index += 1;
  }
  return `bot-${index}`;
}

function humanPlayers(room) {
  return [...room.players.values()].filter((player) => !player.isBot);
}

function addPlayerToRoom(ws, room, playerName) {
  if (room.players.size >= room.maxPlayers) {
    send(ws, 'error', { message: 'Room is full.' });
    return false;
  }

  const role = 'pokemon';
  const player = {
    id: ws.clientId,
    name: String(playerName || 'Trainer').slice(0, 20),
    role,
    position: getSpawnPosition(role),
    rotation: [0, 0, 0],
    species: role === 'pokemon' ? { name: 'Bulbasaur', ...speciesStats.Bulbasaur } : undefined,
    isAlive: true,
    isCaught: false,
    score: 0,
    isBot: false,
  };

  room.players.set(ws.clientId, player);
  room.ready.set(ws.clientId, false);
  ws.roomCode = room.roomCode;

  send(ws, 'joined', { playerId: ws.clientId, roomCode: room.roomCode, isHost: room.hostId === ws.clientId });
  broadcast(room, 'player_joined', toPlayerPayload(player));
  emitRoomState(room);
  broadcastRoomList(room.channel);
  return true;
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
    room = ensureRoom(roomCode, clientId, {
      roomName: DEFAULT_ROOM_NAME,
      password: null,
      maxPlayers: DEFAULT_MAX_PLAYERS,
      mapId: DEFAULT_MAP_ID,
      channel: 1,
    });
    broadcastRoomList(room.channel);
  }

  addPlayerToRoom(ws, room, data.playerName);
}

function handleCreateRoom(ws, data) {
  const roomCode = generateUniqueRoomCode();
  const room = ensureRoom(roomCode, ws.clientId, {
    roomName: data.roomName,
    password: data.password,
    maxPlayers: data.maxPlayers,
    mapId: data.mapId,
    channel: data.channel,
  });

  send(ws, 'room_created', { roomCode });
  addPlayerToRoom(ws, room, data.playerName);
}

function handleJoinRoom(ws, data) {
  const roomCode = String(data.roomCode || '').trim();
  const room = rooms.get(roomCode);
  if (!room) {
    send(ws, 'error', { message: 'Room not found.' });
    return;
  }

  if (room.password && room.password !== String(data.password || '')) {
    send(ws, 'error', { message: 'Wrong password.' });
    return;
  }

  addPlayerToRoom(ws, room, data.playerName);
}

function handleListRooms(ws, data) {
  const channel = sanitizeChannel(data.channel);
  lobbyClients.set(ws.clientId, channel);
  broadcastRoomList(channel);
}

function handleStopListRooms(ws) {
  lobbyClients.delete(ws.clientId);
}

function handleAddBot(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room || room.hostId !== ws.clientId) {
    return;
  }

  const humans = humanPlayers(room);
  const botCount = room.players.size - humans.length;
  const maxBots = Math.max(0, room.maxPlayers - humans.length);
  if (botCount >= maxBots) {
    send(ws, 'error', { message: 'Cannot add more bots.' });
    return;
  }

  const speciesName = randomPokemonName();
  const botId = nextBotId(room);
  const bot = {
    id: botId,
    name: `봇 ${speciesName}`,
    role: 'pokemon',
    position: getSpawnPosition('pokemon'),
    rotation: [0, Math.random() * Math.PI * 2, 0],
    species: { name: speciesName, ...speciesStats[speciesName] },
    isAlive: true,
    isCaught: false,
    score: 0,
    isBot: true,
    wanderDir: null,
    wanderUntil: 0,
  };

  room.players.set(botId, bot);
  room.ready.set(botId, true);
  broadcast(room, 'bot_added', { botId, botName: bot.name });
  emitRoomState(room);
  broadcastRoomList(room.channel);
}

function handleRemoveBot(ws, data) {
  const room = rooms.get(ws.roomCode);
  if (!room || room.hostId !== ws.clientId) {
    return;
  }

  const botId = String(data.botId || '');
  const bot = room.players.get(botId);
  if (!bot || !bot.isBot) {
    return;
  }

  room.players.delete(botId);
  room.ready.delete(botId);
  broadcast(room, 'bot_removed', { botId });
  emitRoomState(room);
  broadcastRoomList(room.channel);
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
  const speciesName = String(data.speciesName || 'Bulbasaur');
  const stats = speciesStats[speciesName] || speciesStats.Bulbasaur;
  player.species = { name: speciesName, ...stats };
  emitRoomState(room);
}

function handleSelectRole(ws, data) {
  const room = rooms.get(ws.roomCode);
  if (!room || room.phase !== 'lobby') {
    return;
  }

  const player = room.players.get(ws.clientId);
  if (!player) {
    return;
  }

  const requestedRole = data.role;
  if (requestedRole !== 'trainer' && requestedRole !== 'pokemon') {
    return;
  }

  player.role = requestedRole;
  if (requestedRole === 'pokemon' && !player.species) {
    player.species = { name: 'Bulbasaur', ...speciesStats.Bulbasaur };
  }
  if (requestedRole === 'trainer') {
    player.species = undefined;
  }

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
  if (room.players.size < MIN_PLAYERS) {
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

  const humans = humanPlayers(room);
  if (humans.length === 0) {
    rooms.delete(room.roomCode);
    broadcastRoomList(room.channel);
    return;
  }

  if (room.hostId === ws.clientId) {
    room.hostId = humans[0].id;
  }

  assignRoles(room);
  broadcast(room, 'player_left', { playerId: ws.clientId });
  emitRoomState(room);
  broadcastRoomList(room.channel);
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
      case 'list_rooms':
        handleListRooms(ws, data);
        break;
      case 'stop_list_rooms':
        handleStopListRooms(ws);
        break;
      case 'create_room':
        handleCreateRoom(ws, data);
        break;
      case 'join_room':
        handleJoinRoom(ws, data);
        break;
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
      case 'select_role':
        handleSelectRole(ws, data);
        break;
      case 'start_game':
        handleStartGame(ws);
        break;
      case 'add_bot':
        handleAddBot(ws);
        break;
      case 'remove_bot':
        handleRemoveBot(ws, data);
        break;
      case 'chat':
        handleChat(ws, data);
        break;
      default:
        break;
    }
  });

  ws.on('close', () => {
    lobbyClients.delete(ws.clientId);
    leaveRoom(ws);
    clients.delete(ws.clientId);
  });
});

// ──────── MAP OBSTACLE KNOWLEDGE ────────
// Replicate client's seeded RNG to know exact tree/rock/bush positions
const CLEARING_RADIUS = 10;

function hashSeed(seed) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRng(seed) {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function scatterCover(seed, count, minRadius, edgePadding, minSpacing) {
  const rng = createSeededRng(seed);
  const pts = [];
  let att = 0;
  while (pts.length < count && att < count * 140) {
    att++;
    const span = MAP_HALF_EXTENT - edgePadding;
    const x = (rng() * 2 - 1) * span;
    const z = (rng() * 2 - 1) * span;
    if (Math.hypot(x, z) <= minRadius) continue;
    let overlap = false;
    for (const p of pts) {
      if ((p.x - x) ** 2 + (p.z - z) ** 2 < minSpacing * minSpacing) { overlap = true; break; }
    }
    if (overlap) continue;
    rng(); rng(); rng(); rng(); rng(); // consume scale, rotation, tiltX, tiltZ, variant
    pts.push({ x, z });
  }
  return pts;
}

function generateCoverPositions() {
  const covers = [];

  // Core trees (matches client seed 'core-trees')
  scatterCover('core-trees', 42, CLEARING_RADIUS, 6, 5)
    .forEach((p) => covers.push({ x: p.x, z: p.z, r: 2.5 }));

  // Rocks (matches client seed 'rock-field')
  scatterCover('rock-field', 18, CLEARING_RADIUS, 8, 6)
    .forEach((p) => covers.push({ x: p.x, z: p.z, r: 1.8 }));

  // Bushes (matches client seed 'bush-clumps')
  scatterCover('bush-clumps', 10, CLEARING_RADIUS, 10, 8)
    .forEach((p) => covers.push({ x: p.x, z: p.z, r: 1.5 }));

  // Boundary trees along map edges (matches client 'boundary-tree-line')
  const bRng = createSeededRng('boundary-tree-line');
  const sides = [
    { axis: 'x', fixed: -46, count: 4 },
    { axis: 'x', fixed: 46, count: 4 },
    { axis: 'z', fixed: -46, count: 3 },
    { axis: 'z', fixed: 46, count: 3 },
  ];
  for (const side of sides) {
    for (let i = 0; i < side.count; i++) {
      const t = (i + 1) / (side.count + 1);
      const sweep = -35 + t * 70 + (bRng() * 2 - 1) * 2.8;
      const cx = side.axis === 'x' ? side.fixed + (bRng() * 2 - 1) * 1.6 : sweep;
      const cz = side.axis === 'z' ? side.fixed + (bRng() * 2 - 1) * 1.6 : sweep;
      covers.push({ x: cx, z: cz, r: 2.5 });
      bRng(); bRng(); bRng(); bRng(); bRng(); // consume scale, rotation, tiltX, tiltZ, variant
    }
  }

  return covers;
}

const COVER_SPOTS = generateCoverPositions();

// ──────── SMART BOT AI ────────
const AI_PATROL = 'patrol';
const AI_ALERT  = 'alert';
const AI_FLEE   = 'flee';
const AI_HIDE   = 'hide';

const ALERT_RANGE_BASE = 30;
const FLEE_RANGE_BASE  = 15;
const SAFE_RANGE       = 40;
const EDGE_BUFFER      = 6;
const HIDE_ARRIVAL     = 3;

function findBestCover(botPos, trainerPos) {
  let best = null;
  let bestScore = -Infinity;
  for (const c of COVER_SPOTS) {
    const dBot = Math.hypot(c.x - botPos[0], c.z - botPos[2]);
    const dTrainer = Math.hypot(c.x - trainerPos[0], c.z - trainerPos[2]);
    // Prefer cover that is close to bot but far from trainer
    let score = dTrainer * 0.6 - dBot * 1.0;
    // Bonus: cover on opposite side of trainer
    const toTX = trainerPos[0] - botPos[0];
    const toTZ = trainerPos[2] - botPos[2];
    const toCX = c.x - botPos[0];
    const toCZ = c.z - botPos[2];
    const dot = toTX * toCX + toTZ * toCZ;
    if (dot < 0) score += 6;
    // Penalty: too close to map edge (avoid getting cornered)
    if (Math.abs(c.x) > MAP_HALF_EXTENT - EDGE_BUFFER || Math.abs(c.z) > MAP_HALF_EXTENT - EDGE_BUFFER) {
      score -= 8;
    }
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

function findNearestCover(pos) {
  let best = null;
  let bestDist = Infinity;
  for (const c of COVER_SPOTS) {
    const d = Math.hypot(c.x - pos[0], c.z - pos[2]);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return { cover: best, dist: bestDist };
}

function steerAwayFromEdge(px, pz, mx, mz) {
  const limit = MAP_HALF_EXTENT - EDGE_BUFFER;
  let fx = mx;
  let fz = mz;
  if (px + mx > limit)  fx = -Math.abs(mx) * 0.8;
  if (px + mx < -limit) fx =  Math.abs(mx) * 0.8;
  if (pz + mz > limit)  fz = -Math.abs(mz) * 0.8;
  if (pz + mz < -limit) fz =  Math.abs(mz) * 0.8;
  return [fx, fz];
}

function tickBotAI(bot, trainers, dt) {
  const speed = bot.species?.speed || speciesStats.Bulbasaur.speed;
  const size = bot.species?.size || 'medium';
  const now = Date.now();

  // Init AI state on first tick
  if (!bot.ai) {
    bot.ai = {
      state: AI_PATROL,
      target: null,
      zigzag: 0,
      changed: now,
      patrolIdx: Math.floor(Math.random() * COVER_SPOTS.length),
    };
  }

  // --- Find nearest trainer ---
  let nearest = null;
  let nearDist = Infinity;
  for (const t of trainers) {
    const d = distance(bot.position, t.position);
    if (d < nearDist) { nearDist = d; nearest = t; }
  }

  // --- Species-specific modifiers ---
  // Small/fast → detect earlier, zigzag more
  // Large/slow → detect earlier, prefer hiding
  const alertRange = size === 'small' ? ALERT_RANGE_BASE * 1.2
    : size === 'large' ? ALERT_RANGE_BASE * 1.1 : ALERT_RANGE_BASE;
  const fleeRange = size === 'small' ? FLEE_RANGE_BASE * 1.15
    : size === 'large' ? FLEE_RANGE_BASE * 1.0 : FLEE_RANGE_BASE;

  // --- State transitions ---
  const prev = bot.ai.state;

  if (nearest) {
    if (nearDist < fleeRange) {
      bot.ai.state = AI_FLEE;
    } else if (nearDist < alertRange) {
      // Stay hidden at least 5s before re-evaluating
      if (prev === AI_HIDE && now - bot.ai.changed < 5000) {
        // keep hiding
      } else {
        bot.ai.state = AI_ALERT;
      }
    } else if (nearDist > SAFE_RANGE) {
      if (prev === AI_FLEE || prev === AI_ALERT || prev === AI_HIDE) {
        bot.ai.state = AI_PATROL;
      }
    }
  } else {
    bot.ai.state = AI_PATROL;
  }

  if (prev !== bot.ai.state) {
    bot.ai.changed = now;
    bot.ai.target = null;
  }

  // --- Movement per state ---
  let mx = 0;
  let mz = 0;

  switch (bot.ai.state) {
    case AI_PATROL: {
      // Walk between random cover spots (looks natural)
      const dest = COVER_SPOTS[bot.ai.patrolIdx % COVER_SPOTS.length];
      if (!dest) break;
      const dx = dest.x - bot.position[0];
      const dz = dest.z - bot.position[2];
      const dl = Math.sqrt(dx * dx + dz * dz) || 1;
      if (dl < 2.5) {
        // Pick next patrol point (nearby, not same spot)
        bot.ai.patrolIdx = Math.floor(Math.random() * COVER_SPOTS.length);
      } else {
        const step = speed * 0.22 * dt;
        mx = (dx / dl) * step;
        mz = (dz / dl) * step;
        // Small random deviation for natural look
        mx += (Math.random() - 0.5) * step * 0.2;
        mz += (Math.random() - 0.5) * step * 0.2;
      }
      break;
    }

    case AI_ALERT: {
      // Move toward best cover between bot and trainer
      if (!bot.ai.target && nearest) {
        bot.ai.target = findBestCover(bot.position, nearest.position);
      }
      if (bot.ai.target) {
        const dx = bot.ai.target.x - bot.position[0];
        const dz = bot.ai.target.z - bot.position[2];
        const dl = Math.sqrt(dx * dx + dz * dz) || 1;
        if (dl < HIDE_ARRIVAL) {
          bot.ai.state = AI_HIDE;
          bot.ai.changed = now;
        } else {
          const step = speed * 0.55 * dt;
          mx = (dx / dl) * step;
          mz = (dz / dl) * step;
        }
      }
      break;
    }

    case AI_FLEE: {
      // Evasive retreat with zigzag
      if (nearest) {
        const dx = bot.position[0] - nearest.position[0];
        const dz = bot.position[2] - nearest.position[2];
        const dl = Math.sqrt(dx * dx + dz * dz) || 1;

        // Zigzag: small = aggressive zigzag, large = mild
        const zigzagAmp = size === 'small' ? 0.7 : size === 'large' ? 0.3 : 0.5;
        const zigzagFreq = size === 'small' ? 4.0 : size === 'large' ? 2.0 : 3.0;
        bot.ai.zigzag += dt * zigzagFreq;
        const zig = Math.sin(bot.ai.zigzag) * zigzagAmp;

        // Perpendicular vector for zigzag
        const perpX = -dz / dl;
        const perpZ = dx / dl;

        const step = speed * 0.7 * dt;
        mx = ((dx / dl) + perpX * zig) * step;
        mz = ((dz / dl) + perpZ * zig) * step;

        // Steer away from edges
        const steered = steerAwayFromEdge(bot.position[0], bot.position[2], mx, mz);
        mx = steered[0];
        mz = steered[1];

        // Opportunistic cover: if a cover spot is nearby and roughly
        // in our flee direction, blend toward it
        const near = findNearestCover(bot.position);
        if (near.cover && near.dist < 10) {
          const tcx = near.cover.x - bot.position[0];
          const tcz = near.cover.z - bot.position[2];
          const tcl = Math.sqrt(tcx * tcx + tcz * tcz) || 1;
          // Only blend if cover is roughly away from trainer
          const coverDot = (dx / dl) * (tcx / tcl) + (dz / dl) * (tcz / tcl);
          if (coverDot > 0.1) {
            mx = mx * 0.45 + (tcx / tcl) * step * 0.55;
            mz = mz * 0.45 + (tcz / tcl) * step * 0.55;
          }
        }
      }
      break;
    }

    case AI_HIDE: {
      // Stay near cover position, creep to stay behind it
      const cov = bot.ai.target;
      if (cov && nearest) {
        // Position ourselves so cover is between us and trainer
        const ttx = nearest.position[0] - cov.x;
        const ttz = nearest.position[2] - cov.z;
        const ttl = Math.sqrt(ttx * ttx + ttz * ttz) || 1;
        // Ideal hide position: opposite side of cover from trainer
        const idealX = cov.x - (ttx / ttl) * (cov.r || 2);
        const idealZ = cov.z - (ttz / ttl) * (cov.r || 2);
        const toIdealX = idealX - bot.position[0];
        const toIdealZ = idealZ - bot.position[2];
        const idl = Math.sqrt(toIdealX * toIdealX + toIdealZ * toIdealZ) || 1;
        if (idl > 0.8) {
          const step = speed * 0.18 * dt;
          mx = (toIdealX / idl) * step;
          mz = (toIdealZ / idl) * step;
        }
      } else if (cov) {
        // No trainer visible, just stay near cover
        const dx = cov.x - bot.position[0];
        const dz = cov.z - bot.position[2];
        const dl = Math.sqrt(dx * dx + dz * dz);
        if (dl > 1.5) {
          const step = speed * 0.12 * dt;
          mx = (dx / dl) * step;
          mz = (dz / dl) * step;
        }
      }
      break;
    }
  }

  return { mx, mz };
}

// Bot tick: 100ms interval for smooth movement
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.phase !== 'hunting') {
      continue;
    }

    const trainers = [...room.players.values()].filter((p) => p.role === 'trainer' && !p.isCaught);
    const bots = [...room.players.values()].filter((p) => p.isBot && p.role === 'pokemon' && !p.isCaught);

    for (const bot of bots) {
      const { mx, mz } = tickBotAI(bot, trainers, 0.1);
      const x = Math.max(-MAP_HALF_EXTENT, Math.min(MAP_HALF_EXTENT, bot.position[0] + mx));
      const z = Math.max(-MAP_HALF_EXTENT, Math.min(MAP_HALF_EXTENT, bot.position[2] + mz));
      const yaw = Math.atan2(mx, mz);
      bot.position = [x, SPAWN_HEIGHT, z];
      bot.rotation = [0, Number.isFinite(yaw) ? yaw : 0, 0];

      broadcast(room, 'position', {
        playerId: bot.id,
        position: bot.position,
        rotation: bot.rotation,
      });
    }
  }
}, 100);

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
