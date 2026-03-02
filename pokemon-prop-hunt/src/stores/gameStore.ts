import { create } from 'zustand';
import {
  POKEMON_SPECIES,
  type ActivePokeball,
  type CatchResult,
  type GamePhase,
  type PlayerRole,
  type PokemonSpecies,
  type ThrowData,
  type Vector3Tuple,
} from '../types/game';

interface CatchAttemptResult {
  result: CatchResult;
  pokemonName: string;
}

interface GameState {
  phase: GamePhase;
  role: PlayerRole;
  timeLeft: number;
  prepTime: number;
  huntTime: number;
  pokeballs: number;
  throwPower: number;
  isCharging: boolean;
  activePokeballs: ActivePokeball[];
  caughtPokemon: string[];
  selectedSpecies: PokemonSpecies | null;
  catchAttemptResult: CatchAttemptResult | null;
  escaping: boolean;
  dodgeCooldown: number;
  isCaught: boolean;
  localPosition: Vector3Tuple;
  localRotation: [number, number, number];
  startCharge: () => void;
  setChargePower: (value: number) => void;
  releaseThrow: (throwData: ThrowData, ownerId: string) => ActivePokeball | null;
  setPokeballState: (id: string, state: ActivePokeball['state']) => void;
  updatePokeballPosition: (id: string, position: Vector3Tuple, velocity: Vector3Tuple) => void;
  removePokeball: (id: string) => void;
  registerCatch: (pokemonId: string, pokemonName: string) => void;
  registerEscape: (pokemonName: string) => void;
  selectSpecies: (species: PokemonSpecies) => void;
  dodge: () => boolean;
  setEscaping: (value: boolean) => void;
  setDodgeCooldown: (value: number) => void;
  clearCatchAttemptResult: () => void;
  setRole: (role: PlayerRole) => void;
  setPhase: (phase: GamePhase) => void;
  setTimeLeft: (value: number) => void;
  tickTimer: () => void;
  setCaught: (value: boolean) => void;
  setLocalTransform: (position: Vector3Tuple, rotation: [number, number, number]) => void;
  resetRound: () => void;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'lobby',
  role: 'pokemon',
  timeLeft: 15,
  prepTime: 15,
  huntTime: 180,
  pokeballs: 10,
  throwPower: 0,
  isCharging: false,
  activePokeballs: [],
  caughtPokemon: [],
  selectedSpecies: POKEMON_SPECIES[0],
  catchAttemptResult: null,
  escaping: false,
  dodgeCooldown: 0,
  isCaught: false,
  localPosition: [0, 1.1, 12],
  localRotation: [0, 0, 0],

  startCharge: () => {
    const state = get();
    if (state.role !== 'trainer' || state.pokeballs <= 0 || state.phase !== 'hunting') {
      return;
    }
    set({ isCharging: true, throwPower: 0 });
  },

  setChargePower: (value) => {
    if (!get().isCharging) {
      return;
    }
    set({ throwPower: clamp01(value) });
  },

  releaseThrow: (throwData, ownerId) => {
    const state = get();
    if (state.role !== 'trainer' || state.pokeballs <= 0 || state.phase !== 'hunting') {
      return null;
    }

    const velocityScale = 7 + throwData.power * 18;
    const pokeball: ActivePokeball = {
      id: `pokeball-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      ownerId,
      state: 'flying',
      position: throwData.origin,
      velocity: [
        throwData.direction[0] * velocityScale,
        throwData.direction[1] * velocityScale + 3,
        throwData.direction[2] * velocityScale,
      ],
      createdAt: Date.now(),
      targetId: throwData.pokemonTarget,
    };

    set({
      isCharging: false,
      throwPower: 0,
      pokeballs: Math.max(0, state.pokeballs - 1),
      activePokeballs: [...state.activePokeballs, pokeball],
    });
    return pokeball;
  },

  setPokeballState: (id, state) => {
    set((current) => ({
      activePokeballs: current.activePokeballs.map((ball) => (ball.id === id ? { ...ball, state } : ball)),
    }));
  },

  updatePokeballPosition: (id, position, velocity) => {
    set((current) => ({
      activePokeballs: current.activePokeballs.map((ball) =>
        ball.id === id ? { ...ball, position, velocity } : ball,
      ),
    }));
  },

  removePokeball: (id) => {
    set((current) => ({
      activePokeballs: current.activePokeballs.filter((ball) => ball.id !== id),
    }));
  },

  registerCatch: (pokemonId, pokemonName) => {
    const state = get();
    set({
      caughtPokemon: state.caughtPokemon.includes(pokemonId) ? state.caughtPokemon : [...state.caughtPokemon, pokemonId],
      catchAttemptResult: { result: 'caught', pokemonName },
    });
  },

  registerEscape: (pokemonName) => {
    set({ catchAttemptResult: { result: 'escaped', pokemonName }, escaping: true });
    window.setTimeout(() => {
      get().setEscaping(false);
    }, 3000);
  },

  selectSpecies: (species) => set({ selectedSpecies: species }),

  dodge: () => {
    const state = get();
    if (state.dodgeCooldown > 0 || state.phase !== 'hunting' || state.isCaught) {
      return false;
    }
    set({ dodgeCooldown: 5 });
    return true;
  },

  setEscaping: (value) => set({ escaping: value }),
  setDodgeCooldown: (value) => set({ dodgeCooldown: Math.max(0, value) }),
  clearCatchAttemptResult: () => set({ catchAttemptResult: null }),
  setRole: (role) => set({ role }),
  setPhase: (phase) => set({ phase }),
  setTimeLeft: (value) => set({ timeLeft: Math.max(0, value) }),

  tickTimer: () => {
    const state = get();
    if (state.phase !== 'preparing' && state.phase !== 'hunting') {
      return;
    }
    set({ timeLeft: Math.max(0, state.timeLeft - 1) });
  },

  setCaught: (value) => set({ isCaught: value }),
  setLocalTransform: (position, rotation) => set({ localPosition: position, localRotation: rotation }),

  resetRound: () => {
    set({
      phase: 'preparing',
      timeLeft: get().prepTime,
      pokeballs: 10,
      throwPower: 0,
      isCharging: false,
      activePokeballs: [],
      caughtPokemon: [],
      catchAttemptResult: null,
      escaping: false,
      dodgeCooldown: 0,
      isCaught: false,
    });
  },
}));
