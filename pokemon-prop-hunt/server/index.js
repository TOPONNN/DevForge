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
const SANITY_MAX = 100;
const SANITY_START = 100;
const SANITY_RECOVERY_AFTER_PENALTY = 40;
const SANITY_DRAIN_PER_SECOND = 2;
const SANITY_BOT_THROW_PENALTY = 15;
const SANITY_REAL_CATCH_REWARD = 25;
const TRAINER_PENALTY_DURATION = 5;
const HUNGER_MAX = 100;
const HUNGER_START = 100;
const HUNGER_CRY_RESET = 60;
const HUNGER_DRAIN_PER_SECOND = 3;
const HUNGER_WARNING_THRESHOLD = 30;
const BERRY_RESTORE = 40;
const BERRY_EAT_RADIUS = 2;
const BERRY_MIN_SPAWN = 15;
const BERRY_MAX_SPAWN = 20;

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

function sendToPlayer(playerId, type, data) {
  const ws = clients.get(playerId);
  if (ws) {
    send(ws, type, data);
  }
}

function clampStat(value, min = 0, max = SANITY_MAX) {
  return Math.max(min, Math.min(max, value));
}

function trainerPlayers(room) {
  return [...room.players.values()].filter((player) => player.role === 'trainer' && !player.isCaught);
}

function emitSanityUpdate(trainer) {
  sendToPlayer(trainer.id, 'sanity_update', { sanity: trainer.sanity });
}

function adjustTrainerSanity(trainer, delta) {
  const prev = Number.isFinite(trainer.sanity) ? trainer.sanity : SANITY_START;
  const next = clampStat(prev + delta, 0, SANITY_MAX);
  if (next === prev) {
    return;
  }
  trainer.sanity = next;
  emitSanityUpdate(trainer);
  if (next <= 0) {
    sendToPlayer(trainer.id, 'trainer_penalty', { type: 'disoriented', duration: TRAINER_PENALTY_DURATION });
    trainer.sanity = SANITY_RECOVERY_AFTER_PENALTY;
    emitSanityUpdate(trainer);
  }
}

function emitHungerUpdate(pokemon) {
  sendToPlayer(pokemon.id, 'hunger_update', { hunger: pokemon.hunger });
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
  if (phase === 'hunting') {
    room.berries = generateBerries();
    for (const trainer of trainerPlayers(room)) {
      if (!Number.isFinite(trainer.sanity)) {
        trainer.sanity = SANITY_START;
      }
      trainer.sanity = clampStat(trainer.sanity, 0, SANITY_MAX);
      emitSanityUpdate(trainer);
    }
    for (const player of room.players.values()) {
      if (player.role !== 'pokemon' || player.isBot || player.isCaught) {
        continue;
      }
      if (!Number.isFinite(player.hunger)) {
        player.hunger = HUNGER_START;
      }
      player.hunger = clampStat(player.hunger, 0, HUNGER_MAX);
      player.hungerWarningSent = player.hunger < HUNGER_WARNING_THRESHOLD;
      emitHungerUpdate(player);
    }
  }
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
    if (player.role === 'trainer') {
      player.sanity = SANITY_START;
    } else if (player.role === 'pokemon' && !player.isBot) {
      player.hunger = HUNGER_START;
      player.hungerWarningSent = false;
    }
  }
  room.berries = [];
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

  if (target.isBot) {
    adjustTrainerSanity(trainer, -SANITY_BOT_THROW_PENALTY);
  }

  const chance = calculateCatchChance(throwData, target);
  const success = Math.random() < chance;
  const shakeCount = 1 + Math.floor(Math.random() * 3);
  if (success) {
    target.isCaught = true;
    target.isAlive = false;
    trainer.score += 1;
    if (!target.isBot) {
      adjustTrainerSanity(trainer, SANITY_REAL_CATCH_REWARD);
    }
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
  const grazeDuration = 4 + Math.random() * 6;
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
    roomCode: ws.roomCode,
    personality: {
      idleChance: 0.18 + Math.random() * 0.27,
      wanderSpeed: 0.15 + Math.random() * 0.15,
      herdiness: 0.2 + Math.random() * 0.65,
      grrazeDuration: grazeDuration,
      grazeDuration,
      turnJitter: 0.01 + Math.random() * 0.03,
      directionChange: 1.2 + Math.random() * 2.6,
    },
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

function generateBerries() {
  if (!COVER_SPOTS.length) {
    return [];
  }
  const berries = [];
  const used = new Set();
  const targetCount = BERRY_MIN_SPAWN + Math.floor(Math.random() * (BERRY_MAX_SPAWN - BERRY_MIN_SPAWN + 1));
  while (berries.length < targetCount && used.size < COVER_SPOTS.length) {
    const index = Math.floor(Math.random() * COVER_SPOTS.length);
    if (used.has(index)) {
      continue;
    }
    used.add(index);
    const spot = COVER_SPOTS[index];
    berries.push({ position: [spot.x, SPAWN_HEIGHT, spot.z] });
  }
  return berries;
}

// ──────── SIMPLE BOT AI (OH DEER STYLE) ────────
const AI_WANDER = 'wander';
const AI_IDLE = 'idle';
const AI_GRAZE = 'graze';
const AI_HERD = 'herd';
const EDGE_BUFFER = 5;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function nearestPokemonBot(bot) {
  const room = bot.roomCode ? rooms.get(bot.roomCode) : null;
  if (!room) {
    return null;
  }
  let nearest = null;
  let bestDist = Infinity;
  for (const other of room.players.values()) {
    if (!other.isBot || other.id === bot.id || other.role !== 'pokemon' || other.isCaught) {
      continue;
    }
    const dx = other.position[0] - bot.position[0];
    const dz = other.position[2] - bot.position[2];
    const dist = Math.hypot(dx, dz);
    if (dist < bestDist) {
      bestDist = dist;
      nearest = other;
    }
  }
  return nearest ? { bot: nearest, dist: bestDist } : null;
}

function pickWanderTarget(position) {
  const span = MAP_HALF_EXTENT - SPAWN_EDGE_BAND - 2;
  return {
    x: clamp(position[0] + randomBetween(-14, 14), -span, span),
    z: clamp(position[2] + randomBetween(-14, 14), -span, span),
  };
}

function pickGrazeSpot(position) {
  if (!COVER_SPOTS.length) {
    return pickWanderTarget(position);
  }
  const start = Math.floor(Math.random() * COVER_SPOTS.length);
  for (let i = 0; i < Math.min(8, COVER_SPOTS.length); i++) {
    const c = COVER_SPOTS[(start + i) % COVER_SPOTS.length];
    const d = Math.hypot(c.x - position[0], c.z - position[2]);
    if (d >= 4 && d <= 22) {
      return { x: c.x, z: c.z };
    }
  }
  const fallback = COVER_SPOTS[start];
  return { x: fallback.x, z: fallback.z };
}

function tickBotAI(bot, trainers, dt) {
  void trainers;
  const now = Date.now();
  const speciesSpeed = bot.species?.speed || speciesStats.Bulbasaur.speed;
  const personality = bot.personality || {
    idleChance: 0.3,
    wanderSpeed: 0.22,
    herdiness: 0.5,
    grrazeDuration: 6,
    grazeDuration: 6,
    turnJitter: 0.02,
    directionChange: 2,
  };

  if (!bot.ai) {
    const angle = Math.random() * Math.PI * 2;
    bot.ai = {
      state: AI_WANDER,
      stateUntil: now + randomBetween(3000, 7000),
      target: pickWanderTarget(bot.position),
      headingX: Math.cos(angle),
      headingZ: Math.sin(angle),
      vx: 0,
      vz: 0,
      nextTurnAt: now + randomBetween(800, 2400),
      gaitPhase: Math.random() * Math.PI * 2,
      herdMateId: null,
    };
  }

  const ai = bot.ai;

  function setState(nextState) {
    ai.state = nextState;
    ai.nextTurnAt = now + randomBetween(700, 2300) / Math.max(0.6, personality.directionChange);
    if (nextState === AI_IDLE) {
      ai.stateUntil = now + randomBetween(2000, 8000);
      ai.target = null;
      ai.herdMateId = null;
    } else if (nextState === AI_GRAZE) {
      ai.stateUntil = now + randomBetween(personality.grrazeDuration * 700, personality.grrazeDuration * 1300);
      ai.target = pickGrazeSpot(bot.position);
      ai.herdMateId = null;
    } else if (nextState === AI_HERD) {
      ai.stateUntil = now + randomBetween(2800, 7000);
      ai.target = null;
    } else {
      ai.stateUntil = now + randomBetween(3500, 9000);
      ai.target = pickWanderTarget(bot.position);
      ai.herdMateId = null;
    }
  }

  if (now >= ai.stateUntil) {
    const nearby = nearestPokemonBot(bot);
    const herdChance = nearby && nearby.dist < 24 ? personality.herdiness * 0.65 : personality.herdiness * 0.35;
    const grazeChance = 0.2 + personality.idleChance * 0.2;
    const roll = Math.random();
    if (roll < personality.idleChance) {
      setState(AI_IDLE);
    } else if (roll < personality.idleChance + grazeChance) {
      setState(AI_GRAZE);
    } else if (roll < personality.idleChance + grazeChance + herdChance) {
      setState(AI_HERD);
      ai.herdMateId = nearby?.bot?.id || null;
    } else {
      setState(AI_WANDER);
    }
  }

  let dirX = ai.headingX;
  let dirZ = ai.headingZ;
  let modeSpeed = personality.wanderSpeed;

  if (ai.state === AI_IDLE) {
    modeSpeed = 0;
  } else if (ai.state === AI_GRAZE) {
    modeSpeed = personality.wanderSpeed * 0.38;
    if (ai.target) {
      const dx = ai.target.x - bot.position[0];
      const dz = ai.target.z - bot.position[2];
      const d = Math.hypot(dx, dz);
      if (d > 1.5) {
        dirX = dx / d;
        dirZ = dz / d;
      } else {
        modeSpeed *= 0.08;
      }
    }
  } else if (ai.state === AI_HERD) {
    modeSpeed = personality.wanderSpeed * 0.82;
    const mateInfo = nearestPokemonBot(bot);
    if (mateInfo && mateInfo.dist < 34) {
      const mate = mateInfo.bot;
      const dx = mate.position[0] - bot.position[0];
      const dz = mate.position[2] - bot.position[2];
      const d = Math.hypot(dx, dz) || 1;
      const personalSpace = 2.5;
      if (d > personalSpace) {
        dirX = dx / d;
        dirZ = dz / d;
      } else {
        dirX = -dz / d;
        dirZ = dx / d;
      }
    } else {
      setState(AI_WANDER);
    }
  } else {
    if (!ai.target || Math.hypot(ai.target.x - bot.position[0], ai.target.z - bot.position[2]) < 2) {
      ai.target = pickWanderTarget(bot.position);
    }
    const dx = ai.target.x - bot.position[0];
    const dz = ai.target.z - bot.position[2];
    const d = Math.hypot(dx, dz) || 1;
    dirX = dx / d;
    dirZ = dz / d;
  }

  if (now >= ai.nextTurnAt) {
    ai.nextTurnAt = now + randomBetween(700, 2300) / Math.max(0.6, personality.directionChange);
    const turn = randomBetween(-0.35, 0.35);
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const tx = dirX * cos - dirZ * sin;
    const tz = dirX * sin + dirZ * cos;
    dirX = tx;
    dirZ = tz;
  }

  dirX += randomBetween(-1, 1) * personality.turnJitter;
  dirZ += randomBetween(-1, 1) * personality.turnJitter;

  const dirLen = Math.hypot(dirX, dirZ) || 1;
  dirX /= dirLen;
  dirZ /= dirLen;

  const edgeLimit = MAP_HALF_EXTENT - EDGE_BUFFER;
  const px = bot.position[0];
  const pz = bot.position[2];
  if (Math.abs(px) > edgeLimit || Math.abs(pz) > edgeLimit) {
    const pullX = -px;
    const pullZ = -pz;
    const pullLen = Math.hypot(pullX, pullZ) || 1;
    dirX = dirX * 0.35 + (pullX / pullLen) * 0.65;
    dirZ = dirZ * 0.35 + (pullZ / pullLen) * 0.65;
  }

  ai.gaitPhase += dt * randomBetween(0.6, 1.3);
  const gait = 0.92 + Math.sin(ai.gaitPhase) * 0.08;
  const desiredStep = speciesSpeed * modeSpeed * gait * dt;
  const desiredMx = dirX * desiredStep;
  const desiredMz = dirZ * desiredStep;

  const smoothing = ai.state === AI_IDLE ? 0.12 : 0.22;
  ai.vx += (desiredMx - ai.vx) * smoothing;
  ai.vz += (desiredMz - ai.vz) * smoothing;

  const maxStep = speciesSpeed * 0.32 * dt;
  const stepLen = Math.hypot(ai.vx, ai.vz);
  if (stepLen > maxStep) {
    ai.vx = (ai.vx / stepLen) * maxStep;
    ai.vz = (ai.vz / stepLen) * maxStep;
  }

  ai.headingX = ai.vx;
  ai.headingZ = ai.vz;
  const headingLen = Math.hypot(ai.headingX, ai.headingZ) || 1;
  ai.headingX /= headingLen;
  ai.headingZ /= headingLen;

  return { mx: ai.vx, mz: ai.vz };
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

    if (!Array.isArray(room.berries) || room.berries.length === 0) {
      continue;
    }

    const pokemonPlayers = [...room.players.values()].filter((p) => p.role === 'pokemon' && !p.isBot && !p.isCaught);
    for (const pokemon of pokemonPlayers) {
      let berryIndex = -1;
      for (let i = 0; i < room.berries.length; i++) {
        if (distance(pokemon.position, room.berries[i].position) <= BERRY_EAT_RADIUS) {
          berryIndex = i;
          break;
        }
      }

      if (berryIndex < 0) {
        continue;
      }

      const [berry] = room.berries.splice(berryIndex, 1);
      const prevHunger = Number.isFinite(pokemon.hunger) ? pokemon.hunger : HUNGER_START;
      const nextHunger = clampStat(prevHunger + BERRY_RESTORE, 0, HUNGER_MAX);
      pokemon.hunger = nextHunger;
      pokemon.hungerWarningSent = nextHunger < HUNGER_WARNING_THRESHOLD;
      if (nextHunger !== prevHunger) {
        emitHungerUpdate(pokemon);
      }
      for (const trainer of trainerPlayers(room)) {
        sendToPlayer(trainer.id, 'berry_eaten', { position: berry.position });
      }
    }
  }
}, 100);

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.phase !== 'hunting') {
      continue;
    }

    for (const trainer of trainerPlayers(room)) {
      adjustTrainerSanity(trainer, -SANITY_DRAIN_PER_SECOND);
    }

    const pokemonPlayers = [...room.players.values()].filter((p) => p.role === 'pokemon' && !p.isBot && !p.isCaught);
    for (const pokemon of pokemonPlayers) {
      const prevHunger = Number.isFinite(pokemon.hunger) ? pokemon.hunger : HUNGER_START;
      let nextHunger = clampStat(prevHunger - HUNGER_DRAIN_PER_SECOND, 0, HUNGER_MAX);
      let cried = false;
      if (nextHunger <= 0) {
        broadcast(room, 'pokemon_cry', { playerId: pokemon.id, position: pokemon.position });
        nextHunger = HUNGER_CRY_RESET;
        cried = true;
      }
      pokemon.hunger = nextHunger;

      if (nextHunger !== prevHunger || cried) {
        emitHungerUpdate(pokemon);
      }

      if (nextHunger < HUNGER_WARNING_THRESHOLD && !pokemon.hungerWarningSent) {
        for (const trainer of trainerPlayers(room)) {
          sendToPlayer(trainer.id, 'hunger_warning', { playerId: pokemon.id, hunger: nextHunger });
        }
        pokemon.hungerWarningSent = true;
      }

      if (nextHunger >= HUNGER_WARNING_THRESHOLD) {
        pokemon.hungerWarningSent = false;
      }
    }
  }
}, 1000);

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
