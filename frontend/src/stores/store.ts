import { configureStore, type Action, type ThunkAction } from '@reduxjs/toolkit';
import gameReducer from './gameSlice';
import networkReducer from './networkSlice';

export const store = configureStore({
  reducer: {
    game: gameReducer,
    network: networkReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, Action>;
