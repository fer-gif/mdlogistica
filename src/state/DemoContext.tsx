import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Action, DemoState, loadState, readStoredState, reducer, saveState, TICK_MS } from './store';
import { OfflineQueuedAction } from '../types';
import { uid } from '../lib/format';
import {
  isNewer,
  reconcile,
  startLeaderElection,
  SYNC_CHANNEL,
  SyncMessage,
  TAB_ID,
  tabSyncSupported,
  versionOf,
} from './tabSync';

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

/** Rol de esta pestaña en la sincronización (ver tabSync.ts). */
type Role = 'pending' | 'leader' | 'follower';

type InternalAction =
  | Action
  /** Seguidora: estado publicado por la pestaña principal. */
  | { type: '__ACCEPT'; state: DemoState }
  /** Esta pestaña pasa a ser la principal. */
  | { type: '__TAKEOVER'; stored: DemoState | null };

function syncReducer(s: DemoState, a: InternalAction): DemoState {
  switch (a.type) {
    case '__ACCEPT':
      return isNewer(s, a.state) ? s : reconcile(s, a.state);
    case '__TAKEOVER': {
      // Arranca de lo más nuevo que conoce (su copia en memoria o lo guardado) con una época nueva:
      // así cualquier mensaje tardío de la principal anterior queda viejo y se descarta.
      const base = a.stored && isNewer(a.stored, s) ? a.stored : s;
      const v = versionOf(base);
      return { ...base, sync: { epoch: Math.max(Date.now(), versionOf(s).epoch + 1, v.epoch + 1), rev: v.rev + 1 } };
    }
    default: {
      const next = reducer(s, a);
      if (next === s) return s;
      const v = versionOf(s);
      return { ...next, sync: { epoch: v.epoch, rev: v.rev + 1 } };
    }
  }
}

const Ctx = createContext<DemoContextValue | null>(null);

const SYNC_ON = tabSyncSupported();

export function DemoProvider({ children, simulate }: { children: React.ReactNode; simulate: boolean }) {
  const [state, apply] = useReducer(syncReducer, undefined, loadState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Sin BroadcastChannel / Web Locks la pestaña funciona sola, como antes.
  const roleRef = useRef<Role>(SYNC_ON ? 'pending' : 'leader');
  const [isLeader, setIsLeader] = useState(!SYNC_ON);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const pendingRef = useRef<Action[]>([]);
  const lastTickRef = useRef(Date.now());

  const post = useCallback((msg: SyncMessage) => {
    try {
      channelRef.current?.postMessage(msg);
    } catch {
      // canal cerrado
    }
  }, []);

  const tick = useCallback(() => {
    const now = Date.now();
    const dt = now - lastTickRef.current;
    // Pueden llegar casi juntos el timer propio y el pedido de otra pestaña: se respeta el ritmo de TICK_MS.
    if (dt < TICK_MS * 0.6) return;
    lastTickRef.current = now;
    // Si la pestaña estuvo en segundo plano se limita el salto para no "teletransportar" camiones.
    apply({ type: 'TICK', dtMs: Math.min(dt, TICK_MS * 4) });
  }, []);

  /** La principal aplica la acción; las seguidoras se la mandan a ella. */
  const dispatch = useCallback(
    (action: Action) => {
      switch (roleRef.current) {
        case 'leader':
          apply(action);
          break;
        case 'follower':
          post({ kind: 'action', from: TAB_ID, action });
          break;
        default:
          pendingRef.current.push(action);
      }
    },
    [post]
  );

  // Sincronización entre pestañas
  useEffect(() => {
    if (!SYNC_ON) return;
    const channel = new BroadcastChannel(SYNC_CHANNEL);
    channelRef.current = channel;

    channel.onmessage = (e: MessageEvent<SyncMessage>) => {
      const msg = e.data;
      if (!msg || msg.from === TAB_ID) return;
      const leader = roleRef.current === 'leader';
      switch (msg.kind) {
        case 'state':
          if (!leader) apply({ type: '__ACCEPT', state: msg.state });
          break;
        case 'action':
          if (leader) apply(msg.action);
          break;
        case 'tick':
          if (leader) tick();
          break;
        case 'hello':
          if (leader) post({ kind: 'state', from: TAB_ID, state: stateRef.current });
          break;
      }
    };

    const election = startLeaderElection((role) => {
      if (role === 'leader') {
        if (roleRef.current === 'leader') return;
        roleRef.current = 'leader';
        apply({ type: '__TAKEOVER', stored: readStoredState() });
        lastTickRef.current = Date.now();
        setIsLeader(true);
      } else {
        roleRef.current = 'follower';
        setIsLeader(false);
        post({ kind: 'hello', from: TAB_ID });
      }
      const pending = pendingRef.current;
      pendingRef.current = [];
      pending.forEach(dispatch);
    });

    // La pestaña que se está mirando toma el control. La espera inicial deja llegar primero el estado actual.
    let claimTimer: number | undefined;
    const claimSoon = (delay: number) => {
      window.clearTimeout(claimTimer);
      claimTimer = window.setTimeout(() => {
        if (document.visibilityState === 'visible') election.claim();
      }, delay);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') claimSoon(150);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    if (document.visibilityState === 'visible') claimSoon(600);

    const onPageHide = () => {
      if (roleRef.current === 'leader') saveState(stateRef.current);
    };
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.clearTimeout(claimTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pagehide', onPageHide);
      election.dispose();
      channel.close();
      channelRef.current = null;
      roleRef.current = 'pending';
      setIsLeader(false);
    };
  }, [dispatch, post, tick]);

  // La principal publica cada versión del estado a las demás pestañas.
  useEffect(() => {
    if (isLeader) post({ kind: 'state', from: TAB_ID, state });
  }, [state, isLeader, post]);

  // Motor de simulación GPS: lo corre la principal; una seguidora visible le pide que avance.
  useEffect(() => {
    if (!simulate) return;
    lastTickRef.current = Date.now();
    const id = setInterval(() => {
      if (roleRef.current === 'leader') tick();
      else if (roleRef.current === 'follower' && document.visibilityState === 'visible') {
        post({ kind: 'tick', from: TAB_ID });
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [simulate, tick, post]);

  // Persistencia (con pequeño debounce). Solo guarda la principal, así las pestañas no se pisan.
  useEffect(() => {
    if (!isLeader) return;
    const t = setTimeout(() => saveState(stateRef.current), 250);
    return () => clearTimeout(t);
  }, [state, isLeader]);

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
    [state, dispatch]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDemo fuera de DemoProvider');
  return v;
}
