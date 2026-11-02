// Genera src/data/routeGeometries.ts con trazados reales (OSRM) simplificados.
import { writeFileSync } from 'node:fs';

const OUT = process.argv[2];

const CORRIDORS = {
  'corridor-libres-pilar': [[-57.0878, -29.7125], [-58.0209, -31.393], [-58.9142, -34.4556]],
  'corridor-cba-libres': [[-64.1888, -31.4201], [-60.7, -31.6333], [-58.0544, -29.7917], [-57.0878, -29.7125]],
  'corridor-rosario-libres': [[-60.6505, -32.9442], [-60.1558, -32.6177], [-58.0209, -31.393], [-57.0878, -29.7125]],
  'corridor-libres-posadas': [[-57.0878, -29.7125], [-56.0406, -28.5494], [-55.8961, -27.3671]],
  'corridor-mza-libres': [[-68.8458, -32.8895], [-66.3378, -33.3017], [-64.3493, -33.1232], [-60.7, -31.6333], [-58.0209, -31.393], [-57.0878, -29.7125]],
  'corridor-libres-poa': [[-57.0878, -29.7125], [-57.0882, -29.7547], [-55.7919, -29.7831], [-51.2177, -30.0346]],
};

function perpDist(p, a, b) {
  const [x, y] = p, [x1, y1] = a, [x2, y2] = b;
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > max) { max = d; idx = i; }
  }
  if (max > tol) {
    const l = simplify(pts.slice(0, idx + 1), tol);
    const r = simplify(pts.slice(idx), tol);
    return l.slice(0, -1).concat(r);
  }
  return [pts[0], pts[pts.length - 1]];
}

const result = {};
for (const [id, pts] of Object.entries(CORRIDORS)) {
  const coords = pts.map((p) => p.join(',')).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.code !== 'Ok') throw new Error(id + ' ' + json.code);
  const r = json.routes[0];
  const simplified = simplify(r.geometry.coordinates, 0.0025).map(([lng, lat]) => [
    Number(lat.toFixed(4)),
    Number(lng.toFixed(4)),
  ]);
  result[id] = { km: Math.round(r.distance / 1000), hours: Math.round((r.duration / 3600) * 10) / 10, path: simplified };
  console.log(id, result[id].km, 'km', result[id].hours, 'h', r.geometry.coordinates.length, '->', simplified.length, 'pts');
  await new Promise((ok) => setTimeout(ok, 1200));
}

const body =
  '// Archivo generado: trazados reales por ruta (OSRM / OpenStreetMap), simplificados.\n' +
  '// No editar a mano. Formato de cada punto: [lat, lng].\n\n' +
  'export const ROUTE_GEOMETRIES: Record<string, { km: number; hours: number; path: [number, number][] }> = ' +
  JSON.stringify(result) +
  ';\n';
writeFileSync(OUT, body);
console.log('OK ->', OUT, (body.length / 1024).toFixed(1), 'KB');
