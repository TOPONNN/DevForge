import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { soundManager } from '../systems/sound';
import type {
  CatchResultPayload,
  ChatMessage,
  NetworkMessage,
  RemotePlayer,
  RoomListItem,
  RotationTuple,
  ThrowData,
  Vector3Tuple,
} from '../types/game';
import { gameActions, registerEscapeWithTimeout } from './gameSlice';
import type { AppThunk, RootState } from './store';

interface NetworkState {
  lobbyWs: WebSocket | null;
  channel: number;
  rooms: RoomListItem[];
  channelWs: WebSocket | null;
  channelCounts: Record<number, number>;
  ws: WebSocket | null;
  roomCode: string;
  playerId: string;
  players: Record<string, RemotePlayer>;
  isConnected: boolean;
  isHost: boolean;
  chat: ChatMessage[];
}

const initialState: NetworkState = {
  lobbyWs: null,
  channel: 1,
  rooms: [],
  channelWs: null,
  channelCounts: {},
  ws: null,
  roomCode: '',
  playerId: '',
  players: {},
  isConnected: false,
  isHost: false,
  chat: [],
};

const toRemotePlayer = (player: {
  id: string;
  name: string;
  role: 'trainer' | 'pokemon';
  pokeballs?: number;
  position: Vector3Tuple;
  rotation: RotationTuple;
  species?: {
    name: string;
    speed: number;
    catchDifficulty: number;
    size: 'small' | 'medium' | 'large';
    color: string;
    modelScale: number;
  };
  isAlive: boolean;
  isCaught: boolean;
  score: number;
  ready?: boolean;
  isBot?: boolean;
}): RemotePlayer => ({
  ...player,
  lastUpdate: Date.now(),
  ready: player.ready ?? false,
});

const buildSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws`;
};

const sendMessage = (ws: WebSocket | null, message: NetworkMessage) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  ws.send(JSON.stringify(message));
};

const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    setLobbyWs(state, action: PayloadAction<WebSocket | null>) {
      state.lobbyWs = action.payload;
    },
    setChannel(state, action: PayloadAction<number>) {
      state.channel = action.payload;
    },
    setRooms(state, action: PayloadAction<RoomListItem[]>) {
      state.rooms = action.payload;
    },
    setChannelWs(state, action: PayloadAction<WebSocket | null>) {
      state.channelWs = action.payload;
    },
    setChannelCounts(state, action: PayloadAction<Record<number, number>>) {
      state.channelCounts = action.payload;
    },
    setWs(state, action: PayloadAction<WebSocket | null>) {
      state.ws = action.payload;
    },
    setRoomCode(state, action: PayloadAction<string>) {
      state.roomCode = action.payload;
    },
    setPlayerId(state, action: PayloadAction<string>) {
      state.playerId = action.payload;
    },
    setPlayers(state, action: PayloadAction<Record<string, RemotePlayer>>) {
      state.players = action.payload;
    },
    upsertPlayer(state, action: PayloadAction<RemotePlayer>) {
      state.players[action.payload.id] = action.payload;
    },
    removePlayer(state, action: PayloadAction<string>) {
      delete state.players[action.payload];
    },
    updatePlayerPosition(
      state,
      action: PayloadAction<{ playerId: string; position: Vector3Tuple; rotation: RotationTuple }>,
    ) {
      const current = state.players[action.payload.playerId];
      if (!current) {
        return;
      }
      state.players[action.payload.playerId] = {
        ...current,
        position: action.payload.position,
        rotation: action.payload.rotation,
        lastUpdate: Date.now(),
      };
    },
    setIsConnected(state, action: PayloadAction<boolean>) {
      state.isConnected = action.payload;
    },
    setIsHost(state, action: PayloadAction<boolean>) {
      state.isHost = action.payload;
    },
    appendChat(state, action: PayloadAction<ChatMessage>) {
      state.chat = [...state.chat.slice(-29), action.payload];
    },
    resetLobbyState(state) {
      state.lobbyWs = null;
      state.rooms = [];
      state.channel = 1;
    },
    resetRoomState(state) {
      state.ws = null;
      state.roomCode = '';
      state.playerId = '';
      state.players = {};
      state.isConnected = false;
      state.isHost = false;
      state.chat = [];
    },
    clearChannelLobby(state) {
      state.channelWs = null;
      state.channelCounts = {};
    },
  },
});

const applyCatchResult = (payload: CatchResultPayload, dispatch: (action: unknown) => void, getState: () => RootState) => {
  const game = getState().game;

  if (game.catchAnim) {
    dispatch(gameActions.setPendingCatchResult(payload));
    return;
  }

  if (payload.result === 'caught') {
    soundManager.play('catch_success');
    dispatch(gameActions.registerCatch({ pokemonId: payload.pokemonId, pokemonName: payload.pokemonName }));
    if (payload.pokemonId === getState().network.playerId) {
      dispatch(gameActions.setCaught(true));
    }
    return;
  }

  if (payload.result === 'escaped') {
    soundManager.play('catch_fail');
    dispatch(registerEscapeWithTimeout(payload.pokemonName));
  }
};

const syncRoomStateToGame = (
  parsed: Extract<NetworkMessage, { type: 'room_state' }>['data'],
  dispatch: (action: unknown) => void,
  getState: () => RootState,
) => {
  const players: Record<string, RemotePlayer> = {};
  for (const player of parsed.players) {
    players[player.id] = toRemotePlayer(player);
  }
  dispatch(networkSlice.actions.setPlayers(players));

  const localPlayer = players[getState().network.playerId];
  dispatch(gameActions.setPhase(parsed.phase));
  dispatch(gameActions.setTimeLeft(parsed.timer));

  if (localPlayer) {
    dispatch(gameActions.setRole(localPlayer.role));
    if (typeof localPlayer.pokeballs === 'number') {
      dispatch(gameActions.setPokeballCount(localPlayer.pokeballs));
    }
  }
};

const handleRoomMessage = (
  parsed: NetworkMessage,
  dispatch: (action: unknown) => void,
  getState: () => RootState,
) => {
  switch (parsed.type) {
    case 'joined': {
      dispatch(networkSlice.actions.setPlayerId(parsed.data.playerId));
      dispatch(networkSlice.actions.setRoomCode(parsed.data.roomCode));
      dispatch(networkSlice.actions.setIsHost(parsed.data.isHost));
      break;
    }
    case 'room_state': {
      syncRoomStateToGame(parsed.data, dispatch, getState);
      break;
    }
    case 'player_joined': {
      dispatch(networkSlice.actions.upsertPlayer(toRemotePlayer(parsed.data)));
      break;
    }
    case 'player_left': {
      dispatch(networkSlice.actions.removePlayer(parsed.data.playerId));
      break;
    }
    case 'position': {
      dispatch(
        networkSlice.actions.updatePlayerPosition({
          playerId: parsed.data.playerId,
          position: parsed.data.position,
          rotation: parsed.data.rotation,
        }),
      );
      break;
    }
    case 'phase_change': {
      dispatch(gameActions.setPhase(parsed.data.phase));
      dispatch(gameActions.setTimeLeft(parsed.data.timer));
      break;
    }
    case 'catch_result': {
      applyCatchResult(parsed.data, dispatch, getState);
      break;
    }
    case 'sanity_update': {
      dispatch(gameActions.setTrainerSanity(parsed.data.sanity));
      break;
    }
    case 'hunger_update': {
      dispatch(gameActions.setPokemonHunger(parsed.data.hunger));
      break;
    }
    case 'trainer_penalty': {
      dispatch(gameActions.setDisoriented(parsed.data.duration));
      soundManager.play('defeat');
      break;
    }
    case 'pokemon_cry': {
      soundManager.play('catch_fail');
      break;
    }
    case 'berry_eaten': {
      soundManager.play('catch_success');
      break;
    }
    case 'chat': {
      dispatch(networkSlice.actions.appendChat(parsed.data));
      break;
    }
    case 'error': {
      console.error(parsed.data.message);
      break;
    }
    default:
      break;
  }
};

const attachRoomSocketHandlers = (ws: WebSocket, dispatch: (action: unknown) => void, getState: () => RootState) => {
  ws.onclose = () => {
    dispatch(networkSlice.actions.resetRoomState());
  };

  ws.onerror = () => {
    dispatch(networkSlice.actions.setIsConnected(false));
  };

  ws.onmessage = (event) => {
    const parsed = JSON.parse(String(event.data)) as NetworkMessage;
    handleRoomMessage(parsed, dispatch, getState);
  };
};

export const connectLobby = (channel: number): AppThunk => (dispatch, getState) => {
  const prev = getState().network.lobbyWs;
  if (prev) {
    prev.close();
  }

  const ws = new WebSocket(buildSocketUrl());

  ws.onopen = () => {
    sendMessage(ws, { type: 'list_rooms', data: { channel } });
    dispatch(networkSlice.actions.setLobbyWs(ws));
    dispatch(networkSlice.actions.setChannel(channel));
    dispatch(networkSlice.actions.setRooms([]));
  };

  ws.onclose = () => {
    dispatch(networkSlice.actions.setLobbyWs(null));
    dispatch(networkSlice.actions.setRooms([]));
  };

  ws.onerror = () => {};

  ws.onmessage = (event) => {
    const parsed = JSON.parse(String(event.data)) as NetworkMessage;

    if (parsed.type === 'room_list') {
      dispatch(networkSlice.actions.setRooms(parsed.data.rooms));
      return;
    }

    if (parsed.type === 'joined') {
      dispatch(networkSlice.actions.setWs(ws));
      dispatch(networkSlice.actions.setLobbyWs(null));
      dispatch(networkSlice.actions.setPlayerId(parsed.data.playerId));
      dispatch(networkSlice.actions.setRoomCode(parsed.data.roomCode));
      dispatch(networkSlice.actions.setIsHost(parsed.data.isHost));
      dispatch(networkSlice.actions.setIsConnected(true));
      attachRoomSocketHandlers(ws, dispatch, getState);
      return;
    }

    handleRoomMessage(parsed, dispatch, getState);
  };
};

export const disconnectLobby = (): AppThunk => (dispatch, getState) => {
  const ws = getState().network.lobbyWs;
  if (ws) {
    ws.close();
  }
  dispatch(networkSlice.actions.resetLobbyState());
};

export const setChannel = (channel: number): AppThunk => (dispatch, getState) => {
  dispatch(networkSlice.actions.setChannel(channel));
  const ws = getState().network.lobbyWs;
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendMessage(ws, { type: 'list_rooms', data: { channel } });
  }
};

export const connectChannelLobby = (): AppThunk => (dispatch, getState) => {
  const prev = getState().network.channelWs;
  if (prev) {
    prev.close();
  }

  const ws = new WebSocket(buildSocketUrl());
  ws.onopen = () => {
    sendMessage(ws, { type: 'list_channels', data: {} });
    dispatch(networkSlice.actions.setChannelWs(ws));
  };
  ws.onclose = () => {
    dispatch(networkSlice.actions.setChannelWs(null));
  };
  ws.onerror = () => {};
  ws.onmessage = (event) => {
    const parsed = JSON.parse(String(event.data)) as NetworkMessage;
    if (parsed.type === 'channel_counts') {
      dispatch(networkSlice.actions.setChannelCounts(parsed.data.counts));
    }
  };
};

export const disconnectChannelLobby = (): AppThunk => (dispatch, getState) => {
  const ws = getState().network.channelWs;
  if (ws) {
    ws.close();
  }
  dispatch(networkSlice.actions.clearChannelLobby());
};

export const createRoom = (opts: {
  roomName: string;
  password?: string;
  maxPlayers: number;
  mapId: string;
  channel: number;
  playerName: string;
}): AppThunk =>
  (dispatch, getState) => {
    const ws = getState().network.lobbyWs;
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendMessage(ws, { type: 'create_room', data: opts });
      return;
    }

    const newWs = new WebSocket(buildSocketUrl());
    newWs.onopen = () => {
      sendMessage(newWs, { type: 'create_room', data: opts });
    };
    dispatch(networkSlice.actions.setLobbyWs(newWs));
  };

export const joinRoom = (roomCode: string, playerName: string, password?: string): AppThunk =>
  (dispatch, getState) => {
    const lobbyWs = getState().network.lobbyWs;
    if (lobbyWs) {
      lobbyWs.close();
      dispatch(networkSlice.actions.setLobbyWs(null));
    }

    const prev = getState().network.ws;
    if (prev) {
      prev.close();
    }

    const ws = new WebSocket(buildSocketUrl());
    ws.onopen = () => {
      sendMessage(ws, { type: 'join_room', data: { roomCode, playerName, password } });
      dispatch(networkSlice.actions.setWs(ws));
      dispatch(networkSlice.actions.setRoomCode(roomCode));
      dispatch(networkSlice.actions.setIsConnected(true));
    };

    attachRoomSocketHandlers(ws, dispatch, getState);
  };

export const connect = (roomCode: string, playerName: string): AppThunk => (dispatch, getState) => {
  const previousWs = getState().network.ws;
  if (previousWs) {
    previousWs.close();
  }

  const lobbyWs = getState().network.lobbyWs;
  if (lobbyWs) {
    lobbyWs.close();
    dispatch(networkSlice.actions.setLobbyWs(null));
  }

  const ws = new WebSocket(buildSocketUrl());

  ws.onopen = () => {
    sendMessage(ws, { type: 'join', data: { roomCode, playerName } });
    dispatch(networkSlice.actions.setWs(ws));
    dispatch(networkSlice.actions.setRoomCode(roomCode));
    dispatch(networkSlice.actions.setIsConnected(true));
  };

  attachRoomSocketHandlers(ws, dispatch, getState);
};

export const disconnect = (): AppThunk => (dispatch, getState) => {
  const ws = getState().network.ws;
  if (ws) {
    ws.close();
  }
  dispatch(networkSlice.actions.resetRoomState());
};

export const sendReady = (ready: boolean): AppThunk => (_, getState) => {
  sendMessage(getState().network.ws, { type: 'ready', data: { ready } });
};

export const sendPosition = (position: Vector3Tuple, rotation: RotationTuple): AppThunk => (_, getState) => {
  const playerId = getState().network.playerId;
  if (!playerId) {
    return;
  }
  sendMessage(getState().network.ws, { type: 'position', data: { playerId, position, rotation } });
};

export const sendThrow = (throwData: ThrowData): AppThunk => (_, getState) => {
  const playerId = getState().network.playerId;
  if (!playerId) {
    return;
  }
  sendMessage(getState().network.ws, { type: 'throw', data: { playerId, throwData } });
};

export const sendCatchAttempt = (throwData: ThrowData): AppThunk => (_, getState) => {
  const trainerId = getState().network.playerId;
  if (!trainerId) {
    return;
  }
  sendMessage(getState().network.ws, { type: 'catch_attempt', data: { trainerId, throwData } });
};

export const sendSpeciesSelect = (speciesName: string): AppThunk => (_, getState) => {
  sendMessage(getState().network.ws, { type: 'species_select', data: { speciesName } });
};

export const sendPokeballCount = (count: number): AppThunk => (_, getState) => {
  const { ws, playerId } = getState().network;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  const normalizedCount = Math.max(0, Math.floor(count));
  ws.send(JSON.stringify({ type: 'pokeball_count', playerId, data: { count: normalizedCount } }));
};

export const sendChat = (text: string): AppThunk => (_, getState) => {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }

  const { ws, playerId, players } = getState().network;
  sendMessage(ws, {
    type: 'chat',
    data: {
      playerId,
      playerName: players[playerId]?.name ?? 'Player',
      text: trimmed,
      timestamp: Date.now(),
    },
  });
};

export const sendRoleSelect = (role: 'trainer' | 'pokemon'): AppThunk => (_, getState) => {
  const { ws, playerId } = getState().network;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  ws.send(JSON.stringify({ type: 'select_role', playerId, data: { role } }));
};

export const startGame = (): AppThunk => (_, getState) => {
  sendMessage(getState().network.ws, { type: 'start_game', data: {} });
};

export const addBot = (): AppThunk => (_, getState) => {
  sendMessage(getState().network.ws, { type: 'add_bot', data: {} });
};

export const removeBot = (botId: string): AppThunk => (_, getState) => {
  sendMessage(getState().network.ws, { type: 'remove_bot', data: { botId } });
};

export const networkActions = networkSlice.actions;
export default networkSlice.reducer;
