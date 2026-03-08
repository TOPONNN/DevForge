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

// ── Module-level WebSocket refs (NOT in Redux state to avoid Immer Proxy) ──
let _lobbyWs: WebSocket | null = null;
let _channelWs: WebSocket | null = null;
let _roomWs: WebSocket | null = null;

interface NetworkState {
  channel: number;
  rooms: RoomListItem[];
  channelCounts: Record<number, number>;
  roomCode: string;
  playerId: string;
  players: Record<string, RemotePlayer>;
  isConnected: boolean;
  isHost: boolean;
  chat: ChatMessage[];
}

const initialState: NetworkState = {
  channel: 1,
  rooms: [],
  channelCounts: {},
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
    setChannel(state, action: PayloadAction<number>) {
      state.channel = action.payload;
    },
    setRooms(state, action: PayloadAction<RoomListItem[]>) {
      state.rooms = action.payload;
    },
    setChannelCounts(state, action: PayloadAction<Record<number, number>>) {
      state.channelCounts = action.payload;
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
      _lobbyWs = null;
      state.rooms = [];
      state.channel = 1;
    },
    resetRoomState(state) {
      _roomWs = null;
      state.roomCode = '';
      state.playerId = '';
      state.players = {};
      state.isConnected = false;
      state.isHost = false;
      state.chat = [];
    },
    clearChannelLobby(state) {
      _channelWs = null;
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
  if (_lobbyWs) {
    _lobbyWs.close();
  }

  const ws = new WebSocket(buildSocketUrl());

  ws.onopen = () => {
    sendMessage(ws, { type: 'list_rooms', data: { channel } });
    _lobbyWs = ws;
    dispatch(networkSlice.actions.setChannel(channel));
    dispatch(networkSlice.actions.setRooms([]));
  };

  ws.onclose = () => {
    _lobbyWs = null;
    dispatch(networkSlice.actions.setRooms([]));
  };

  ws.onerror = () => {};

  ws.onmessage = (event) => {
    const parsed = JSON.parse(String(event.data)) as NetworkMessage;

    if (parsed.type === 'room_list') {
      dispatch(networkSlice.actions.setRooms(parsed.data.rooms));
      return;
    }

    if (parsed.type === 'room_created') {
      console.log('[createRoom] room_created:', parsed.data);
      return;
    }

    if (parsed.type === 'joined') {
      _roomWs = ws;
      _lobbyWs = null;
      dispatch(networkSlice.actions.setPlayerId(parsed.data.playerId));
      dispatch(networkSlice.actions.setRoomCode(parsed.data.roomCode));
      dispatch(networkSlice.actions.setIsHost(parsed.data.isHost));
      dispatch(networkSlice.actions.setIsConnected(true));
      attachRoomSocketHandlers(ws, dispatch, getState);
      return;
    }

    if (parsed.type === 'error') {
      console.error('[WS Error]', parsed.data.message);
      alert(parsed.data.message);
      return;
    }

    handleRoomMessage(parsed, dispatch, getState);
  };
};


export const disconnectLobby = (): AppThunk => (dispatch) => {
  if (_lobbyWs) {
    _lobbyWs.close();
  }
  dispatch(networkSlice.actions.resetLobbyState());
};

export const setChannel = (channel: number): AppThunk => (dispatch) => {
  dispatch(networkSlice.actions.setChannel(channel));
  if (_lobbyWs && _lobbyWs.readyState === WebSocket.OPEN) {
    sendMessage(_lobbyWs, { type: 'list_rooms', data: { channel } });
  }
};

export const connectChannelLobby = (): AppThunk => (dispatch) => {
  if (_channelWs) {
    _channelWs.close();
  }

  const ws = new WebSocket(buildSocketUrl());
  ws.onopen = () => {
    sendMessage(ws, { type: 'list_channels', data: {} });
    _channelWs = ws;
  };
  ws.onclose = () => {
    _channelWs = null;
  };
  ws.onerror = () => {};
  ws.onmessage = (event) => {
    const parsed = JSON.parse(String(event.data)) as NetworkMessage;
    if (parsed.type === 'channel_counts') {
      dispatch(networkSlice.actions.setChannelCounts(parsed.data.counts));
    }
  };
};

export const disconnectChannelLobby = (): AppThunk => (dispatch) => {
  if (_channelWs) {
    _channelWs.close();
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
    console.log('[createRoom] opts:', opts);

    if (_lobbyWs && _lobbyWs.readyState === WebSocket.OPEN) {
      console.log('[createRoom] sending via existing _lobbyWs, readyState:', _lobbyWs.readyState);
      sendMessage(_lobbyWs, { type: 'create_room', data: opts });
      return;
    }

    // Lobby WS is null or closed — create a fresh connection
    if (_lobbyWs) {
      _lobbyWs.close();
    }

    console.log('[createRoom] fallback: creating new WebSocket');
    const ws = new WebSocket(buildSocketUrl());

    ws.onopen = () => {
      console.log('[createRoom] fallback ws.onopen');
      sendMessage(ws, { type: 'create_room', data: opts });
      _lobbyWs = ws;
    };

    ws.onclose = () => {
      console.log('[createRoom] fallback ws.onclose');
      _lobbyWs = null;
    };

    ws.onerror = () => {
      console.log('[createRoom] fallback ws.onerror');
    };

    ws.onmessage = (event) => {
      console.log('[createRoom] fallback ws.onmessage raw:', event.data);
      const parsed = JSON.parse(String(event.data)) as NetworkMessage;

      if (parsed.type === 'room_list') {
        dispatch(networkSlice.actions.setRooms(parsed.data.rooms));
        return;
      }

      if (parsed.type === 'room_created') {
        console.log('[createRoom] room_created:', parsed.data);
        return;
      }

      if (parsed.type === 'joined') {
        _roomWs = ws;
        _lobbyWs = null;
        dispatch(networkSlice.actions.setPlayerId(parsed.data.playerId));
        dispatch(networkSlice.actions.setRoomCode(parsed.data.roomCode));
        dispatch(networkSlice.actions.setIsHost(parsed.data.isHost));
        dispatch(networkSlice.actions.setIsConnected(true));
        attachRoomSocketHandlers(ws, dispatch, getState);
        return;
      }

      if (parsed.type === 'error') {
        console.error('[WS Error]', parsed.data.message);
        alert(parsed.data.message);
        return;
      }

      handleRoomMessage(parsed, dispatch, getState);
    };
  };

export const joinRoom = (roomCode: string, playerName: string, password?: string): AppThunk =>
  (dispatch, getState) => {
    if (_lobbyWs) {
      _lobbyWs.close();
      _lobbyWs = null;
    }

    if (_roomWs) {
      _roomWs.close();
    }

    const ws = new WebSocket(buildSocketUrl());
    ws.onopen = () => {
      sendMessage(ws, { type: 'join_room', data: { roomCode, playerName, password } });
      _roomWs = ws;
      dispatch(networkSlice.actions.setRoomCode(roomCode));
      dispatch(networkSlice.actions.setIsConnected(true));
    };

    attachRoomSocketHandlers(ws, dispatch, getState);
  };

export const connect = (roomCode: string, playerName: string): AppThunk => (dispatch, getState) => {
  if (_roomWs) {
    _roomWs.close();
  }

  if (_lobbyWs) {
    _lobbyWs.close();
    _lobbyWs = null;
  }

  const ws = new WebSocket(buildSocketUrl());

  ws.onopen = () => {
    sendMessage(ws, { type: 'join', data: { roomCode, playerName } });
    _roomWs = ws;
    dispatch(networkSlice.actions.setRoomCode(roomCode));
    dispatch(networkSlice.actions.setIsConnected(true));
  };

  attachRoomSocketHandlers(ws, dispatch, getState);
};

export const disconnect = (): AppThunk => (dispatch) => {
  if (_roomWs) {
    _roomWs.close();
  }
  dispatch(networkSlice.actions.resetRoomState());
};

export const sendReady = (ready: boolean): AppThunk => () => {
  sendMessage(_roomWs, { type: 'ready', data: { ready } });
};

export const sendPosition = (position: Vector3Tuple, rotation: RotationTuple): AppThunk => (_, getState) => {
  const playerId = getState().network.playerId;
  if (!playerId) {
    return;
  }
  sendMessage(_roomWs, { type: 'position', data: { playerId, position, rotation } });
};

export const sendThrow = (throwData: ThrowData): AppThunk => (_, getState) => {
  const playerId = getState().network.playerId;
  if (!playerId) {
    return;
  }
  sendMessage(_roomWs, { type: 'throw', data: { playerId, throwData } });
};

export const sendCatchAttempt = (throwData: ThrowData): AppThunk => (_, getState) => {
  const trainerId = getState().network.playerId;
  if (!trainerId) {
    return;
  }
  sendMessage(_roomWs, { type: 'catch_attempt', data: { trainerId, throwData } });
};

export const sendSpeciesSelect = (speciesName: string): AppThunk => () => {
  sendMessage(_roomWs, { type: 'species_select', data: { speciesName } });
};

export const sendPokeballCount = (count: number): AppThunk => (_, getState) => {
  if (!_roomWs || _roomWs.readyState !== WebSocket.OPEN) {
    return;
  }

  const normalizedCount = Math.max(0, Math.floor(count));
  const playerId = getState().network.playerId;
  _roomWs.send(JSON.stringify({ type: 'pokeball_count', playerId, data: { count: normalizedCount } }));
};

export const sendChat = (text: string): AppThunk => (_, getState) => {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }

  const { playerId, players } = getState().network;
  sendMessage(_roomWs, {
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
  if (!_roomWs || _roomWs.readyState !== WebSocket.OPEN) {
    return;
  }
  const playerId = getState().network.playerId;
  _roomWs.send(JSON.stringify({ type: 'select_role', playerId, data: { role } }));
};

export const startGame = (): AppThunk => () => {
  sendMessage(_roomWs, { type: 'start_game', data: {} });
};

export const addBot = (): AppThunk => () => {
  sendMessage(_roomWs, { type: 'add_bot', data: {} });
};

export const removeBot = (botId: string): AppThunk => () => {
  sendMessage(_roomWs, { type: 'remove_bot', data: { botId } });
};

export const networkActions = networkSlice.actions;
export default networkSlice.reducer;
