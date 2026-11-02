import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { Action, DemoState, loadState, reducer, saveState, TICK_MS } from './store';
import { OfflineQueuedAction } from '../types';
import { uid } from '../lib/format';

interface DemoContextValue {
  state: DemoState;
  dispatch: React.Dispatch<Action>;
  /**
   * Acciones del chofer: si la app está sin señal se guardan en la cola offline
   * y se sincronizan solas al reconectar.
   */
  driverAction: (
    item: DistributiveOmit<OfflineQueuedAction, 'id' | 'createdAt'>
  ) => 'sent' | 'queued';
}

type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;

const Ctx = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children, simulate }: { children: React.ReactNode; simulate: boolean }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Motor de simulación GPS
  useEffect(() => {
    if (!simulate) return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      // Si la pestaña estuvo en segundo plano se limita el salto para no "teletransportar" camiones.
      const dt = Math.min(now - last, TICK_MS * 4);
      last = now;
      dispatch({ type: 'TICK', dtMs: dt });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [simulate]);

  // Persistencia (con pequeño debounce)
  useEffect(() => {
    const t = setTimeout(() => saveState(stateRef.current), 800);
    return () => clearTimeout(t);
  }, [state]);

  const value = useMemo<DemoContextValue>(
    () => ({
      state,
      dispatch,
      driverAction: (item) => {
        if (stateRef.current.isOffline) {
          dispatch({
            type: 'QUEUE_OFFLINE',
            item: { ...item, id: uid('off'), createdAt: Date.now() } as OfflineQueuedAction,
          });
          return 'queued';
        }
        switch (item.type) {
          case 'start_trip':
            dispatch({ type: 'START_TRIP', tripId: item.tripId });
            break;
          case 'arrive':
            dispatch({ type: 'ARRIVE', tripId: item.tripId });
            break;
          case 'upload_remito':
            dispatch({
              type: 'UPLOAD_REMITO',
              tripId: item.tripId,
              receiverName: item.receiverName,
              receiverDni: item.receiverDni,
              photoDataUrl: item.photoDataUrl,
            });
            break;
          case 'add_expense':
            dispatch({
              type: 'ADD_EXPENSE',
              tripId: item.tripId,
              category: item.category,
              amountArs: item.amountArs,
              note: item.note,
              photoDataUrl: item.photoDataUrl,
            });
            break;
        }
        return 'sent';
      },
    }),
    [state]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDemo fuera de DemoProvider');
  return v;
}
