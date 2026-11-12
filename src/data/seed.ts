import {
  ClientAccount,
  DemoUser,
  DestinationNode,
  DriverProfile,
  FleetMessage,
  RouteCorridor,
  RouteExpense,
  SystemNotification,
  Trip,
  TripStage,
  TruckUnit,
  Waypoint,
} from '../types';
import { ROUTE_GEOMETRIES } from './routeGeometries';
import { buildCheckpoints, locationLabelAtKm, positionAtKm, projectKm } from '../lib/geo';
import { AVG_TRUCK_SPEED_KMH, USD_ARS_RATE } from '../lib/format';

export const STAGE_META: Record<TripStage, { label: string; short: string; step: number }> = {
  pending_assignment: { label: 'Sin cubrir · Pendiente de despacho', short: 'Sin cubrir', step: 0 },
  assigned: { label: 'Unidad asignada · En carga en origen', short: 'En carga', step: 1 },
  in_transit: { label: 'En tránsito', short: 'En tránsito', step: 2 },
  customs: { label: 'En aduana · Trámite de frontera', short: 'En aduana', step: 2 },
  nearing_destination: { label: 'Próximo a destino', short: 'Por descargar', step: 3 },
  unloading: { label: 'En destino · Descargando', short: 'Descargando', step: 4 },
  delivered: { label: 'Entregado · Remito conformado', short: 'Entregado', step: 5 },
};

export const TRUCK_STATUS_META: Record<TruckUnit['status'], { label: string; color: string; soft: string; text: string }> = {
  disponible: { label: 'Disponible', color: '#52525B', soft: 'bg-zinc-100', text: 'text-zinc-700' },
  en_carga: { label: 'En carga', color: '#2563EB', soft: 'bg-blue-50', text: 'text-blue-700' },
  en_ruta: { label: 'En ruta', color: '#059669', soft: 'bg-emerald-50', text: 'text-emerald-700' },
  en_aduana: { label: 'En aduana', color: '#7C3AED', soft: 'bg-violet-50', text: 'text-violet-700' },
  descargando: { label: 'Descargando', color: '#EA7A0C', soft: 'bg-orange-50', text: 'text-orange-700' },
};

export const DEMO_USERS: DemoUser[] = [
  { username: 'administracion', password: 'mdlogistica2026', role: 'admin', displayName: 'Operaciones MD' },
  { username: 'chofer', password: 'chofer2026', role: 'driver', displayName: 'Rubén Gómez', truckId: 'truck-104' },
  { username: 'arcor', password: 'cliente2026', role: 'client', displayName: 'Arcor S.A.I.C.', clientId: 'cli-arcor' },
];

export const MD_BASE = { lat: -29.7125, lng: -57.0878, label: 'Base MD Logística · Paso de los Libres' };

export const ARGENTINA_BOUNDS: [[number, number], [number, number]] = [
  [-55.2, -73.6],
  [-21.7, -50.5],
];

export const PROVINCES: { name: string; country: 'AR' | 'BR'; lat: number; lng: number }[] = [
  { name: 'Corrientes', country: 'AR', lat: -27.4692, lng: -58.8306 },
  { name: 'Buenos Aires', country: 'AR', lat: -34.6037, lng: -58.3816 },
  { name: 'Santa Fe', country: 'AR', lat: -31.6333, lng: -60.7 },
  { name: 'Córdoba', country: 'AR', lat: -31.4201, lng: -64.1888 },
  { name: 'Entre Ríos', country: 'AR', lat: -31.732, lng: -60.5238 },
  { name: 'Misiones', country: 'AR', lat: -27.3671, lng: -55.8961 },
  { name: 'Chaco', country: 'AR', lat: -27.4514, lng: -58.9867 },
  { name: 'Mendoza', country: 'AR', lat: -32.8895, lng: -68.8458 },
  { name: 'Tucumán', country: 'AR', lat: -26.8083, lng: -65.2176 },
  { name: 'Salta', country: 'AR', lat: -24.7821, lng: -65.4232 },
  { name: 'Neuquén', country: 'AR', lat: -38.9516, lng: -68.0591 },
  { name: 'San Luis', country: 'AR', lat: -33.3017, lng: -66.3378 },
  { name: 'Rio Grande do Sul', country: 'BR', lat: -30.0346, lng: -51.2177 },
  { name: 'Santa Catarina', country: 'BR', lat: -27.5954, lng: -48.548 },
  { name: 'Paraná', country: 'BR', lat: -25.4284, lng: -49.2733 },
  { name: 'São Paulo', country: 'BR', lat: -23.5505, lng: -46.6333 },
];

export const INITIAL_DESTINATIONS: DestinationNode[] = [
  { id: 'dest-libres', name: 'Base MD Paso de los Libres', province: 'Corrientes', country: 'AR', addressNote: 'Base operativa y depósito fiscal · RN 117', lat: -29.7125, lng: -57.0878, kind: 'base' },
  { id: 'dest-uruguaiana', name: 'Depósito MD Uruguaiana', province: 'Rio Grande do Sul', country: 'BR', addressNote: 'Depósito fronterizo · BR-290', lat: -29.7547, lng: -57.0882, kind: 'deposito' },
  { id: 'dest-pilar', name: 'Parque Industrial Pilar', province: 'Buenos Aires', country: 'AR', addressNote: 'Panamericana Km 60', lat: -34.4556, lng: -58.9142, kind: 'planta' },
  { id: 'dest-zarate', name: 'Terminal Zárate', province: 'Buenos Aires', country: 'AR', addressNote: 'RN 9 · Acceso puerto', lat: -34.0981, lng: -59.0286, kind: 'puerto' },
  { id: 'dest-rosario', name: 'Nodo Logístico Rosario', province: 'Santa Fe', country: 'AR', addressNote: 'Circunvalación · Zona portuaria', lat: -32.9442, lng: -60.6505, kind: 'puerto' },
  { id: 'dest-cordoba', name: 'Polo Industrial Córdoba', province: 'Córdoba', country: 'AR', addressNote: 'Ferreyra · RN 9', lat: -31.4201, lng: -64.1888, kind: 'planta' },
  { id: 'dest-posadas', name: 'Parque Industrial Posadas', province: 'Misiones', country: 'AR', addressNote: 'RN 12 / RN 14', lat: -27.3671, lng: -55.8961, kind: 'planta' },
  { id: 'dest-resistencia', name: 'Nodo Logístico Resistencia', province: 'Chaco', country: 'AR', addressNote: 'RN 16 · Parque Industrial', lat: -27.4514, lng: -58.9867, kind: 'planta' },
  { id: 'dest-mendoza', name: 'Luján de Cuyo', province: 'Mendoza', country: 'AR', addressNote: 'Parque Industrial · RN 7', lat: -32.8895, lng: -68.8458, kind: 'planta' },
  { id: 'dest-poa', name: 'Centro de Distribución Porto Alegre', province: 'Rio Grande do Sul', country: 'BR', addressNote: 'BR-290 / BR-116 · Canoas', lat: -30.0346, lng: -51.2177, kind: 'planta' },
];

const BRIDGE = { lat: -29.7395, lng: -57.0905 };

const CORRIDOR_DEFS: {
  id: string;
  name: string;
  originId: string;
  destinationId: string;
  international?: boolean;
  checkpoints: Waypoint[];
}[] = [
  {
    id: 'corridor-libres-pilar',
    name: 'Paso de los Libres → Pilar (RN 14)',
    originId: 'dest-libres',
    destinationId: 'dest-pilar',
    checkpoints: [
      { lat: -29.7125, lng: -57.0878, label: 'Base MD · Paso de los Libres' },
      { lat: -30.2536, lng: -57.6363, label: 'Monte Caseros · RN 14' },
      { lat: -30.7589, lng: -57.9839, label: 'Chajarí · RN 14' },
      { lat: -31.393, lng: -58.0209, label: 'Concordia · RN 14' },
      { lat: -32.2236, lng: -58.1428, label: 'Colón · RN 14' },
      { lat: -32.4847, lng: -58.2322, label: 'Concepción del Uruguay · RN 14' },
      { lat: -33.0094, lng: -58.5172, label: 'Gualeguaychú · RN 14' },
      { lat: -33.9, lng: -58.85, label: 'Puente Zárate–Brazo Largo' },
      { lat: -34.0981, lng: -59.0286, label: 'Zárate · RN 9' },
      { lat: -34.4556, lng: -58.9142, label: 'Parque Industrial Pilar' },
    ],
  },
  {
    id: 'corridor-cba-libres',
    name: 'Córdoba → Paso de los Libres (RN 19 / Túnel)',
    originId: 'dest-cordoba',
    destinationId: 'dest-libres',
    checkpoints: [
      { lat: -31.4201, lng: -64.1888, label: 'Polo Industrial Córdoba' },
      { lat: -31.428, lng: -62.0827, label: 'San Francisco · RN 19' },
      { lat: -31.6333, lng: -60.7, label: 'Santa Fe · Túnel Subfluvial' },
      { lat: -31.732, lng: -60.5238, label: 'Paraná · Entre Ríos' },
      { lat: -30.954, lng: -58.783, label: 'Federal · Entre Ríos' },
      { lat: -29.7917, lng: -58.0544, label: 'Curuzú Cuatiá · Corrientes' },
      { lat: -29.7125, lng: -57.0878, label: 'Base MD · Paso de los Libres' },
    ],
  },
  {
    id: 'corridor-rosario-libres',
    name: 'Rosario → Paso de los Libres (Victoria)',
    originId: 'dest-rosario',
    destinationId: 'dest-libres',
    checkpoints: [
      { lat: -32.9442, lng: -60.6505, label: 'Nodo Logístico Rosario' },
      { lat: -32.6177, lng: -60.1558, label: 'Victoria · Entre Ríos' },
      { lat: -32.3933, lng: -59.7889, label: 'Nogoyá · RN 12' },
      { lat: -31.85, lng: -59.02, label: 'Villaguay · RN 18' },
      { lat: -31.393, lng: -58.0209, label: 'Concordia · RN 14' },
      { lat: -30.7589, lng: -57.9839, label: 'Chajarí · RN 14' },
      { lat: -29.7125, lng: -57.0878, label: 'Base MD · Paso de los Libres' },
    ],
  },
  {
    id: 'corridor-libres-posadas',
    name: 'Paso de los Libres → Posadas (RN 14 Norte)',
    originId: 'dest-libres',
    destinationId: 'dest-posadas',
    checkpoints: [
      { lat: -29.7125, lng: -57.0878, label: 'Base MD · Paso de los Libres' },
      { lat: -29.1, lng: -56.55, label: 'Alvear · RN 14' },
      { lat: -28.5494, lng: -56.0406, label: 'Santo Tomé · RN 14' },
      { lat: -28.05, lng: -56.02, label: 'Gobernador Virasoro · RN 14' },
      { lat: -27.3671, lng: -55.8961, label: 'Parque Industrial Posadas' },
    ],
  },
  {
    id: 'corridor-mza-libres',
    name: 'Mendoza → Paso de los Libres (RN 7 / RN 19)',
    originId: 'dest-mendoza',
    destinationId: 'dest-libres',
    checkpoints: [
      { lat: -32.8895, lng: -68.8458, label: 'Luján de Cuyo · Mendoza' },
      { lat: -33.08, lng: -68.47, label: 'San Martín · RN 7' },
      { lat: -33.3017, lng: -66.3378, label: 'San Luis · RN 7' },
      { lat: -33.675, lng: -65.4578, label: 'Villa Mercedes · RN 7' },
      { lat: -33.1232, lng: -64.3493, label: 'Río Cuarto · Córdoba' },
      { lat: -31.6333, lng: -60.7, label: 'Santa Fe · Túnel Subfluvial' },
      { lat: -31.393, lng: -58.0209, label: 'Concordia · RN 14' },
      { lat: -29.7125, lng: -57.0878, label: 'Base MD · Paso de los Libres' },
    ],
  },
  {
    id: 'corridor-libres-poa',
    name: 'Paso de los Libres → Porto Alegre (BR-290)',
    originId: 'dest-libres',
    destinationId: 'dest-poa',
    international: true,
    checkpoints: [
      { lat: -29.7125, lng: -57.0878, label: 'Base MD · Paso de los Libres' },
      { lat: BRIDGE.lat, lng: BRIDGE.lng, label: 'Puente Internacional · Aduana Integrada' },
      { lat: -29.7547, lng: -57.0882, label: 'Uruguaiana · RS' },
      { lat: -29.7831, lng: -55.7919, label: 'Alegrete · BR-290' },
      { lat: -30.2583, lng: -54.9142, label: 'Rosário do Sul · BR-290' },
      { lat: -30.3364, lng: -54.32, label: 'São Gabriel · BR-290' },
      { lat: -30.04, lng: -52.89, label: 'Cachoeira do Sul · BR-290' },
      { lat: -30.0346, lng: -51.2177, label: 'Porto Alegre · RS' },
    ],
  },
];

function destLabel(id: string) {
  const d = INITIAL_DESTINATIONS.find((x) => x.id === id)!;
  return `${d.name}, ${d.province}`;
}

export const INITIAL_CORRIDORS: RouteCorridor[] = CORRIDOR_DEFS.map((def) => {
  const geo = ROUTE_GEOMETRIES[def.id];
  const base = { path: geo.path, totalKm: geo.km };
  const corridor: RouteCorridor = {
    id: def.id,
    name: def.name,
    originId: def.originId,
    destinationId: def.destinationId,
    origin: destLabel(def.originId),
    destination: destLabel(def.destinationId),
    totalKm: geo.km,
    estimatedHours: Math.round((geo.km / AVG_TRUCK_SPEED_KMH) * 10) / 10,
    international: Boolean(def.international),
    path: geo.path,
    checkpoints: buildCheckpoints(base, def.checkpoints),
  };
  if (def.international) corridor.borderKm = Math.max(2, projectKm(base, BRIDGE.lat, BRIDGE.lng));
  return corridor;
});

export const INITIAL_CLIENTS: ClientAccount[] = [
  { id: 'cli-arcor', name: 'Arcor S.A.I.C.', taxId: 'CUIT 30-50279317-5', country: 'AR', contactName: 'Lucía Fernández · Logística', email: 'logistica@cliente-demo.com.ar', phone: '+54 9 351 555-0142', ratePerKmUsd: 3.6, paymentTermsDays: 30 },
  { id: 'cli-frigo', name: 'Frigorífico Litoral S.A.', taxId: 'CUIT 30-68914022-9', country: 'AR', contactName: 'Martín Sosa · Expedición', email: 'expedicion@cliente-demo.com.ar', phone: '+54 9 379 555-0188', ratePerKmUsd: 3.3, paymentTermsDays: 30 },
  { id: 'cli-bodega', name: 'Bodegas Andinas S.A.', taxId: 'CUIT 30-65419982-4', country: 'AR', contactName: 'Carolina Ríos · Comercio Exterior', email: 'comex@cliente-demo.com.ar', phone: '+54 9 261 555-0110', ratePerKmUsd: 2.7, paymentTermsDays: 45 },
  { id: 'cli-molinos', name: 'Molinos del Litoral S.A.', taxId: 'CUIT 30-71049281-3', country: 'AR', contactName: 'Pablo Duarte · Despacho', email: 'despacho@cliente-demo.com.ar', phone: '+54 9 3772 55-0101', ratePerKmUsd: 3.9, paymentTermsDays: 15 },
  { id: 'cli-gaucha', name: 'Distribuidora Gaúcha Ltda.', taxId: 'CNPJ 12.345.678/0001-90', country: 'BR', contactName: 'Rafael Souza · Compras', email: 'compras@cliente-demo.com.br', phone: '+55 51 5555-0123', ratePerKmUsd: 4.2, paymentTermsDays: 30 },
];

export const INITIAL_DRIVERS: DriverProfile[] = [
  { id: 'drv-1', name: 'Rubén Gómez', dni: '28.419.302', phone: '+54 9 3772 44-1892', licenseCategory: 'LINTI Cargas Generales · E1', licenseExpiry: '11/2027', employmentType: 'Chofer Propio', rating: 4.9 },
  { id: 'drv-2', name: 'Marcelo Pereyra', dni: '30.118.450', phone: '+54 9 3772 51-0344', licenseCategory: 'LINTI Cargas Generales · E1', licenseExpiry: '08/2027', employmentType: 'Chofer Propio', rating: 4.8 },
  { id: 'drv-3', name: 'Gustavo Maidana', dni: '26.992.104', phone: '+54 9 3772 48-7721', licenseCategory: 'LINTI Cargas Generales · E1', licenseExpiry: '05/2028', employmentType: 'Chofer Propio', rating: 5.0 },
  { id: 'drv-4', name: 'Héctor Villalba', dni: '32.740.819', phone: '+54 9 3772 43-9901', licenseCategory: 'LINTI Cargas Generales · E1', licenseExpiry: '03/2028', employmentType: 'Chofer Propio', rating: 4.9 },
  { id: 'drv-5', name: 'Diego Benítez', dni: '29.550.112', phone: '+54 9 345 412-8830', licenseCategory: 'LINTI Cargas Peligrosas / Grales · E1', licenseExpiry: '12/2026', employmentType: 'Fletero Contratado', rating: 4.7 },
  { id: 'drv-6', name: 'Carlos Ramírez', dni: '27.803.441', phone: '+54 9 3772 60-1120', licenseCategory: 'LINTI Cargas Generales · E1', licenseExpiry: '09/2027', employmentType: 'Chofer Propio', rating: 4.9 },
  { id: 'drv-7', name: 'Jorge Acosta', dni: '25.660.903', phone: '+54 9 3772 47-3310', licenseCategory: 'LINTI Internacional MERCOSUR · E1', licenseExpiry: '06/2028', employmentType: 'Chofer Propio', rating: 4.9 },
];

const corridorById = (id: string) => INITIAL_CORRIDORS.find((c) => c.id === id)!;

function truckOnRoute(corridorId: string, km: number) {
  const c = corridorById(corridorId);
  const p = positionAtKm(c, km);
  return { lat: p.lat, lng: p.lng, headingDeg: p.headingDeg, locationLabel: locationLabelAtKm(c, km) };
}

const H = 3600000;
const D = 24 * H;

/** Estado inicial con marcas de tiempo relativas al momento de carga. */
export function createSeedData(now = Date.now()) {
  const kmPilar = Math.round(corridorById('corridor-libres-pilar').totalKm * 0.54);
  const kmCba = Math.round(corridorById('corridor-cba-libres').totalKm * 0.68);
  const rosario = corridorById('corridor-rosario-libres');
  const kmRosario = rosario.totalKm - 55;
  const kmMza = Math.round(corridorById('corridor-mza-libres').totalKm * 0.35);
  const poa = corridorById('corridor-libres-poa');
  const kmPoa = Math.max(0.5, (poa.borderKm ?? 4) - 1.5);
  const posadas = corridorById('corridor-libres-posadas');

  const trucks: TruckUnit[] = [
    { id: 'truck-104', code: 'MD-104', tractorPlate: 'AG 318 KP', trailerPlate: 'AF 991 TR', brand: 'Scania', model: 'R450 Highline', year: 2024, maxCapacityTons: 28, trailerType: 'Sider', driverId: 'drv-1', driverAvailable: true, fleetType: 'Flota Propia MD', status: 'en_ruta', speedKmh: 82, fuelPct: 74, odometerKm: 182_340, cargoSeal: 'PREC-88412', vtvExpiry: '04/2027', insuranceExpiry: '02/2027', activeTripId: 'trip-2841', ...truckOnRoute('corridor-libres-pilar', kmPilar) },
    { id: 'truck-109', code: 'MD-109', tractorPlate: 'AF 902 LT', trailerPlate: 'AE 410 FR', brand: 'Volvo', model: 'FH 500 Globetrotter', year: 2023, maxCapacityTons: 27, trailerType: 'Furgón Térmico', driverId: 'drv-2', driverAvailable: true, fleetType: 'Flota Propia MD', status: 'en_ruta', speedKmh: 79, fuelPct: 64, odometerKm: 241_905, cargoSeal: 'PREC-88390', vtvExpiry: '09/2027', insuranceExpiry: '05/2027', activeTripId: 'trip-2839', ...truckOnRoute('corridor-cba-libres', kmCba) },
    { id: 'truck-112', code: 'MD-112', tractorPlate: 'AE 745 MN', trailerPlate: 'AD 882 SD', brand: 'Mercedes-Benz', model: 'Actros 2548', year: 2022, maxCapacityTons: 28, trailerType: 'Sider', driverId: 'drv-3', driverAvailable: true, fleetType: 'Flota Propia MD', status: 'en_ruta', speedKmh: 74, fuelPct: 46, odometerKm: 318_220, cargoSeal: 'PREC-55209', vtvExpiry: '12/2026', insuranceExpiry: '03/2027', activeTripId: 'trip-2836', ...truckOnRoute('corridor-rosario-libres', kmRosario) },
    { id: 'truck-102', code: 'MD-102', tractorPlate: 'AD 519 QR', trailerPlate: 'AD 520 RM', brand: 'Scania', model: 'G410', year: 2021, maxCapacityTons: 28, trailerType: 'Sider', driverId: 'drv-4', driverAvailable: true, fleetType: 'Flota Propia MD', status: 'disponible', speedKmh: 0, fuelPct: 95, odometerKm: 402_118, cargoSeal: 'Sin carga', vtvExpiry: '07/2027', insuranceExpiry: '01/2027', lat: -29.7165, lng: -57.0925, headingDeg: 45, locationLabel: 'Base MD · Paso de los Libres' },
    { id: 'truck-205', code: 'FL-205', tractorPlate: 'AF 114 ZB', trailerPlate: 'AC 730 ST', brand: 'Iveco', model: 'Hi-Way 480', year: 2022, maxCapacityTons: 30, trailerType: 'Semirremolque Abierto', driverId: 'drv-5', driverAvailable: true, fleetType: 'Fletero Contratado', status: 'en_ruta', speedKmh: 84, fuelPct: 78, odometerKm: 295_870, cargoSeal: 'PREC-88450', vtvExpiry: '11/2026', insuranceExpiry: '06/2027', activeTripId: 'trip-2843', ...truckOnRoute('corridor-mza-libres', kmMza) },
    { id: 'truck-107', code: 'MD-107', tractorPlate: 'AE 220 JK', trailerPlate: 'AE 221 TR', brand: 'Volvo', model: 'FH 460', year: 2022, maxCapacityTons: 28, trailerType: 'Sider', driverId: 'drv-6', driverAvailable: true, fleetType: 'Flota Propia MD', status: 'disponible', speedKmh: 0, fuelPct: 61, odometerKm: 276_450, cargoSeal: 'Descargado OK', vtvExpiry: '10/2027', insuranceExpiry: '08/2027', lat: -27.3711, lng: -55.9001, headingDeg: 180, locationLabel: 'Parque Industrial Posadas' },
    { id: 'truck-110', code: 'MD-110', tractorPlate: 'AH 027 PX', trailerPlate: 'AH 028 TR', brand: 'Scania', model: 'R500 NextGen', year: 2025, maxCapacityTons: 28, trailerType: 'Sider', driverId: 'drv-7', driverAvailable: true, fleetType: 'Flota Propia MD', status: 'en_ruta', speedKmh: 46, fuelPct: 88, odometerKm: 64_210, cargoSeal: 'PREC-90117', vtvExpiry: '03/2028', insuranceExpiry: '09/2027', activeTripId: 'trip-2844', ...truckOnRoute('corridor-libres-poa', kmPoa) },
  ];

  const ev = (at: number, title: string, detail: string, actor: Trip['timeline'][number]['actor']) => ({
    id: `tl-${Math.random().toString(36).slice(2, 9)}`,
    at,
    title,
    detail,
    actor,
  });

  const baseTrip = (t: Partial<Trip> & Pick<Trip, 'id' | 'code' | 'clientId' | 'corridorId' | 'stage'>): Trip => ({
    cargoDescription: '',
    modality: 'Carga Completa (FTL)',
    weightTons: 24,
    palletsCount: 24,
    kmDone: 0,
    createdAt: now - 2 * D,
    agreedTariffUsd: 2000,
    budgetedFuelAndTollsUsd: 650,
    driverSettlementUsd: 380,
    flags: {},
    timeline: [],
    cartaPorteNumber: `CP-0004-0018${t.code.replace('VIA-', '')}`,
    ...t,
  });

  const delivered = (
    id: string,
    code: string,
    clientId: string,
    corridorId: string,
    truckId: string,
    daysAgo: number,
    hoursTaken: number,
    extra: Partial<Trip>
  ): Trip => {
    const c = corridorById(corridorId);
    const deliveredAt = now - daysAgo * D;
    const departedAt = deliveredAt - hoursTaken * H;
    return baseTrip({
      id,
      code,
      clientId,
      corridorId,
      truckId,
      stage: 'delivered',
      kmDone: c.totalKm,
      createdAt: departedAt - 10 * H,
      assignedAt: departedAt - 6 * H,
      departedAt,
      arrivedAt: deliveredAt - 0.8 * H,
      deliveredAt,
      flags: { departed: true, halfway: true, near: true },
      delivery: {
        signedAt: deliveredAt,
        receiverName: 'Recepción de planta',
        receiverDni: '30.555.111',
        remitoNumber: `R-0008-000${code.replace('VIA-', '')}`,
      },
      timeline: [
        ev(departedAt, 'Salida de origen', `Inicio de viaje confirmado desde la App del Chofer.`, 'Chofer'),
        ev(deliveredAt, 'Entrega conformada', 'Remito firmado y fotografiado en destino.', 'Chofer'),
      ],
      ...extra,
    });
  };

  const trips: Trip[] = [
    baseTrip({
      id: 'trip-2841', code: 'VIA-2841', clientId: 'cli-arcor', corridorId: 'corridor-libres-pilar', truckId: 'truck-104',
      cargoDescription: '28 pallets alimentos secos y confitería', weightTons: 25.4, palletsCount: 28,
      stage: 'in_transit', kmDone: kmPilar, createdAt: now - 14 * H, assignedAt: now - 11 * H, departedAt: now - 5 * H,
      agreedTariffUsd: 2450, budgetedFuelAndTollsUsd: 780, driverSettlementUsd: 420,
      flags: { departed: true, halfway: true },
      timeline: [
        ev(now - 11 * H, 'Unidad asignada', 'Operaciones asignó el viaje a Rubén Gómez (MD-104).', 'Admin'),
        ev(now - 5 * H, 'Salida de Base Paso de los Libres', 'Carga verificada y precintada (PREC-88412).', 'Chofer'),
        ev(now - 0.5 * H, 'Mitad de recorrido', 'Unidad en tránsito normal por RN 14.', 'GPS'),
      ],
    }),
    baseTrip({
      id: 'trip-2839', code: 'VIA-2839', clientId: 'cli-frigo', corridorId: 'corridor-cba-libres', truckId: 'truck-109',
      cargoDescription: 'Carga refrigerada controlada (-18 °C)', weightTons: 24, palletsCount: 26,
      stage: 'in_transit', kmDone: kmCba, createdAt: now - 20 * H, assignedAt: now - 16 * H, departedAt: now - 8 * H,
      agreedTariffUsd: 2790, budgetedFuelAndTollsUsd: 890, driverSettlementUsd: 480,
      flags: { departed: true, halfway: true },
      timeline: [
        ev(now - 8 * H, 'Salida de Polo Industrial Córdoba', 'Certificado SENASA validado. Equipo de frío en -18 °C.', 'Chofer'),
        ev(now - 2 * H, 'Mitad de recorrido', 'Cruce del Túnel Subfluvial sin novedades.', 'GPS'),
      ],
    }),
    baseTrip({
      id: 'trip-2836', code: 'VIA-2836', clientId: 'cli-arcor', corridorId: 'corridor-rosario-libres', truckId: 'truck-112',
      cargoDescription: 'Consolidado bobinas e insumos industriales', modality: 'Carga Consolidada (LTL)', weightTons: 19.8, palletsCount: 20,
      stage: 'nearing_destination', kmDone: kmRosario, createdAt: now - 18 * H, assignedAt: now - 15 * H, departedAt: now - 7.5 * H,
      agreedTariffUsd: 1980, budgetedFuelAndTollsUsd: 620, driverSettlementUsd: 350,
      flags: { departed: true, halfway: true, near: true },
      timeline: [
        ev(now - 7.5 * H, 'Salida de Rosario', 'Inicio de viaje confirmado.', 'Chofer'),
        ev(now - 3.2 * H, 'Mitad de recorrido', 'En tránsito por RN 18.', 'GPS'),
        ev(now - 0.3 * H, 'A menos de 60 km de destino', 'Aviso automático enviado al cliente.', 'GPS'),
      ],
    }),
    baseTrip({
      id: 'trip-2843', code: 'VIA-2843', clientId: 'cli-bodega', corridorId: 'corridor-mza-libres', truckId: 'truck-205',
      cargoDescription: '26 pallets vino embotellado para exportación', weightTons: 26.2, palletsCount: 26,
      stage: 'in_transit', kmDone: kmMza, createdAt: now - 16 * H, assignedAt: now - 13 * H, departedAt: now - 7 * H,
      agreedTariffUsd: 3900, budgetedFuelAndTollsUsd: 1180, driverSettlementUsd: 2150,
      flags: { departed: true },
      timeline: [ev(now - 7 * H, 'Salida de Luján de Cuyo', 'Fletero FL-205 en ruta por RN 7.', 'Chofer')],
    }),
    baseTrip({
      id: 'trip-2844', code: 'VIA-2844', clientId: 'cli-gaucha', corridorId: 'corridor-libres-poa', truckId: 'truck-110',
      cargoDescription: '24 pallets yerba mate y alimentos (exportación AR → BR)', weightTons: 23.5, palletsCount: 24,
      stage: 'in_transit', kmDone: kmPoa, createdAt: now - 9 * H, assignedAt: now - 6 * H, departedAt: now - 0.4 * H,
      agreedTariffUsd: 2550, budgetedFuelAndTollsUsd: 720, driverSettlementUsd: 460,
      flags: { departed: true },
      timeline: [
        ev(now - 6 * H, 'Documentación aduanera lista', 'CRT y MIC/DTA generados y validados.', 'Admin'),
        ev(now - 0.4 * H, 'Salida de Base Paso de los Libres', 'Rumbo al Puente Internacional.', 'Chofer'),
      ],
    }),
    delivered('trip-2831', 'VIA-2831', 'cli-arcor', 'corridor-libres-posadas', 'truck-107', 0.25, posadas.totalKm / 66, {
      cargoDescription: '24 pallets mercadería paletizada', weightTons: 22.8, palletsCount: 24,
      agreedTariffUsd: 1450, budgetedFuelAndTollsUsd: 490, driverSettlementUsd: 290,
    }),
    delivered('trip-2828', 'VIA-2828', 'cli-molinos', 'corridor-libres-pilar', 'truck-102', 4, 9.6, {
      cargoDescription: '28 pallets yerba mate', weightTons: 26, palletsCount: 28,
      agreedTariffUsd: 2480, budgetedFuelAndTollsUsd: 760, driverSettlementUsd: 420,
      invoice: { number: 'FC A 0004-00019471', kind: 'AFIP', authCode: '76459301884210', issuedAt: now - 3.8 * D, dueAt: now + 11 * D, amountUsd: 2480 },
    }),
    delivered('trip-2825', 'VIA-2825', 'cli-frigo', 'corridor-cba-libres', 'truck-109', 9, 12.5, {
      cargoDescription: 'Carga refrigerada (-18 °C)', weightTons: 24, palletsCount: 26,
      agreedTariffUsd: 2790, budgetedFuelAndTollsUsd: 880, driverSettlementUsd: 480,
      invoice: { number: 'FC A 0004-00019455', kind: 'AFIP', authCode: '76459301512877', issuedAt: now - 8.7 * D, dueAt: now + 21 * D, amountUsd: 2790, paidAt: now - 2 * D },
    }),
    delivered('trip-2819', 'VIA-2819', 'cli-bodega', 'corridor-mza-libres', 'truck-205', 41, 21, {
      cargoDescription: '26 pallets vino embotellado', weightTons: 26, palletsCount: 26,
      agreedTariffUsd: 3850, budgetedFuelAndTollsUsd: 1170, driverSettlementUsd: 2100,
      invoice: { number: 'FC A 0004-00019388', kind: 'AFIP', authCode: '76459300731902', issuedAt: now - 40 * D, dueAt: now - 5 * D, amountUsd: 3850 },
    }),
    delivered('trip-2822', 'VIA-2822', 'cli-arcor', 'corridor-rosario-libres', 'truck-112', 15, 8.4, {
      cargoDescription: 'Consolidado insumos industriales', modality: 'Carga Consolidada (LTL)', weightTons: 18, palletsCount: 20,
      agreedTariffUsd: 1950, budgetedFuelAndTollsUsd: 610, driverSettlementUsd: 340,
      invoice: { number: 'FC A 0004-00019420', kind: 'AFIP', authCode: '76459301102245', issuedAt: now - 14.8 * D, dueAt: now + 15 * D, amountUsd: 1950, paidAt: now - 6 * D },
    }),
    baseTrip({
      id: 'trip-2845', code: 'VIA-2845', clientId: 'cli-molinos', corridorId: 'corridor-libres-pilar',
      cargoDescription: '28 pallets yerba mate y alimentos secos', weightTons: 26, palletsCount: 28,
      stage: 'pending_assignment', createdAt: now - 1.2 * H,
      agreedTariffUsd: 2520, budgetedFuelAndTollsUsd: 790, driverSettlementUsd: 430,
    }),
    baseTrip({
      id: 'trip-2846', code: 'VIA-2846', clientId: 'cli-arcor', corridorId: 'corridor-libres-posadas',
      cargoDescription: '22 pallets golosinas y chocolates', weightTons: 18.5, palletsCount: 22,
      stage: 'pending_assignment', createdAt: now - 0.4 * H, requestedByClient: true,
      agreedTariffUsd: 1300, budgetedFuelAndTollsUsd: 410, driverSettlementUsd: 240,
      timeline: [ev(now - 0.4 * H, 'Solicitud recibida desde el Portal de Clientes', 'Pedido cargado por Lucía Fernández (Arcor).', 'Cliente')],
    }),
  ];

  const expense = (e: Omit<RouteExpense, 'amountUsd'>): RouteExpense => ({
    ...e,
    amountUsd: Math.round(e.amountArs / USD_ARS_RATE),
  });

  const expenses: RouteExpense[] = [
    expense({ id: 'exp-1', tripId: 'trip-2831', truckId: 'truck-107', driverName: 'Carlos Ramírez', category: 'Combustible', amountArs: 448000, note: 'YPF RN 14 Virasoro · 280 L', location: 'Gobernador Virasoro, Corrientes', status: 'aprobado', createdAt: now - 10 * H, source: 'App Chofer' }),
    expense({ id: 'exp-2', tripId: 'trip-2831', truckId: 'truck-107', driverName: 'Carlos Ramírez', category: 'Peajes', amountArs: 76700, note: 'Peajes corredor vial RN 14', location: 'Santo Tomé → Posadas', status: 'aprobado', createdAt: now - 9 * H, source: 'App Chofer' }),
    expense({ id: 'exp-3', tripId: 'trip-2841', truckId: 'truck-104', driverName: 'Rubén Gómez', category: 'Combustible', amountArs: 495600, note: 'YPF Full RN 14 · 310 L', location: 'Concordia, Entre Ríos', status: 'pendiente', createdAt: now - 1.5 * H, source: 'App Chofer' }),
    expense({ id: 'exp-4', tripId: 'trip-2843', truckId: 'truck-205', driverName: 'Diego Benítez', category: 'Peajes', amountArs: 58400, note: 'Peaje Autopista RN 7', location: 'San Luis', status: 'pendiente', createdAt: now - 3 * H, source: 'App Chofer' }),
    expense({ id: 'exp-5', tripId: 'trip-2843', truckId: 'truck-205', driverName: 'Diego Benítez', category: 'Viáticos', amountArs: 32000, note: 'Comida parador RN 7', location: 'Villa Mercedes, San Luis', status: 'pendiente', createdAt: now - 2.2 * H, source: 'App Chofer' }),
  ];

  const notifications: SystemNotification[] = [
    { id: 'n-1', at: now - 0.3 * H, panelOrigin: 'admin', title: 'MD-112 a menos de 60 km de destino (VIA-2836)', detail: 'Arcor recibió el aviso automático con ETA actualizado.', channelBadge: 'GPS → Portal Cliente', audience: ['admin', 'client:cli-arcor'] },
    { id: 'n-2', at: now - 0.4 * H, panelOrigin: 'client', title: 'Nueva solicitud de Arcor (VIA-2846)', detail: 'Paso de los Libres → Posadas · 22 pallets. Pendiente de asignar unidad.', channelBadge: 'Portal Cliente → Despacho', audience: ['admin'] },
    { id: 'n-3', at: now - 6 * H, panelOrigin: 'driver', title: 'Remito conformado recibido (VIA-2831)', detail: 'Carlos Ramírez subió la foto del remito firmado en Posadas. Listo para facturar.', channelBadge: 'App Chofer → Finanzas', audience: ['admin', 'finance', 'client:cli-arcor'] },
    { id: 'n-4', at: now - 1.2 * H, panelOrigin: 'admin', title: 'Licencia LINTI por vencer · Diego Benítez', detail: 'Vence 12/2026. Se envió recordatorio automático al chofer.', channelBadge: 'Vencimientos → Chofer', audience: ['admin', 'truck:truck-205'] },
  ];

  const messages: FleetMessage[] = [
    { id: 'msg-1', at: now - 20 * H, title: 'Control en Puente Internacional', body: 'Desde el lunes AFIP-Aduana refuerza controles de precintos en el puente Paso de los Libres – Uruguaiana. Verificar precinto y MIC/DTA antes de salir.', truckIds: [], readBy: [] },
  ];

  return { trucks, trips, expenses, notifications, messages };
}
