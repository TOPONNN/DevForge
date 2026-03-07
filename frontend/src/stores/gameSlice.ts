import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  POKEMON_SPECIES,
  type ActivePokeball,
  type CatchAnimData,
  type CatchResult,
  type CatchResultPayload,
  type GamePhase,
  type PlayerRole,
  type PokemonSpecies,
  type ThrowData,
  type Vector3Tuple,
} from '../types/game';
import type { AppThunk } from './store';

interface CatchAttemptResult {
  result: CatchResult;
  pokemonName: string;
}

export interface GameState {
  phase: GamePhase;
  role: PlayerRole;
  cameraMode: 'first-person' | 'third-person';
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
  trainerSanity: number;
  pokemonHunger: number;
  isDisoriented: boolean;
  disorientedTimer: number;
  localPosition: Vector3Tuple;
  localRotation: [number, number, number];
  catchAnim: CatchAnimData | null;
  pendingCatchResult: CatchResultPayload | null;
  catchAnimPhase: 'idle' | 'animating' | 'result';
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const initialState: GameState = {
  phase: 'lobby',
  role: 'pokemon',
  cameraMode: 'first-person',
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
  trainerSanity: 100,
  pokemonHunger: 100,
  isDisoriented: false,
  disorientedTimer: 0,
  localPosition: [0, 1.1, 8],
  localRotation: [0, 0, 0],
  catchAnim: null,
  pendingCatchResult: null,
  catchAnimPhase: 'idle',
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    startChargeInternal(state) {
      state.isCharging = true;
      state.throwPower = 0;
    },
    setChargePowerInternal(state, action: PayloadAction<number>) {
      state.throwPower = clamp01(action.payload);
    },
    releaseThrowSuccess(state, action: PayloadAction<ActivePokeball>) {
      state.isCharging = false;
      state.throwPower = 0;
      state.pokeballs = Math.max(0, state.pokeballs - 1);
      state.activePokeballs.push(action.payload);
    },
    setPokeballState(state, action: PayloadAction<{ id: string; state: ActivePokeball['state'] }>) {
      const pokeball = state.activePokeballs.find((ball) => ball.id === action.payload.id);
      if (pokeball) {
        pokeball.state = action.payload.state;
      }
    },
    updatePokeballPosition(
      state,
      action: PayloadAction<{ id: string; position: Vector3Tuple; velocity: Vector3Tuple }>,
    ) {
      const pokeball = state.activePokeballs.find((ball) => ball.id === action.payload.id);
      if (pokeball) {
        pokeball.position = action.payload.position;
        pokeball.velocity = action.payload.velocity;
      }
    },
    removePokeball(state, action: PayloadAction<string>) {
      state.activePokeballs = state.activePokeballs.filter((ball) => ball.id !== action.payload);
    },
    registerCatch(state, action: PayloadAction<{ pokemonId: string; pokemonName: string }>) {
      const { pokemonId, pokemonName } = action.payload;
      if (!state.caughtPokemon.includes(pokemonId)) {
        state.caughtPokemon.push(pokemonId);
      }
      state.catchAttemptResult = { result: 'caught', pokemonName };
    },
    registerEscape(state, action: PayloadAction<string>) {
      state.catchAttemptResult = { result: 'escaped', pokemonName: action.payload };
      state.escaping = true;
    },
    selectSpecies(state, action: PayloadAction<PokemonSpecies>) {
      state.selectedSpecies = action.payload;
    },
    setPokeballCount(state, action: PayloadAction<number>) {
      state.pokeballs = Math.max(0, Math.floor(action.payload));
    },
    setEscaping(state, action: PayloadAction<boolean>) {
      state.escaping = action.payload;
    },
    setDodgeCooldown(state, action: PayloadAction<number>) {
      state.dodgeCooldown = Math.max(0, action.payload);
    },
    clearCatchAttemptResult(state) {
      state.catchAttemptResult = null;
    },
    setRole(state, action: PayloadAction<PlayerRole>) {
      state.role = action.payload;
    },
    toggleCameraMode(state) {
      state.cameraMode = state.cameraMode === 'first-person' ? 'third-person' : 'first-person';
    },
    setPhase(state, action: PayloadAction<GamePhase>) {
      state.phase = action.payload;
    },
    setTimeLeft(state, action: PayloadAction<number>) {
      state.timeLeft = Math.max(0, action.payload);
    },
    tickTimer(state) {
      if (state.phase !== 'preparing' && state.phase !== 'hunting') {
        return;
      }
      state.timeLeft = Math.max(0, state.timeLeft - 1);
    },
    setCaught(state, action: PayloadAction<boolean>) {
      state.isCaught = action.payload;
    },
    setTrainerSanity(state, action: PayloadAction<number>) {
      state.trainerSanity = clampPercent(action.payload);
    },
    setPokemonHunger(state, action: PayloadAction<number>) {
      state.pokemonHunger = clampPercent(action.payload);
    },
    setDisoriented(state, action: PayloadAction<number>) {
      const timer = Math.max(0, action.payload);
      state.isDisoriented = timer > 0;
      state.disorientedTimer = timer;
    },
    tickDisoriented(state, action: PayloadAction<number>) {
      const delta = action.payload;
      if (delta <= 0 || !state.isDisoriented) {
        return;
      }
      const nextTimer = Math.max(0, state.disorientedTimer - delta);
      state.disorientedTimer = nextTimer;
      state.isDisoriented = nextTimer > 0;
    },
    setLocalTransform(state, action: PayloadAction<{ position: Vector3Tuple; rotation: [number, number, number] }>) {
      state.localPosition = action.payload.position;
      state.localRotation = action.payload.rotation;
    },
    startCatchAnim(state, action: PayloadAction<{ ballPos: Vector3Tuple; pokemonPos: Vector3Tuple; pokemonId: string }>) {
      const { ballPos, pokemonPos, pokemonId } = action.payload;
      state.catchAnim = {
        id: `catch-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        ballPosition: ballPos,
        pokemonPosition: pokemonPos,
        pokemonId,
        startTime: performance.now(),
      };
      state.catchAnimPhase = 'animating';
    },
    setPendingCatchResult(state, action: PayloadAction<CatchResultPayload>) {
      state.pendingCatchResult = action.payload;
    },
    clearPendingCatchResult(state) {
      state.pendingCatchResult = null;
    },
    setCatchAnimPhase(state, action: PayloadAction<'idle' | 'animating' | 'result'>) {
      state.catchAnimPhase = action.payload;
    },
    clearCatchAnim(state) {
      state.catchAnim = null;
      state.catchAnimPhase = 'idle';
      state.pendingCatchResult = null;
    },
    resetRound(state) {
      state.phase = 'preparing';
      state.cameraMode = 'first-person';
      state.timeLeft = state.prepTime;
      state.pokeballs = 10;
      state.throwPower = 0;
      state.isCharging = false;
      state.activePokeballs = [];
      state.caughtPokemon = [];
      state.catchAttemptResult = null;
      state.escaping = false;
      state.dodgeCooldown = 0;
      state.isCaught = false;
      state.trainerSanity = 100;
      state.pokemonHunger = 100;
      state.isDisoriented = false;
      state.disorientedTimer = 0;
      state.catchAnim = null;
      state.pendingCatchResult = null;
      state.catchAnimPhase = 'idle';
    },
  },
});

export const startCharge = (): AppThunk => (dispatch, getState) => {
  const state = getState().game;
  if (state.role !== 'trainer' || state.pokeballs <= 0 || state.phase !== 'hunting') {
    return;
  }
  dispatch(gameSlice.actions.startChargeInternal());
};

export const setChargePower = (value: number): AppThunk => (dispatch, getState) => {
  if (!getState().game.isCharging) {
    return;
  }
  dispatch(gameSlice.actions.setChargePowerInternal(value));
};

export const releaseThrow = (throwData: ThrowData, ownerId: string): AppThunk<ActivePokeball | null> => (dispatch, getState) => {
  const state = getState().game;
  if (state.role !== 'trainer' || state.pokeballs <= 0 || state.phase !== 'hunting') {
    return null;
  }

  const velocityScale = 12 + throwData.power * 15;
  const pokeball: ActivePokeball = {
    id: `pokeball-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    ownerId,
    state: 'flying',
    position: throwData.origin,
    velocity: [
      throwData.direction[0] * velocityScale,
      throwData.direction[1] * velocityScale,
      throwData.direction[2] * velocityScale,
    ],
    createdAt: Date.now(),
    targetId: throwData.pokemonTarget,
  };

  dispatch(gameSlice.actions.releaseThrowSuccess(pokeball));
  return pokeball;
};

export const dodge = (): AppThunk<boolean> => (dispatch, getState) => {
  const state = getState().game;
  if (state.dodgeCooldown > 0 || state.phase !== 'hunting' || state.isCaught) {
    return false;
  }
  dispatch(gameSlice.actions.setDodgeCooldown(5));
  return true;
};

export const registerEscapeWithTimeout = (pokemonName: string): AppThunk => (dispatch) => {
  dispatch(gameSlice.actions.registerEscape(pokemonName));
  window.setTimeout(() => {
    dispatch(gameSlice.actions.setEscaping(false));
  }, 3000);
};

export const gameActions = gameSlice.actions;
export default gameSlice.reducer;
