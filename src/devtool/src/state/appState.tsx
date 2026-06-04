import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { PropsWithChildren } from 'react';
import { createInitialState, appReducer } from './reducer';
import type { AppAction, AppState } from './types';
import { loadStoredState, saveStoredState } from '../services/storage';

const AppStateContext = createContext<AppState | null>(null);
const AppDispatchContext = createContext<React.Dispatch<AppAction> | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
  const stored = useMemo(() => loadStoredState(), []);
  const useStoredState = !stored.migrationNeeded && !stored.corrupted;
  const initialSeed = {
    migrationNeeded: stored.migrationNeeded,
    migrationSourceVersion: stored.migrationSourceVersion,
    ...(useStoredState && stored.stored.options ? { options: stored.stored.options } : {}),
    ...(useStoredState && stored.stored.forms ? { forms: stored.stored.forms } : {}),
    wallet: useStoredState ? stored.stored.wallet || null : null,
    customAssets: useStoredState ? stored.stored.customAssets || {} : {},
  };
  const [state, dispatch] = useReducer(
    appReducer,
    createInitialState(initialSeed),
  );

  useEffect(() => {
    document.documentElement.dataset.bsTheme = state.options.theme;
    document.documentElement.dataset.theme = state.options.theme;
    saveStoredState(state);
  }, [state]);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>{children}</AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}

export function useAppDispatch(): React.Dispatch<AppAction> {
  const value = useContext(AppDispatchContext);
  if (!value) throw new Error('useAppDispatch must be used inside AppStateProvider');
  return value;
}
