/**
 * Sincronización entre pestañas del mismo navegador (Administración, Chofer y Cliente abiertos a la vez).
 *
 * Una sola pestaña, la "principal", es dueña de los datos: aplica las acciones, corre la simulación GPS,
 * guarda en localStorage y publica cada versión del estado por BroadcastChannel. Las demás le reenvían
 * sus acciones y muestran lo que ella publica. Como en un sistema con servidor, hay una única fuente de
 * verdad y ninguna pestaña pisa los cambios de otra.
 *
 * La principal se elige con Web Locks: si se cierra, otra toma el control sola. Además, la pestaña que
 * se está mirando reclama el control, porque los navegadores frenan (o congelan) los timers de las
 * pestañas en segundo plano.
 */
import type { Action, DemoState } from './store';
import { uid } from '../lib/format';

export const TAB_ID = uid('tab');
export const SYNC_CHANNEL = 'md_logistica_sync';
const LEADER_LOCK = 'md_logistica_leader';

export type SyncMessage =
  /** La principal publica el estado completo. */
  | { kind: 'state'; from: string; state: DemoState }
  /** Una seguidora le pide a la principal que aplique una acción. */
  | { kind: 'action'; from: string; action: Action }
  /** Una seguidora visible pide avanzar la simulación (por si la principal está en segundo plano). */
  | { kind: 'tick'; from: string }
  /** Una pestaña nueva pide el estado actual. */
  | { kind: 'hello'; from: string };

export function tabSyncSupported(): boolean {
  return typeof BroadcastChannel !== 'undefined' && typeof navigator !== 'undefined' && Boolean(navigator.locks);
}

/** Época (momento en que la principal actual tomó el control) y número de cambio dentro de esa época. */
export function versionOf(s: DemoState | null | undefined) {
  return s?.sync ?? { epoch: 0, rev: 0 };
}

export function isNewer(a: DemoState, b: DemoState) {
  const va = versionOf(a);
  const vb = versionOf(b);
  return va.epoch !== vb.epoch ? va.epoch > vb.epoch : va.rev > vb.rev;
}

/**
 * Devuelve `next` reutilizando los objetos de `prev` que no cambiaron. El estado llega clonado desde
 * otra pestaña; sin esto cada camión, viaje o ruta sería un objeto nuevo en cada tick y los efectos que
 * dependen de ellos (mapa, timers) se reiniciarían todo el tiempo.
 */
export function reconcile<T>(prev: T, next: T): T {
  if (Object.is(prev, next)) return prev;
  if (typeof prev !== 'object' || typeof next !== 'object' || prev === null || next === null) return next;
  if (Array.isArray(prev) !== Array.isArray(next)) return next;

  if (Array.isArray(next)) {
    const before = prev as unknown as unknown[];
    const byId = new Map<unknown, unknown>();
    for (const item of before) if (hasId(item)) byId.set(item.id, item);
    let same = before.length === next.length;
    const out = next.map((item, i) => {
      const match = hasId(item) ? byId.get(item.id) : before[i];
      const merged = match === undefined ? item : reconcile(match, item);
      if (merged !== before[i]) same = false;
      return merged;
    });
    return (same ? prev : out) as T;
  }

  const before = prev as Record<string, unknown>;
  const after = next as Record<string, unknown>;
  const keys = Object.keys(after);
  let same = keys.length === Object.keys(before).length;
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    out[k] = reconcile(before[k], after[k]);
    if (out[k] !== before[k] || !(k in before)) same = false;
  }
  return (same ? prev : out) as T;
}

function hasId(x: unknown): x is { id: unknown } {
  return typeof x === 'object' && x !== null && 'id' in x;
}

export interface LeaderElection {
  /** Toma el control aunque otra pestaña lo tenga; esa pestaña pasa a ser seguidora. */
  claim(): void;
  dispose(): void;
}

export function startLeaderElection(onRole: (role: 'leader' | 'follower') => void): LeaderElection {
  const locks = navigator.locks;
  let disposed = false;
  let seq = 0;
  /** Pedido que tiene el lock ahora (0 = ninguno). */
  let heldToken = 0;
  let release: (() => void) | null = null;
  /** Pedido en espera para tomar el control cuando se libere. */
  let queued: AbortController | null = null;

  const report = (role: 'leader' | 'follower') => {
    if (!disposed) onRole(role);
  };

  function acquire(options: LockOptions, waiting?: AbortController, onMiss?: () => void) {
    const token = ++seq;
    let granted = false;
    locks
      .request(LEADER_LOCK, waiting ? { ...options, signal: waiting.signal } : options, (lock) => {
        if (waiting && queued === waiting) queued = null;
        if (!lock) {
          onMiss?.();
          return undefined;
        }
        if (disposed) return undefined; // se libera enseguida
        granted = true;
        heldToken = token;
        report('leader');
        // El lock queda tomado hasta que se cierre la pestaña o lo reclame otra.
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      })
      .catch(() => undefined) // espera cancelada, o el lock lo reclamó otra pestaña
      .then(() => {
        if (!granted || heldToken !== token) return;
        heldToken = 0;
        release = null;
        report('follower');
        enqueue();
      });
  }

  function enqueue() {
    if (disposed || queued || heldToken) return;
    queued = new AbortController();
    acquire({}, queued);
  }

  function cancelQueued() {
    const q = queued;
    queued = null;
    q?.abort();
  }

  acquire({ ifAvailable: true }, undefined, () => {
    report('follower');
    enqueue();
  });

  return {
    claim() {
      if (disposed || heldToken) return;
      cancelQueued();
      acquire({ steal: true });
    },
    dispose() {
      disposed = true;
      cancelQueued();
      release?.();
      release = null;
    },
  };
}
