import { create } from 'zustand';
import { useGameStore } from './gameStore';
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

interface NetworkState {
  // Lobby state (pre-room)
  lobbyWs: WebSocket | null;
  channel: number;
  rooms: RoomListItem[];

  // Room state
  ws: WebSocket | null;
  roomCode: string;
  playerId: string;
  players: Map<string, RemotePlayer>;
  isConnected: boolean;
  isHost: boolean;
  chat: ChatMessage[];

  // Lobby actions
  connectLobby: (channel: number) => void;
  disconnectLobby: () => void;
  setChannel: (channel: number) => void;
  createRoom: (opts: { roomName: string; password?: string; maxPlayers: number; mapId: string; channel: number; playerName: string }) => void;
  joinRoom: (roomCode: string, playerName: string, password?: string) => void;

  // Room actions
  connect: (roomCode: string, playerName: string) => void;
  disconnect: () => void;
  sendReady: (ready: boolean) => void;
  sendPosition: (position: Vector3Tuple, rotation: RotationTuple) => void;
  sendThrow: (throwData: ThrowData) => void;
  sendCatchAttempt: (throwData: ThrowData) => void;
  sendSpeciesSelect: (speciesName: string) => void;
  sendChat: (text: string) => void;
  sendRoleSelect: (role: 'trainer' | 'pokemon') => void;
  startGame: () => void;

  // Bot actions
  addBot: () => void;
  removeBot: (botId: string) => void;
}

const toRemotePlayer = (player: {
  id: string;
  name: string;
  role: 'trainer' | 'pokemon';
  position: Vector3Tuple;
  rotation: RotationTuple;
  species?: { name: string; speed: number; catchDifficulty: number; size: 'small' | 'medium' | 'large'; color: string; modelScale: number };
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

const applyCatchResult = (payload: CatchResultPayload) => {
  const game = useGameStore.getState();
  if (payload.result === 'caught') {
    soundManager.play('catch_success');
    game.registerCatch(payload.pokemonId, payload.pokemonName);
    if (payload.pokemonId === useNetworkStore.getState().playerId) {
      game.setCaught(true);
    }
    return;
  }
  if (payload.result === 'escaped') {
    soundManager.play('catch_fail');
    game.registerEscape(payload.pokemonName);
  }
};

export const useNetworkStore = create<NetworkState>((set, get) => ({
  // Lobby state
  lobbyWs: null,
  channel: 1,
  rooms: [],

  // Room state
  ws: null,
  roomCode: '',
  playerId: '',
  players: new Map<string, RemotePlayer>(),
  isConnected: false,
  isHost: false,
  chat: [],

  // ── Lobby actions ──────────────────────────────────────────────

  connectLobby: (channel) => {
    const prev = get().lobbyWs;
    if (prev) {
      prev.close();
    }

    const ws = new WebSocket(buildSocketUrl());

    ws.onopen = () => {
      sendMessage(ws, { type: 'list_rooms', data: { channel } });
      set({ lobbyWs: ws, channel, rooms: [] });
    };

    ws.onclose = () => {
      set({ lobbyWs: null, rooms: [] });
    };

    ws.onerror = () => {
      // silent
    };

    ws.onmessage = (event) => {
      const parsed = JSON.parse(String(event.data)) as NetworkMessage;
      switch (parsed.type) {
        case 'room_list': {
          set({ rooms: parsed.data.rooms });
          break;
        }
        case 'room_created': {
          // Room was created — we'll get joined via room WS
          break;
        }
        case 'joined': {
          // Lobby WS was used to create room → now it becomes a room WS
          const lobbyWs = get().lobbyWs;
          set({
            ws: lobbyWs,
            lobbyWs: null,
            playerId: parsed.data.playerId,
            roomCode: parsed.data.roomCode,
            isHost: parsed.data.isHost,
            isConnected: true,
          });
          // Re-attach room message handler
          if (lobbyWs) {
            lobbyWs.onmessage = get().ws ? (get().ws as WebSocket).onmessage : null;
            // Actually, we need to set up the room handler properly.
            // The simplest approach: close lobby and use connect() for room.
            // But to avoid complexity, let's handle room messages here too.
          }
          break;
        }
        case 'room_state': {
          const players = new Map<string, RemotePlayer>();
          for (const player of parsed.data.players) {
            players.set(player.id, toRemotePlayer(player));
          }
          set({ players });
          const localId = get().playerId;
          const localPlayer = players.get(localId);
          const gameUpdate: { phase: typeof parsed.data.phase; timeLeft: number; role?: 'trainer' | 'pokemon' } = {
            phase: parsed.data.phase,
            timeLeft: parsed.data.timer,
          };
          if (localPlayer) {
            gameUpdate.role = localPlayer.role;
          }
          useGameStore.setState(gameUpdate);
          break;
        }
        case 'player_joined': {
          set((state) => {
            const players = new Map(state.players);
            players.set(parsed.data.id, toRemotePlayer(parsed.data));
            return { players };
          });
          break;
        }
        case 'player_left': {
          set((state) => {
            const players = new Map(state.players);
            players.delete(parsed.data.playerId);
            return { players };
          });
          break;
        }
        case 'position': {
          set((state) => {
            const current = state.players.get(parsed.data.playerId);
            if (!current) {
              return state;
            }
            const players = new Map(state.players);
            players.set(parsed.data.playerId, {
              ...current,
              position: parsed.data.position,
              rotation: parsed.data.rotation,
              lastUpdate: Date.now(),
            });
            return { players };
          });
          break;
        }
        case 'phase_change': {
          useGameStore.setState({ phase: parsed.data.phase, timeLeft: parsed.data.timer });
          break;
        }
        case 'catch_result': {
          applyCatchResult(parsed.data);
          break;
        }
        case 'chat': {
          set((state) => ({ chat: [...state.chat.slice(-29), parsed.data] }));
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
  },

  disconnectLobby: () => {
    const ws = get().lobbyWs;
    if (ws) {
      ws.close();
    }
    set({ lobbyWs: null, rooms: [], channel: 1 });
  },

  setChannel: (channel) => {
    set({ channel });
    const ws = get().lobbyWs;
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendMessage(ws, { type: 'list_rooms', data: { channel } });
    }
  },

  createRoom: (opts) => {
    // Use the lobby WS to create a room, which will auto-join
    const ws = get().lobbyWs;
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendMessage(ws, { type: 'create_room', data: opts });
    } else {
      // Fallback: open a new connection and create
      const newWs = new WebSocket(buildSocketUrl());
      newWs.onopen = () => {
        sendMessage(newWs, { type: 'create_room', data: opts });
      };
      // Set up standard room handlers via connect-like flow
      set({ lobbyWs: newWs });
    }
  },

  joinRoom: (roomCode, playerName, password) => {
    // Close lobby WS, open room WS via join_room (with password support)
    const lobbyWs = get().lobbyWs;
    if (lobbyWs) {
      lobbyWs.close();
      set({ lobbyWs: null });
    }
    // Open new WS and send join_room (not plain join) to support password
    const prev = get().ws;
    if (prev) {
      prev.close();
    }
    const ws = new WebSocket(buildSocketUrl());
    ws.onopen = () => {
      sendMessage(ws, { type: 'join_room', data: { roomCode, playerName, password } });
      set({ ws, roomCode, isConnected: true });
    };
    ws.onclose = () => {
      set({ ws: null, isConnected: false, players: new Map(), playerId: '', isHost: false, chat: [] });
    };
    ws.onerror = () => {
      set({ isConnected: false });
    };
    // Re-use room message handler from connect()
    ws.onmessage = (event) => {
      const parsed = JSON.parse(String(event.data)) as NetworkMessage;
      switch (parsed.type) {
        case 'joined': {
          set({ playerId: parsed.data.playerId, roomCode: parsed.data.roomCode, isHost: parsed.data.isHost });
          break;
        }
        case 'room_state': {
          const players = new Map<string, RemotePlayer>();
          for (const player of parsed.data.players) {
            players.set(player.id, toRemotePlayer(player));
          }
          set({ players });
          const localId = get().playerId;
          const localPlayer = players.get(localId);
          const gameUpdate: { phase: typeof parsed.data.phase; timeLeft: number; role?: 'trainer' | 'pokemon' } = {
            phase: parsed.data.phase,
            timeLeft: parsed.data.timer,
          };
          if (localPlayer) {
            gameUpdate.role = localPlayer.role;
          }
          useGameStore.setState(gameUpdate);
          break;
        }
        case 'player_joined': {
          set((state) => {
            const players = new Map(state.players);
            players.set(parsed.data.id, toRemotePlayer(parsed.data));
            return { players };
          });
          break;
        }
        case 'player_left': {
          set((state) => {
            const players = new Map(state.players);
            players.delete(parsed.data.playerId);
            return { players };
          });
          break;
        }
        case 'position': {
          set((state) => {
            const current = state.players.get(parsed.data.playerId);
            if (!current) {
              return state;
            }
            const players = new Map(state.players);
            players.set(parsed.data.playerId, {
              ...current,
              position: parsed.data.position,
              rotation: parsed.data.rotation,
              lastUpdate: Date.now(),
            });
            return { players };
          });
          break;
        }
        case 'phase_change': {
          useGameStore.setState({ phase: parsed.data.phase, timeLeft: parsed.data.timer });
          break;
        }
        case 'catch_result': {
          applyCatchResult(parsed.data);
          break;
        }
        case 'chat': {
          set((state) => ({ chat: [...state.chat.slice(-29), parsed.data] }));
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
  },

  // ── Room actions (existing, enhanced) ──────────────────────────

  connect: (roomCode, playerName) => {
    const previousWs = get().ws;
    if (previousWs) {
      previousWs.close();
    }

    // Also close lobby ws
    const lobbyWs = get().lobbyWs;
    if (lobbyWs) {
      lobbyWs.close();
      set({ lobbyWs: null });
    }

    const ws = new WebSocket(buildSocketUrl());

    ws.onopen = () => {
      sendMessage(ws, { type: 'join', data: { roomCode, playerName } });
      set({ ws, roomCode, isConnected: true });
    };

    ws.onclose = () => {
      set({ ws: null, isConnected: false, players: new Map(), playerId: '', isHost: false, chat: [] });
    };

    ws.onerror = () => {
      set({ isConnected: false });
    };

    ws.onmessage = (event) => {
      const parsed = JSON.parse(String(event.data)) as NetworkMessage;
      switch (parsed.type) {
        case 'joined': {
          set({ playerId: parsed.data.playerId, roomCode: parsed.data.roomCode, isHost: parsed.data.isHost });
          break;
        }
        case 'room_state': {
          const players = new Map<string, RemotePlayer>();
          for (const player of parsed.data.players) {
            players.set(player.id, toRemotePlayer(player));
          }
          set({ players });
          const localId = get().playerId;
          const localPlayer = players.get(localId);
          const gameUpdate: { phase: typeof parsed.data.phase; timeLeft: number; role?: 'trainer' | 'pokemon' } = {
            phase: parsed.data.phase,
            timeLeft: parsed.data.timer,
          };
          if (localPlayer) {
            gameUpdate.role = localPlayer.role;
          }
          useGameStore.setState(gameUpdate);
          break;
        }
        case 'player_joined': {
          set((state) => {
            const players = new Map(state.players);
            players.set(parsed.data.id, toRemotePlayer(parsed.data));
            return { players };
          });
          break;
        }
        case 'player_left': {
          set((state) => {
            const players = new Map(state.players);
            players.delete(parsed.data.playerId);
            return { players };
          });
          break;
        }
        case 'position': {
          set((state) => {
            const current = state.players.get(parsed.data.playerId);
            if (!current) {
              return state;
            }
            const players = new Map(state.players);
            players.set(parsed.data.playerId, {
              ...current,
              position: parsed.data.position,
              rotation: parsed.data.rotation,
              lastUpdate: Date.now(),
            });
            return { players };
          });
          break;
        }
        case 'phase_change': {
          useGameStore.setState({ phase: parsed.data.phase, timeLeft: parsed.data.timer });
          break;
        }
        case 'catch_result': {
          applyCatchResult(parsed.data);
          break;
        }
        case 'chat': {
          set((state) => ({ chat: [...state.chat.slice(-29), parsed.data] }));
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
  },

  disconnect: () => {
    const ws = get().ws;
    if (ws) {
      ws.close();
    }
    set({ ws: null, roomCode: '', playerId: '', players: new Map(), isConnected: false, isHost: false, chat: [] });
  },

  sendReady: (ready) => {
    sendMessage(get().ws, { type: 'ready', data: { ready } });
  },

  sendPosition: (position, rotation) => {
    const playerId = get().playerId;
    if (!playerId) {
      return;
    }
    sendMessage(get().ws, { type: 'position', data: { playerId, position, rotation } });
  },

  sendThrow: (throwData) => {
    const playerId = get().playerId;
    if (!playerId) {
      return;
    }
    sendMessage(get().ws, { type: 'throw', data: { playerId, throwData } });
  },

  sendCatchAttempt: (throwData) => {
    const trainerId = get().playerId;
    if (!trainerId) {
      return;
    }
    sendMessage(get().ws, { type: 'catch_attempt', data: { trainerId, throwData } });
  },

  sendSpeciesSelect: (speciesName) => {
    sendMessage(get().ws, { type: 'species_select', data: { speciesName } });
  },

  sendChat: (text) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    sendMessage(get().ws, {
      type: 'chat',
      data: {
        playerId: get().playerId,
        playerName: get().players.get(get().playerId)?.name ?? 'Player',
        text: trimmed,
        timestamp: Date.now(),
      },
    });
  },

  sendRoleSelect: (role) => {
    const { ws, playerId } = get();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    ws.send(JSON.stringify({ type: 'select_role', playerId, data: { role } }));
  },

  startGame: () => {
    sendMessage(get().ws, { type: 'start_game', data: {} });
  },

  // ── Bot actions ────────────────────────────────────────────────

  addBot: () => {
    sendMessage(get().ws, { type: 'add_bot', data: {} });
  },

  removeBot: (botId) => {
    sendMessage(get().ws, { type: 'remove_bot', data: { botId } });
  },
}));
