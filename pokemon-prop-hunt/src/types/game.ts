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
  { name: 'Pikachu', speed: 6, catchDifficulty: 0.4, size: 'small', color: '#FFD60A', modelScale: 0.9 },
  { name: 'Charmander', speed: 5, catchDifficulty: 0.5, size: 'small', color: '#F77F00', modelScale: 0.95 },
  { name: 'Bulbasaur', speed: 4.5, catchDifficulty: 0.5, size: 'medium', color: '#2A9D8F', modelScale: 1 },
  { name: 'Squirtle', speed: 4.5, catchDifficulty: 0.5, size: 'medium', color: '#5FA8D3', modelScale: 0.95 },
  { name: 'Eevee', speed: 7, catchDifficulty: 0.35, size: 'small', color: '#B08968', modelScale: 0.85 },
  { name: 'Snorlax', speed: 2.5, catchDifficulty: 0.7, size: 'large', color: '#4D908E', modelScale: 1.45 },
  { name: 'Gengar', speed: 5.5, catchDifficulty: 0.3, size: 'medium', color: '#4361EE', modelScale: 1.05 },
  { name: 'Jigglypuff', speed: 4, catchDifficulty: 0.6, size: 'small', color: '#F6BDC0', modelScale: 0.85 },
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
}

export interface RemotePlayer extends Player {
  lastUpdate: number;
  ready: boolean;
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
  | { type: 'error'; data: { message: string } };
