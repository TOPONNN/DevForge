export type Vector3Tuple = [number, number, number];
export type RotationTuple = [number, number, number];

export type PokemonSize = 'small' | 'medium' | 'large';
export type PlayerRole = 'trainer' | 'pokemon';
export type GamePhase = 'lobby' | 'selecting' | 'preparing' | 'hunting' | 'ended';
export type CatchResult = 'caught' | 'escaped' | 'missed';
export type PokeballState = 'held' | 'flying' | 'wiggling' | 'caught' | 'broken';

export interface PokemonSpecies {
  name: string;
  speed: number;
  catchDifficulty: number;
  size: PokemonSize;
  color: string;
  modelScale: number;
}

export const POKEMON_SPECIES: PokemonSpecies[] = [
  { name: 'Bulbasaur', speed: 4.5, catchDifficulty: 0.5, size: 'medium', color: '#2A9D8F', modelScale: 1.0 },
  { name: 'Ivysaur', speed: 4, catchDifficulty: 0.55, size: 'medium', color: '#1E8449', modelScale: 0.9 },
  { name: 'Venusaur', speed: 3, catchDifficulty: 0.7, size: 'large', color: '#196F3D', modelScale: 1.3 },
  { name: 'Charmander', speed: 5, catchDifficulty: 0.5, size: 'small', color: '#F77F00', modelScale: 0.95 },
  { name: 'Charmeleon', speed: 5.5, catchDifficulty: 0.45, size: 'medium', color: '#E74C3C', modelScale: 1.0 },
  { name: 'Charizard', speed: 6, catchDifficulty: 0.35, size: 'large', color: '#D35400', modelScale: 1.4 },
  { name: 'Squirtle', speed: 4.5, catchDifficulty: 0.5, size: 'small', color: '#5FA8D3', modelScale: 0.95 },
  { name: 'Wartortle', speed: 5, catchDifficulty: 0.45, size: 'medium', color: '#2E86C1', modelScale: 1.0 },
  { name: 'Blastoise', speed: 3.5, catchDifficulty: 0.65, size: 'large', color: '#1A5276', modelScale: 1.35 },
];

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  position: Vector3Tuple;
  rotation: RotationTuple;
  species?: PokemonSpecies;
  isAlive: boolean;
  isCaught: boolean;
  score: number;
  isBot?: boolean;
}

export interface RemotePlayer extends Player {
  lastUpdate: number;
  ready: boolean;
  isBot?: boolean;
}

export interface ThrowData {
  origin: Vector3Tuple;
  direction: Vector3Tuple;
  power: number;
  pokemonTarget?: string;
}

export interface CatchAttempt {
  pokemonId: string;
  shakeCount: 1 | 2 | 3;
  success: boolean;
}

export interface ActivePokeball {
  id: string;
  ownerId: string;
  state: PokeballState;
  position: Vector3Tuple;
  velocity: Vector3Tuple;
  createdAt: number;
  targetId?: string;
}

export interface CatchResultPayload {
  result: CatchResult;
  pokemonId: string;
  pokemonName: string;
  shakeCount: 1 | 2 | 3;
}

export interface RoomStatePayload {
  roomCode: string;
  hostId: string;
  phase: GamePhase;
  players: Player[];
  timer: number;
}

export interface RoomListItem {
  roomCode: string;
  roomName: string;
  channel: number;
  status: '대기중' | '게임중';
  current: number;
  max: number;
  locked: boolean;
  mapId: string;
}

export interface ChatMessage {
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

export type NetworkMessage =
  | { type: 'join'; data: { roomCode: string; playerName: string } }
  | { type: 'leave'; data: { playerId: string } }
  | { type: 'ready'; data: { ready: boolean } }
  | { type: 'position'; data: { playerId: string; position: Vector3Tuple; rotation: RotationTuple } }
  | { type: 'throw'; data: { playerId: string; throwData: ThrowData } }
  | { type: 'catch_attempt'; data: { trainerId: string; throwData: ThrowData } }
  | { type: 'catch_result'; data: CatchResultPayload }
  | { type: 'phase_change'; data: { phase: GamePhase; timer: number } }
  | { type: 'chat'; data: ChatMessage }
  | { type: 'species_select'; data: { speciesName: string } }
  | { type: 'start_game'; data: Record<string, never> }
  | { type: 'joined'; data: { playerId: string; roomCode: string; isHost: boolean } }
  | { type: 'room_state'; data: RoomStatePayload }
  | { type: 'player_joined'; data: Player }
  | { type: 'player_left'; data: { playerId: string } }
  | { type: 'error'; data: { message: string } }
  // Lobby & room management
  | { type: 'list_rooms'; data: { channel: number } }
  | { type: 'stop_list_rooms'; data: Record<string, never> }
  | { type: 'create_room'; data: { roomName: string; password?: string; maxPlayers: number; mapId: string; channel: number; playerName: string } }
  | { type: 'join_room'; data: { roomCode: string; password?: string; playerName: string } }
  | { type: 'room_list'; data: { rooms: RoomListItem[] } }
  | { type: 'room_created'; data: { roomCode: string } }
  // AI bots
  | { type: 'add_bot'; data: Record<string, never> }
  | { type: 'remove_bot'; data: { botId: string } }
  | { type: 'bot_added'; data: { botId: string; botName: string } }
  | { type: 'bot_removed'; data: { botId: string } }
  | { type: 'sanity_update'; data: { sanity: number } }
  | { type: 'hunger_update'; data: { hunger: number } }
  | { type: 'trainer_penalty'; data: { type: string; duration: number } }
  | { type: 'pokemon_cry'; data: { playerId: string; position: Vector3Tuple } }
  | { type: 'berry_eaten'; data: { position: Vector3Tuple } }
  | { type: 'hunger_warning'; data: { playerId: string; hunger: number } }
  // Channel lobby
  | { type: 'list_channels'; data: Record<string, never> }
  | { type: 'stop_list_channels'; data: Record<string, never> }
  | { type: 'channel_counts'; data: { counts: Record<number, number> } };
