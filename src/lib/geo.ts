import { Checkpoint, RouteCorridor, Waypoint } from '../types';

const R = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Rumbo en grados (0 = norte, 90 = este). */
export function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/** Distancia vial estimada cuando no hay ruteo disponible. */
export function estimateRoadKmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.max(15, Math.round(haversineKm(lat1, lng1, lat2, lng2) * 1.22));
}

const cumCache = new WeakMap<[number, number][], number[]>();

/** Kilómetros acumulados por vértice (cacheado por referencia de trazado). */
export function cumulativeKm(path: [number, number][]): number[] {
  const cached = cumCache.get(path);
  if (cached) return cached;
  const out = [0];
  for (let i = 1; i < path.length; i++) {
    out.push(out[i - 1] + haversineKm(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]));
  }
  cumCache.set(path, out);
  return out;
}

export function pathLengthKm(path: [number, number][]): number {
  const c = cumulativeKm(path);
  return c[c.length - 1] ?? 0;
}

/**
 * Posición a X km del inicio del trazado. Como el trazado simplificado es un poco más corto que
 * la distancia vial real, se escala el km pedido proporcionalmente (km reales → km del trazado).
 */
export function positionAtKm(
  corridor: Pick<RouteCorridor, 'path' | 'totalKm'>,
  km: number
): { lat: number; lng: number; headingDeg: number; index: number } {
  const path = corridor.path;
  if (path.length === 0) return { lat: 0, lng: 0, headingDeg: 0, index: 0 };
  if (path.length === 1) return { lat: path[0][0], lng: path[0][1], headingDeg: 0, index: 0 };
  const cum = cumulativeKm(path);
  const geomLen = cum[cum.length - 1];
  const target = Math.max(0, Math.min(geomLen, (km / Math.max(1, corridor.totalKm)) * geomLen));

  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= target) lo = mid;
    else hi = mid;
  }
  const segLen = cum[hi] - cum[lo];
  const t = segLen > 0 ? (target - cum[lo]) / segLen : 0;
  const [aLat, aLng] = path[lo];
  const [bLat, bLng] = path[hi];
  return {
    lat: aLat + (bLat - aLat) * t,
    lng: aLng + (bLng - aLng) * t,
    headingDeg: bearingDeg(aLat, aLng, bLat, bLng),
    index: lo,
  };
}

/** Divide el trazado en tramo recorrido y tramo pendiente. */
export function splitPathAtKm(
  corridor: Pick<RouteCorridor, 'path' | 'totalKm'>,
  km: number
): { done: [number, number][]; remaining: [number, number][] } {
  const pos = positionAtKm(corridor, km);
  const p: [number, number] = [pos.lat, pos.lng];
  return {
    done: [...corridor.path.slice(0, pos.index + 1), p],
    remaining: [p, ...corridor.path.slice(pos.index + 1)],
  };
}

/** Km (reales) y distancia al trazado del punto más cercano a una coordenada. */
export function projectOnPath(
  corridor: Pick<RouteCorridor, 'path' | 'totalKm'>,
  lat: number,
  lng: number
): { km: number; offKm: number } {
  const path = corridor.path;
  const cum = cumulativeKm(path);
  const geomLen = cum[cum.length - 1] || 1;
  let best = Infinity;
  let bestKm = 0;
  for (let i = 0; i < path.length; i++) {
    const d = haversineKm(lat, lng, path[i][0], path[i][1]);
    if (d < best) {
      best = d;
      bestKm = cum[i];
    }
  }
  return { km: Math.round((bestKm / geomLen) * corridor.totalKm), offKm: best };
}

export function projectKm(corridor: Pick<RouteCorridor, 'path' | 'totalKm'>, lat: number, lng: number): number {
  return projectOnPath(corridor, lat, lng).km;
}

/** Ubica los puntos de referencia sobre el trazado, descartando los que quedan lejos de la ruta. */
export function buildCheckpoints(
  corridor: Pick<RouteCorridor, 'path' | 'totalKm'>,
  points: Waypoint[],
  maxOffKm = 30
): Checkpoint[] {
  return points
    .map((p) => ({ p, proj: projectOnPath(corridor, p.lat, p.lng) }))
    .filter(({ proj }) => proj.offKm <= maxOffKm)
    .map(({ p, proj }) => ({ ...p, km: proj.km }))
    .sort((a, b) => a.km - b.km);
}

/** Etiqueta legible de ubicación según el km recorrido. */
export function locationLabelAtKm(corridor: RouteCorridor, km: number): string {
  const cps = corridor.checkpoints;
  if (cps.length === 0) return corridor.name;
  let nearest = cps[0];
  let best = Infinity;
  for (const cp of cps) {
    const d = Math.abs(cp.km - km);
    if (d < best) {
      best = d;
      nearest = cp;
    }
  }
  if (best < 12) return nearest.label;
  const prev = [...cps].reverse().find((c) => c.km <= km);
  const next = cps.find((c) => c.km > km);
  if (prev && next) return `Entre ${shortName(prev.label)} y ${shortName(next.label)}`;
  return nearest.label;
}

function shortName(label: string) {
  return label.split('·')[0].split(',')[0].trim();
}
