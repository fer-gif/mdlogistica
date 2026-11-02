import { estimateRoadKmBetween, haversineKm } from './geo';

export interface RoadRoute {
  path: [number, number][];
  km: number;
  approximate: boolean;
}

function perpDist(p: [number, number], a: [number, number], b: [number, number]) {
  const [x, y] = p;
  const [x1, y1] = a;
  const [x2, y2] = b;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

export function simplifyPath(pts: [number, number][], tol = 0.0025): [number, number][] {
  if (pts.length < 3) return pts;
  let max = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max > tol) {
    const l = simplifyPath(pts.slice(0, idx + 1), tol);
    const r = simplifyPath(pts.slice(idx), tol);
    return l.slice(0, -1).concat(r);
  }
  return [pts[0], pts[pts.length - 1]];
}

/**
 * Calcula la ruta vial real entre puntos [lat, lng] usando OSRM (OpenStreetMap, sin API key).
 * Si el servicio no responde, devuelve un trazado aproximado.
 */
export async function fetchRoadRoute(points: [number, number][]): Promise<RoadRoute> {
  const coords = points.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    const json = await res.json();
    if (json.code !== 'Ok' || !json.routes?.[0]) throw new Error('sin ruta');
    const route = json.routes[0];
    const latlng = (route.geometry.coordinates as [number, number][]).map(
      ([lng, lat]) => [Number(lat.toFixed(4)), Number(lng.toFixed(4))] as [number, number]
    );
    return { path: simplifyPath(latlng), km: Math.round(route.distance / 1000), approximate: false };
  } catch {
    return approximateRoute(points);
  }
}

export function approximateRoute(points: [number, number][]): RoadRoute {
  const path: [number, number][] = [];
  let km = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [aLat, aLng] = points[i];
    const [bLat, bLng] = points[i + 1];
    km += estimateRoadKmBetween(aLat, aLng, bLat, bLng);
    const steps = Math.max(2, Math.round(haversineKm(aLat, aLng, bLat, bLng) / 40));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      path.push([aLat + (bLat - aLat) * t, aLng + (bLng - aLng) * t]);
    }
  }
  path.push(points[points.length - 1]);
  return { path, km, approximate: true };
}
