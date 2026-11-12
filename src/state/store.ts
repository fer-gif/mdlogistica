import {
  ClientAccount,
  DestinationNode,
  DriverProfile,
  FleetMessage,
  OfflineQueuedAction,
  PanelId,
  RouteCorridor,
  RouteExpense,
  SystemNotification,
  Trip,
  TripTimelineEvent,
  TruckUnit,
} from '../types';
import {
  createSeedData,
  INITIAL_CLIENTS,
  INITIAL_CORRIDORS,
  INITIAL_DESTINATIONS,
  INITIAL_DRIVERS,
  STAGE_META,
} from '../data/seed';
import { haversineKm, locationLabelAtKm, positionAtKm } from '../lib/geo';
import { etaFromKm, USD_ARS_RATE, uid, when } from '../lib/format';

// Al cambiar la forma del estado se suben juntos la clave y STATE_VERSION, así los navegadores
// con datos viejos arrancan desde el estado inicial.
export const STORAGE_KEY = 'md_logistica_demo_v6';
const STATE_VERSION = 6;
export const TICK_MS = 1500;

/** Segundos simulados por segundo real según velocidad elegida. */
export const SIM_SPEEDS = {
  real: { label: 'Tiempo real', factor: 1 },
  normal: { label: 'Acelerada x150', factor: 150 },
  fast: { label: 'Muy rápida x600', factor: 600 },
} as const;
export type SimSpeed = keyof typeof SIM_SPEEDS;

const CUSTOMS_HOURS = 2.5;
const NEAR_KM = 60;

export interface DemoState {
  version: typeof STATE_VERSION;
  clients: ClientAccount[];
  drivers: DriverProfile[];
  trucks: TruckUnit[];
  destinations: DestinationNode[];
  corridors: RouteCorridor[];
  trips: Trip[];
  expenses: RouteExpense[];
  notifications: SystemNotification[];
  messages: FleetMessage[];
  offlineQueue: OfflineQueuedAction[];
  isOffline: boolean;
  sim: { running: boolean; speed: SimSpeed };
  seq: { trip: number; invoice: number; cte: number; remito: number; carta: number };
}

export function createInitialState(): DemoState {
  const seed = createSeedData();
  return {
    version: STATE_VERSION,
    clients: INITIAL_CLIENTS,
    drivers: INITIAL_DRIVERS,
    trucks: seed.trucks,
    destinations: INITIAL_DESTINATIONS,
    corridors: INITIAL_CORRIDORS,
    trips: seed.trips,
    expenses: seed.expenses,
    notifications: seed.notifications,
    messages: seed.messages,
    offlineQueue: [],
    isOffline: false,
    sim: { running: true, speed: 'normal' },
    seq: { trip: 2847, invoice: 19482, cte: 1204, remito: 49200, carta: 185000 },
  };
}

export function loadState(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed && parsed.version === STATE_VERSION && Array.isArray(parsed.trips)) return parsed;
    }
  } catch {
    // almacenamiento no disponible: se usa el estado inicial
  }
  return createInitialState();
}

export function saveState(state: DemoState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // cuota llena o modo privado: se ignora
  }
}

// ---------- Acciones ----------

export type NewTripInput = {
  clientId: string;
  cargoDescription: string;
  corridorId: string;
  modality: Trip['modality'];
  weightTons: number;
  palletsCount: number;
  agreedTariffUsd: number;
  requestedByClient?: boolean;
  pickupDate?: string;
  /** Si viene, el viaje se crea ya asignado a esa unidad. */
  truckId?: string;
};

export type Action =
  | { type: 'TICK'; dtMs: number }
  | { type: 'SET_SIM'; running?: boolean; speed?: SimSpeed }
  | { type: 'RESET' }
  | { type: 'CREATE_TRIP'; input: NewTripInput }
  | { type: 'CANCEL_TRIP'; tripId: string }
  | { type: 'ASSIGN_TRIP'; tripId: string; truckId: string }
  | { type: 'UNASSIGN_TRIP'; tripId: string }
  | { type: 'START_TRIP'; tripId: string }
  | { type: 'ARRIVE'; tripId: string }
  | { type: 'UPLOAD_REMITO'; tripId: string; receiverName: string; receiverDni: string; photoDataUrl?: string }
  | {
      type: 'ADD_EXPENSE';
      tripId: string;
      category: RouteExpense['category'];
      amountArs: number;
      note: string;
      photoDataUrl?: string;
    }
  | { type: 'REVIEW_EXPENSE'; expenseId: string; status: 'aprobado' | 'rechazado' }
  | { type: 'EMIT_INVOICE'; tripId: string }
  | { type: 'REGISTER_PAYMENT'; tripId: string }
  | { type: 'TOGGLE_AVAILABILITY'; truckId: string }
  | { type: 'CREATE_DRIVER'; driver: Omit<DriverProfile, 'id' | 'rating'> }
  | { type: 'CREATE_TRUCK'; truck: NewTruckInput }
  | { type: 'CREATE_CLIENT'; client: Omit<ClientAccount, 'id'> }
  | { type: 'CREATE_DESTINATION'; destination: Omit<DestinationNode, 'id'> }
  | { type: 'CREATE_CORRIDOR'; corridor: Omit<RouteCorridor, 'id'> }
  | { type: 'SEND_MESSAGE'; title: string; body: string; truckIds: string[] }
  | { type: 'MARK_MESSAGES_READ'; truckId: string }
  | { type: 'SET_OFFLINE'; offline: boolean }
  | { type: 'QUEUE_OFFLINE'; item: OfflineQueuedAction }
  | { type: 'BOOST_TRIP'; tripId: string; km: number };

export type NewTruckInput = Pick<
  TruckUnit,
  | 'code'
  | 'brand'
  | 'model'
  | 'year'
  | 'tractorPlate'
  | 'trailerPlate'
  | 'trailerType'
  | 'maxCapacityTons'
  | 'fleetType'
  | 'driverId'
  | 'vtvExpiry'
  | 'insuranceExpiry'
> & { baseDestinationId: string };

// ---------- Helpers ----------

export const getCorridor = (s: DemoState, id: string) => s.corridors.find((c) => c.id === id);
export const getClient = (s: DemoState, id: string) => s.clients.find((c) => c.id === id);
export const getTruck = (s: DemoState, id?: string) => (id ? s.trucks.find((t) => t.id === id) : undefined);
export const getDriver = (s: DemoState, id?: string) => (id ? s.drivers.find((d) => d.id === id) : undefined);
export const driverNameOf = (s: DemoState, truck?: TruckUnit) =>
  truck ? getDriver(s, truck.driverId)?.name ?? 'Sin chofer' : 'Sin unidad';

export function tripProgressPct(trip: Trip, corridor?: RouteCorridor) {
  if (!corridor || corridor.totalKm <= 0) return 0;
  return Math.max(0, Math.min(100, (trip.kmDone / corridor.totalKm) * 100));
}

/**
 * Cumplimiento del viaje (0–100). A diferencia del avance en km, contempla todo el ciclo:
 * sin asignar 0 % · en carga 5 % · en ruta 10–90 % según km · descargando 95 % · entregado 100 %.
 */
export function tripCompletionPct(trip: Trip, corridor?: RouteCorridor) {
  switch (trip.stage) {
    case 'pending_assignment':
      return 0;
    case 'assigned':
      return 5;
    case 'unloading':
      return 95;
    case 'delivered':
      return 100;
    default:
      return Math.round(10 + 0.8 * tripProgressPct(trip, corridor));
  }
}

export interface AssignmentCandidate {
  truck: TruckUnit;
  /** Distancia vial estimada al origen del viaje. */
  km: number;
  /** Motivo por el que no puede asignarse (vacío si está disponible). */
  reason: string;
}

/** Unidades para asignar un viaje, ordenadas: primero las disponibles y más cercanas al origen. */
export function assignmentCandidates(state: DemoState, corridorId: string, weightTons: number): AssignmentCandidate[] {
  const corridor = getCorridor(state, corridorId);
  if (!corridor) return [];
  const o = positionAtKm(corridor, 0);
  return nearestTrucksTo(state, o.lat, o.lng)
    .map(({ truck, km }) => {
      let reason = '';
      if (truck.activeTripId) reason = 'En viaje';
      else if (!truck.driverAvailable) reason = 'Chofer en descanso';
      else if (truck.maxCapacityTons < weightTons) reason = `Capacidad ${truck.maxCapacityTons} tn`;
      return { truck, km, reason };
    })
    .sort((a, b) => Number(Boolean(a.reason)) - Number(Boolean(b.reason)) || a.km - b.km);
}

export function tripEta(trip: Trip, corridor?: RouteCorridor) {
  if (!corridor) return null;
  if (trip.stage === 'delivered' || trip.stage === 'unloading') return null;
  if (trip.stage === 'pending_assignment' || trip.stage === 'assigned') {
    return etaFromKm(corridor.totalKm);
  }
  const remaining = corridor.totalKm - trip.kmDone;
  const customsExtra = trip.stage === 'customs' ? (trip.customsHoursLeft ?? 0) : 0;
  const base = etaFromKm(remaining);
  const extra =
    corridor.international && !trip.flags.customsIn ? CUSTOMS_HOURS : customsExtra;
  return { ts: base.ts + extra * 3600000, hours: base.hours + extra };
}

function event(title: string, detail: string, actor: TripTimelineEvent['actor']): TripTimelineEvent {
  return { id: uid('tl'), at: Date.now(), title, detail, actor };
}

function notify(
  s: DemoState,
  n: Omit<SystemNotification, 'id' | 'at'>
): DemoState {
  const item: SystemNotification = { ...n, id: uid('n'), at: Date.now() };
  return { ...s, notifications: [item, ...s.notifications].slice(0, 250) };
}

function patchTrip(s: DemoState, tripId: string, fn: (t: Trip) => Trip): DemoState {
  return { ...s, trips: s.trips.map((t) => (t.id === tripId ? fn(t) : t)) };
}

function patchTruck(s: DemoState, truckId: string | undefined, fn: (t: TruckUnit) => TruckUnit): DemoState {
  if (!truckId) return s;
  return { ...s, trucks: s.trucks.map((t) => (t.id === truckId ? fn(t) : t)) };
}

function clientAud(trip: Trip): `client:${string}` {
  return `client:${trip.clientId}`;
}

function cae(): string {
  return `7645930${Math.floor(1000000 + Math.random() * 8999999)}`;
}

function cteKey(): string {
  let s = '43';
  while (s.length < 44) s += Math.floor(Math.random() * 10);
  return s.replace(/(\d{4})(?=\d)/g, '$1 ');
}

// ---------- Simulación GPS ----------

function simulate(state: DemoState, simHours: number, onlyTripId?: string): DemoState {
  let s = state;

  for (const trip of state.trips) {
    if (onlyTripId && trip.id !== onlyTripId) continue;
    if (!trip.truckId) continue;
    if (!['in_transit', 'customs', 'nearing_destination'].includes(trip.stage)) continue;
    const corridor = getCorridor(s, trip.corridorId);
    const truck = getTruck(s, trip.truckId);
    if (!corridor || !truck) continue;
    const truckCode = truck.code;
    const client = getClient(s, trip.clientId);

    // --- Detenido en aduana ---
    if (trip.stage === 'customs') {
      const left = (trip.customsHoursLeft ?? CUSTOMS_HOURS) - simHours;
      if (left > 0) {
        s = patchTrip(s, trip.id, (t) => ({ ...t, customsHoursLeft: left }));
        s = patchTruck(s, truck.id, (t) => ({ ...t, speedKmh: 0, status: 'en_aduana' }));
        continue;
      }
      s = patchTrip(s, trip.id, (t) => ({
        ...t,
        stage: 'in_transit',
        customsHoursLeft: 0,
        flags: { ...t.flags, customsOut: true },
        timeline: [
          ...t.timeline,
          event('Liberado por Aduana Integrada', 'MIC/DTA cerrado. Continúa viaje por BR-290.', 'Aduana'),
        ],
      }));
      s = patchTruck(s, truck.id, (t) => ({ ...t, status: 'en_ruta', speedKmh: 60 }));
      s = notify(s, {
        panelOrigin: 'admin',
        title: `${truckCode} liberado en frontera (${trip.code})`,
        detail: 'Despacho aduanero completo en Paso de los Libres – Uruguaiana. Ingresó a Brasil.',
        channelBadge: 'Aduana → Admin & Cliente',
        audience: ['admin', clientAud(trip)],
        toast: true,
      });
      continue;
    }

    const remainingBefore = corridor.totalKm - trip.kmDone;
    const cruise = 70 + Math.random() * 16;
    const speed = Math.round(remainingBefore < 15 ? 42 + Math.random() * 8 : cruise);
    const delta = speed * simHours;
    let kmDone = Math.min(corridor.totalKm, trip.kmDone + delta);
    let stage: Trip['stage'] = trip.stage;
    const flags = { ...trip.flags };
    const timeline = [...trip.timeline];
    let customsHoursLeft = trip.customsHoursLeft;
    let truckStatus: TruckUnit['status'] = 'en_ruta';
    let truckSpeed = speed;
    let arrivedAt = trip.arrivedAt;
    const pending: Omit<SystemNotification, 'id' | 'at'>[] = [];

    // Cruce de frontera
    if (corridor.international && corridor.borderKm !== undefined && !flags.customsIn && kmDone >= corridor.borderKm) {
      kmDone = corridor.borderKm;
      stage = 'customs';
      flags.customsIn = true;
      customsHoursLeft = CUSTOMS_HOURS;
      truckStatus = 'en_aduana';
      truckSpeed = 0;
      timeline.push(event('Ingreso a Aduana Integrada', 'Puente Internacional Paso de los Libres – Uruguaiana. MIC/DTA y CRT presentados.', 'Aduana'));
      pending.push({
        panelOrigin: 'admin',
        title: `${truckCode} ingresó a Aduana Integrada (${trip.code})`,
        detail: 'Trámite de frontera en curso. Documentación MIC/DTA y CRT presentada digitalmente.',
        channelBadge: 'Geocerca Frontera → Admin & Cliente',
        audience: ['admin', clientAud(trip)],
        toast: true,
      });
    }

    const pct = (kmDone / corridor.totalKm) * 100;
    const remaining = corridor.totalKm - kmDone;

    if (stage !== 'customs') {
      if (!flags.halfway && pct >= 50) {
        flags.halfway = true;
        timeline.push(event('Mitad de recorrido', `Unidad en tránsito normal · ${locationLabelAtKm(corridor, kmDone)}.`, 'GPS'));
        pending.push({
          panelOrigin: 'admin',
          title: `${trip.code} superó la mitad del recorrido`,
          detail: `${truckCode} en ${locationLabelAtKm(corridor, kmDone)}. Restan ${Math.round(remaining)} km.`,
          channelBadge: 'GPS → Admin & Cliente',
          audience: ['admin', clientAud(trip)],
        });
      }
      if (!flags.near && remaining <= NEAR_KM && remaining > 0) {
        flags.near = true;
        stage = 'nearing_destination';
        const eta = etaFromKm(remaining);
        timeline.push(event(`A menos de ${NEAR_KM} km de destino`, `ETA estimado ${when(eta.ts)} hs. Aviso automático al cliente.`, 'GPS'));
        pending.push({
          panelOrigin: 'admin',
          title: `${truckCode} próximo a destino (${trip.code})`,
          detail: `${client?.name ?? 'El cliente'} recibió aviso automático. ETA ${when(eta.ts)} hs.`,
          channelBadge: 'Geocerca → Portal Cliente',
          audience: ['admin', clientAud(trip)],
          toast: true,
        });
      }
      if (kmDone >= corridor.totalKm) {
        stage = 'unloading';
        arrivedAt = Date.now();
        truckStatus = 'descargando';
        truckSpeed = 0;
        timeline.push(event('Arribo a destino', `${corridor.destination}. Iniciando descarga.`, 'GPS'));
        pending.push({
          panelOrigin: 'admin',
          title: `${truckCode} arribó a destino (${trip.code})`,
          detail: 'En descarga. El chofer debe subir el remito conformado desde la App.',
          channelBadge: 'GPS → Admin, Cliente & Chofer',
          audience: ['admin', clientAud(trip), `truck:${truck.id}`],
          toast: true,
        });
      }
    }

    const pos = positionAtKm(corridor, kmDone);
    const movedKm = kmDone - trip.kmDone;
    let fuelPct = Math.max(0, truck.fuelPct - movedKm * 0.045);
    let refuel = false;
    if (fuelPct < 16 && stage !== 'unloading') {
      fuelPct = 96;
      refuel = true;
    }

    s = patchTrip(s, trip.id, (t) => ({ ...t, kmDone, stage, flags, timeline, customsHoursLeft, arrivedAt }));
    s = patchTruck(s, truck.id, (t) => ({
      ...t,
      lat: pos.lat,
      lng: pos.lng,
      headingDeg: pos.headingDeg,
      locationLabel: stage === 'unloading' ? corridor.destination.split(',')[0] : locationLabelAtKm(corridor, kmDone),
      speedKmh: truckSpeed,
      status: truckStatus,
      fuelPct: Math.round(fuelPct * 10) / 10,
      odometerKm: Math.round(t.odometerKm + movedKm),
    }));
    for (const n of pending) s = notify(s, n);

    if (refuel) {
      const liters = 420;
      const amountArs = liters * 1650;
      const exp: RouteExpense = {
        id: uid('exp'),
        tripId: trip.id,
        truckId: truck.id,
        driverName: driverNameOf(s, truck),
        category: 'Combustible',
        amountArs,
        amountUsd: Math.round(amountArs / USD_ARS_RATE),
        note: `Carga automática ${liters} L · Tarjeta flota`,
        location: locationLabelAtKm(corridor, kmDone),
        status: 'pendiente',
        createdAt: Date.now(),
        source: 'Tarjeta Combustible',
      };
      s = { ...s, expenses: [exp, ...s.expenses] };
      s = notify(s, {
        panelOrigin: 'finance',
        title: `Carga de combustible ${truckCode} (${trip.code})`,
        detail: `${liters} L registrados por tarjeta de flota en ${exp.location}. Pendiente de auditoría.`,
        channelBadge: 'Tarjeta Combustible → Finanzas',
        audience: ['admin', 'finance'],
      });
    }
  }
  return s;
}

// ---------- Reductor ----------

export function reducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case 'TICK':
      if (!state.sim.running) return state;
      return simulate(state, ((action.dtMs / 1000) * SIM_SPEEDS[state.sim.speed].factor) / 3600);

    case 'SET_SIM':
      return {
        ...state,
        sim: {
          running: action.running ?? state.sim.running,
          speed: action.speed ?? state.sim.speed,
        },
      };

    case 'RESET':
      return createInitialState();

    case 'CREATE_TRIP': {
      const { input } = action;
      const corridor = getCorridor(state, input.corridorId);
      const client = getClient(state, input.clientId);
      if (!corridor || !client) return state;
      const num = state.seq.trip;
      const trip: Trip = {
        id: uid('trip'),
        code: `VIA-${num}`,
        clientId: client.id,
        cargoDescription: input.cargoDescription,
        modality: input.modality,
        weightTons: input.weightTons,
        palletsCount: input.palletsCount,
        corridorId: corridor.id,
        stage: 'pending_assignment',
        kmDone: 0,
        createdAt: Date.now(),
        requestedByClient: input.requestedByClient,
        pickupDate: input.pickupDate,
        agreedTariffUsd: input.agreedTariffUsd,
        budgetedFuelAndTollsUsd: Math.round(corridor.totalKm * 1.2),
        driverSettlementUsd: Math.round(input.agreedTariffUsd * 0.17),
        flags: {},
        timeline: [
          event(
            input.requestedByClient ? 'Solicitud recibida desde el Portal de Clientes' : 'Orden de carga creada',
            `${corridor.origin} → ${corridor.destination} · ${corridor.totalKm} km.`,
            input.requestedByClient ? 'Cliente' : 'Admin'
          ),
        ],
        cartaPorteNumber: `CP-0004-00${state.seq.carta}`,
      };
      let s: DemoState = {
        ...state,
        trips: [trip, ...state.trips],
        seq: { ...state.seq, trip: num + 1, carta: state.seq.carta + 1 },
      };
      s = notify(s, input.requestedByClient
        ? {
            panelOrigin: 'client',
            title: `Nueva solicitud de ${client.name} (${trip.code})`,
            detail: `${corridor.origin} → ${corridor.destination}. Ingresó a Cargas y Despacho.`,
            channelBadge: 'Portal Cliente → Despacho',
            audience: ['admin', `client:${client.id}`],
            toast: true,
          }
        : {
            panelOrigin: 'admin',
            title: `Orden de carga ${trip.code} creada`,
            detail: `${client.name} · ${corridor.origin} → ${corridor.destination} (${corridor.totalKm} km).`,
            channelBadge: 'Operaciones',
            audience: ['admin', `client:${client.id}`],
            toast: !input.truckId,
          });
      return input.truckId ? reducer(s, { type: 'ASSIGN_TRIP', tripId: trip.id, truckId: input.truckId }) : s;
    }

    case 'CANCEL_TRIP': {
      const trip = state.trips.find((t) => t.id === action.tripId);
      if (!trip || trip.stage !== 'pending_assignment') return state;
      const s = { ...state, trips: state.trips.filter((t) => t.id !== trip.id) };
      return notify(s, {
        panelOrigin: 'admin',
        title: `Carga ${trip.code} anulada`,
        detail: 'Se retiró de la lista de viajes por asignar.',
        channelBadge: 'Operaciones',
        audience: ['admin', clientAud(trip)],
        toast: true,
      });
    }

    case 'ASSIGN_TRIP': {
      const trip = state.trips.find((t) => t.id === action.tripId);
      const truck = getTruck(state, action.truckId);
      if (!trip || !truck || trip.stage !== 'pending_assignment' || truck.activeTripId) return state;
      const corridor = getCorridor(state, trip.corridorId);
      if (!corridor) return state;
      const origin = positionAtKm(corridor, 0);
      const driver = driverNameOf(state, truck);
      let s = patchTrip(state, trip.id, (t) => ({
        ...t,
        truckId: truck.id,
        stage: 'assigned',
        assignedAt: Date.now(),
        timeline: [
          ...t.timeline,
          event('Unidad asignada', `${truck.code} · ${driver}. Se dirige a cargar en ${corridor.origin.split(',')[0]}.`, 'Admin'),
        ],
      }));
      s = patchTruck(s, truck.id, (t) => ({
        ...t,
        activeTripId: trip.id,
        status: 'en_carga',
        speedKmh: 0,
        lat: origin.lat,
        lng: origin.lng,
        headingDeg: origin.headingDeg,
        locationLabel: `${corridor.origin.split(',')[0]} · En carga`,
        cargoSeal: `PREC-${Math.floor(10000 + Math.random() * 89999)}`,
      }));
      s = notify(s, {
        panelOrigin: 'admin',
        title: `${trip.code} asignado a ${truck.code} (${driver})`,
        detail: `El viaje ya figura en la App del Chofer. Hoja de ruta${corridor.international ? ', CRT y MIC/DTA' : ''} generados automáticamente.`,
        channelBadge: 'Despacho → Chofer & Cliente',
        audience: ['admin', clientAud(trip), `truck:${truck.id}`],
        toast: true,
      });
      return s;
    }

    case 'UNASSIGN_TRIP': {
      const trip = state.trips.find((t) => t.id === action.tripId);
      if (!trip || trip.stage !== 'assigned') return state;
      const truck = getTruck(state, trip.truckId);
      let s = patchTrip(state, trip.id, (t) => ({
        ...t,
        truckId: undefined,
        stage: 'pending_assignment',
        assignedAt: undefined,
        timeline: [
          ...t.timeline,
          event('Asignación quitada', `${truck?.code ?? 'La unidad'} quedó liberada. El viaje vuelve a estar por asignar.`, 'Admin'),
        ],
      }));
      s = patchTruck(s, truck?.id, (t) => ({ ...t, activeTripId: undefined, status: 'disponible', cargoSeal: 'Sin carga' }));
      return notify(s, {
        panelOrigin: 'admin',
        title: `${trip.code} sin unidad asignada`,
        detail: `${truck?.code ?? ''} liberado. El viaje volvió a la lista de viajes por asignar.`,
        channelBadge: 'Despacho → Chofer',
        audience: ['admin', ...(truck ? [`truck:${truck.id}` as const] : [])],
        toast: true,
      });
    }

    case 'START_TRIP': {
      const trip = state.trips.find((t) => t.id === action.tripId);
      if (!trip || trip.stage !== 'assigned') return state;
      const truck = getTruck(state, trip.truckId);
      const corridor = getCorridor(state, trip.corridorId);
      if (!truck || !corridor) return state;
      let s = patchTrip(state, trip.id, (t) => ({
        ...t,
        stage: 'in_transit',
        departedAt: Date.now(),
        kmDone: 0.5,
        flags: { ...t.flags, departed: true },
        timeline: [
          ...t.timeline,
          event(`Salida de ${corridor.origin.split(',')[0]}`, `Carga completa y precintada (${truck.cargoSeal}).`, 'Chofer'),
        ],
      }));
      s = patchTruck(s, truck.id, (t) => ({ ...t, status: 'en_ruta', speedKmh: 55 }));
      s = notify(s, {
        panelOrigin: 'driver',
        title: `${truck.code} inició el viaje ${trip.code}`,
        detail: `Salida de ${corridor.origin}. ETA ${when(etaFromKm(corridor.totalKm).ts)} hs.`,
        channelBadge: 'App Chofer → Admin & Cliente',
        audience: ['admin', clientAud(trip)],
        toast: true,
      });
      return s;
    }

    case 'ARRIVE': {
      const trip = state.trips.find((t) => t.id === action.tripId);
      if (!trip || !['in_transit', 'nearing_destination'].includes(trip.stage)) return state;
      const corridor = getCorridor(state, trip.corridorId);
      const truck = getTruck(state, trip.truckId);
      if (!corridor || !truck) return state;
      if (corridor.totalKm - trip.kmDone > 20) return state;
      const pos = positionAtKm(corridor, corridor.totalKm);
      let s = patchTrip(state, trip.id, (t) => ({
        ...t,
        stage: 'unloading',
        kmDone: corridor.totalKm,
        arrivedAt: Date.now(),
        flags: { ...t.flags, near: true },
        timeline: [...t.timeline, event('Arribo confirmado por el chofer', corridor.destination, 'Chofer')],
      }));
      s = patchTruck(s, truck.id, (t) => ({
        ...t,
        status: 'descargando',
        speedKmh: 0,
        lat: pos.lat,
        lng: pos.lng,
        locationLabel: corridor.destination.split(',')[0],
      }));
      return notify(s, {
        panelOrigin: 'driver',
        title: `${truck.code} en destino (${trip.code})`,
        detail: 'Descarga en curso. Esperando remito conformado.',
        channelBadge: 'App Chofer → Admin & Cliente',
        audience: ['admin', clientAud(trip)],
        toast: true,
      });
    }

    case 'UPLOAD_REMITO': {
      const trip = state.trips.find((t) => t.id === action.tripId);
      if (!trip || trip.stage !== 'unloading') return state;
      const truck = getTruck(state, trip.truckId);
      const corridor = getCorridor(state, trip.corridorId);
      const remitoNumber = `R-0008-000${state.seq.remito}`;
      let s: DemoState = { ...state, seq: { ...state.seq, remito: state.seq.remito + 1 } };
      s = patchTrip(s, trip.id, (t) => ({
        ...t,
        stage: 'delivered',
        deliveredAt: Date.now(),
        delivery: {
          signedAt: Date.now(),
          receiverName: action.receiverName,
          receiverDni: action.receiverDni,
          photoDataUrl: action.photoDataUrl,
          remitoNumber,
        },
        timeline: [
          ...t.timeline,
          event('Entrega conformada', `Remito ${remitoNumber} firmado por ${action.receiverName} (DNI ${action.receiverDni}).`, 'Chofer'),
        ],
      }));
      s = patchTruck(s, truck?.id, (t) => ({
        ...t,
        activeTripId: undefined,
        status: 'disponible',
        speedKmh: 0,
        cargoSeal: 'Descargado OK',
        locationLabel: corridor ? corridor.destination.split(',')[0] : t.locationLabel,
      }));
      return notify(s, {
        panelOrigin: 'driver',
        title: `Remito conformado recibido (${trip.code})`,
        detail: `${truck?.code ?? ''} liberado y disponible. Viaje habilitado para facturar en Finanzas.`,
        channelBadge: 'App Chofer → Admin, Cliente & Finanzas',
        audience: ['admin', 'finance', clientAud(trip)],
        toast: true,
      });
    }

    case 'ADD_EXPENSE': {
      const trip = state.trips.find((t) => t.id === action.tripId);
      const truck = getTruck(state, trip?.truckId);
      if (!trip || !truck) return state;
      const exp: RouteExpense = {
        id: uid('exp'),
        tripId: trip.id,
        truckId: truck.id,
        driverName: driverNameOf(state, truck),
        category: action.category,
        amountArs: action.amountArs,
        amountUsd: Math.round(action.amountArs / USD_ARS_RATE),
        note: action.note,
        location: truck.locationLabel,
        photoDataUrl: action.photoDataUrl,
        status: 'pendiente',
        createdAt: Date.now(),
        source: 'App Chofer',
      };
      return notify(
        { ...state, expenses: [exp, ...state.expenses] },
        {
          panelOrigin: 'driver',
          title: `Gasto de ${action.category.toLowerCase()} rendido (${trip.code})`,
          detail: `$ ${action.amountArs.toLocaleString('es-AR')} ARS (≈ USD ${exp.amountUsd}) · ${action.note}. Pendiente de auditoría.`,
          channelBadge: 'App Chofer → Finanzas',
          audience: ['admin', 'finance'],
          toast: true,
        }
      );
    }

    case 'REVIEW_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.map((e) => (e.id === action.expenseId ? { ...e, status: action.status } : e)),
      };

    case 'EMIT_INVOICE': {
      const trip = state.trips.find((t) => t.id === action.tripId);
      if (!trip || trip.stage !== 'delivered' || trip.invoice) return state;
      const client = getClient(state, trip.clientId);
      const isBr = client?.country === 'BR';
      const issuedAt = Date.now();
      const invoice = isBr
        ? {
            number: `CT-e 001-000.${String(state.seq.cte).padStart(3, '0')}`,
            kind: 'CTE' as const,
            authCode: cteKey(),
            issuedAt,
            dueAt: issuedAt + (client?.paymentTermsDays ?? 30) * 86400000,
            amountUsd: trip.agreedTariffUsd,
          }
        : {
            number: `FC A 0004-000${state.seq.invoice}`,
            kind: 'AFIP' as const,
            authCode: cae(),
            issuedAt,
            dueAt: issuedAt + (client?.paymentTermsDays ?? 30) * 86400000,
            amountUsd: trip.agreedTariffUsd,
          };
      let s: DemoState = {
        ...state,
        seq: isBr ? { ...state.seq, cte: state.seq.cte + 1 } : { ...state.seq, invoice: state.seq.invoice + 1 },
      };
      s = patchTrip(s, trip.id, (t) => ({
        ...t,
        invoice,
        timeline: [
          ...t.timeline,
          event(
            isBr ? 'CT-e autorizado por SEFAZ' : 'Factura electrónica autorizada por ARCA',
            `${invoice.number} · ${isBr ? 'Chave' : 'CAE'} ${invoice.authCode}`,
            'Finanzas'
          ),
        ],
      }));
      return notify(s, {
        panelOrigin: 'finance',
        title: `${isBr ? 'CT-e' : 'Factura'} emitida (${trip.code})`,
        detail: `${invoice.number} · ${isBr ? 'SEFAZ' : 'CAE'} ${invoice.authCode}. Publicada en el portal de ${client?.name}.`,
        channelBadge: isBr ? 'SEFAZ Brasil → Portal Cliente' : 'ARCA/AFIP → Portal Cliente',
        audience: ['admin', 'finance', clientAud(trip)],
        toast: true,
      });
    }

    case 'REGISTER_PAYMENT': {
      const trip = state.trips.find((t) => t.id === action.tripId);
      if (!trip?.invoice || trip.invoice.paidAt) return state;
      const s = patchTrip(state, trip.id, (t) => ({
        ...t,
        invoice: t.invoice ? { ...t.invoice, paidAt: Date.now() } : t.invoice,
        timeline: [...t.timeline, event('Cobro registrado', `${t.invoice?.number} cancelada.`, 'Finanzas')],
      }));
      return notify(s, {
        panelOrigin: 'finance',
        title: `Cobro registrado (${trip.code})`,
        detail: `${trip.invoice.number} · USD ${trip.invoice.amountUsd.toLocaleString('es-AR')} imputado en cuenta corriente.`,
        channelBadge: 'Finanzas → Cuenta corriente',
        audience: ['admin', 'finance', clientAud(trip)],
        toast: true,
      });
    }

    case 'TOGGLE_AVAILABILITY': {
      const truck = getTruck(state, action.truckId);
      if (!truck) return state;
      const s = patchTruck(state, truck.id, (t) => ({ ...t, driverAvailable: !t.driverAvailable }));
      return notify(s, {
        panelOrigin: 'driver',
        title: `${driverNameOf(state, truck)} ${truck.driverAvailable ? 'en descanso' : 'disponible'}`,
        detail: `${truck.code} · ${truck.locationLabel}`,
        channelBadge: 'Estado del chofer → Admin',
        audience: ['admin'],
      });
    }

    case 'CREATE_DRIVER': {
      const driver: DriverProfile = { ...action.driver, id: uid('drv'), rating: 5 };
      return notify(
        { ...state, drivers: [...state.drivers, driver] },
        {
          panelOrigin: 'admin',
          title: `Chofer dado de alta: ${driver.name}`,
          detail: 'Ya puede asignarse a una unidad y recibir cargas en la App.',
          channelBadge: 'Gestión de Flota',
          audience: ['admin'],
          toast: true,
        }
      );
    }

    case 'CREATE_TRUCK': {
      const { baseDestinationId, ...data } = action.truck;
      const dest = state.destinations.find((d) => d.id === baseDestinationId) ?? state.destinations[0];
      const truck: TruckUnit = {
        ...data,
        id: uid('truck'),
        driverAvailable: true,
        status: 'disponible',
        speedKmh: 0,
        fuelPct: 100,
        odometerKm: 0,
        cargoSeal: 'Sin carga',
        locationLabel: dest.name,
        lat: dest.lat + (Math.random() - 0.5) * 0.01,
        lng: dest.lng + (Math.random() - 0.5) * 0.01,
        headingDeg: 0,
      };
      return notify(
        { ...state, trucks: [...state.trucks, truck] },
        {
          panelOrigin: 'admin',
          title: `Unidad ${truck.code} incorporada`,
          detail: `${truck.brand} ${truck.model} · ${dest.name}. Visible en el mapa y en despacho.`,
          channelBadge: 'Gestión de Flota',
          audience: ['admin'],
          toast: true,
        }
      );
    }

    case 'CREATE_CLIENT': {
      const client: ClientAccount = { ...action.client, id: uid('cli') };
      return notify(
        { ...state, clients: [...state.clients, client] },
        {
          panelOrigin: 'admin',
          title: `Cliente dado de alta: ${client.name}`,
          detail: `Acceso al Portal de Clientes habilitado para ${client.contactName}.`,
          channelBadge: 'Módulo de Clientes',
          audience: ['admin'],
          toast: true,
        }
      );
    }

    case 'CREATE_DESTINATION': {
      const dest: DestinationNode = { ...action.destination, id: uid('dest') };
      return notify(
        { ...state, destinations: [...state.destinations, dest] },
        {
          panelOrigin: 'admin',
          title: `Nuevo destino: ${dest.name}`,
          detail: `${dest.province}. Disponible para trazar rutas.`,
          channelBadge: 'Rutas y Destinos',
          audience: ['admin'],
          toast: true,
        }
      );
    }

    case 'CREATE_CORRIDOR': {
      const corridor: RouteCorridor = { ...action.corridor, id: uid('corridor') };
      return notify(
        { ...state, corridors: [corridor, ...state.corridors] },
        {
          panelOrigin: 'admin',
          title: `Ruta creada: ${corridor.name}`,
          detail: `${corridor.totalKm} km · ~${Math.round(corridor.estimatedHours)} h de manejo${corridor.approximate ? ' (trazado estimado)' : ''}.`,
          channelBadge: 'Rutas y Destinos',
          audience: ['admin'],
          toast: true,
        }
      );
    }

    case 'SEND_MESSAGE': {
      const msg: FleetMessage = {
        id: uid('msg'),
        at: Date.now(),
        title: action.title,
        body: action.body,
        truckIds: action.truckIds,
        readBy: [],
      };
      const target = action.truckIds.length === 0 ? 'toda la flota' : `${action.truckIds.length} unidad(es)`;
      return notify(
        { ...state, messages: [msg, ...state.messages] },
        {
          panelOrigin: 'admin',
          title: `Comunicado enviado a ${target}`,
          detail: action.title,
          channelBadge: 'Comunicación → App del Chofer',
          audience: ['admin', ...(action.truckIds.length ? action.truckIds : state.trucks.map((t) => t.id)).map((id) => `truck:${id}` as const)],
          toast: true,
        }
      );
    }

    case 'MARK_MESSAGES_READ':
      return {
        ...state,
        messages: state.messages.map((m) =>
          (m.truckIds.length === 0 || m.truckIds.includes(action.truckId)) && !m.readBy.includes(action.truckId)
            ? { ...m, readBy: [...m.readBy, action.truckId] }
            : m
        ),
      };

    case 'QUEUE_OFFLINE':
      return { ...state, offlineQueue: [...state.offlineQueue, action.item] };

    case 'SET_OFFLINE': {
      if (action.offline) return { ...state, isOffline: true };
      // Reconexión: se reproducen las acciones en orden sobre el estado actualizado.
      let s: DemoState = { ...state, isOffline: false, offlineQueue: [] };
      const count = state.offlineQueue.length;
      for (const item of state.offlineQueue) {
        switch (item.type) {
          case 'start_trip':
            s = reducer(s, { type: 'START_TRIP', tripId: item.tripId });
            break;
          case 'arrive':
            s = reducer(s, { type: 'ARRIVE', tripId: item.tripId });
            break;
          case 'upload_remito':
            s = reducer(s, {
              type: 'UPLOAD_REMITO',
              tripId: item.tripId,
              receiverName: item.receiverName,
              receiverDni: item.receiverDni,
              photoDataUrl: item.photoDataUrl,
            });
            break;
          case 'add_expense':
            s = reducer(s, {
              type: 'ADD_EXPENSE',
              tripId: item.tripId,
              category: item.category,
              amountArs: item.amountArs,
              note: item.note,
              photoDataUrl: item.photoDataUrl,
            });
            break;
        }
      }
      if (count > 0) {
        s = notify(s, {
          panelOrigin: 'driver',
          title: `Señal recuperada · ${count} evento(s) sincronizados`,
          detail: 'Todo lo registrado sin conexión impactó en Administración, Cliente y Finanzas.',
          channelBadge: 'Sincronización offline',
          audience: ['admin'],
          toast: true,
        });
      }
      return s;
    }

    case 'BOOST_TRIP': {
      const trip = state.trips.find((t) => t.id === action.tripId);
      const corridor = trip ? getCorridor(state, trip.corridorId) : undefined;
      if (!trip || !corridor || !['in_transit', 'nearing_destination', 'customs'].includes(trip.stage)) return state;
      // Avanza en pasos de ~5 km para que las geocercas (frontera, mitad, cercanía, arribo) se disparen normalmente.
      let s = state;
      const steps = Math.max(1, Math.ceil(action.km / 5));
      for (let i = 0; i < steps; i++) s = simulate(s, action.km / steps / 78, trip.id);
      return s;
    }

    default:
      return state;
  }
}

// ---------- Selectores de negocio ----------

/** Costo operativo por km de un camión propio (sin combustible, peajes ni chofer). */
export const FLEET_COST_PER_KM_USD = 1.15;

export function tripFinancials(state: DemoState, trip: Trip) {
  const tripExpenses = state.expenses.filter((e) => e.tripId === trip.id && e.status !== 'rechazado');
  const recorded = tripExpenses.reduce((s, e) => s + e.amountUsd, 0);
  const routeCosts = trip.stage === 'delivered' ? Math.max(recorded, Math.round(trip.budgetedFuelAndTollsUsd * 0.9)) : Math.max(recorded, trip.budgetedFuelAndTollsUsd);
  // Costos operativos de flota propia (amortización, seguro, mantenimiento, cubiertas, administración).
  // Con fleteros contratados no corresponden: el camión es del fletero.
  const truck = getTruck(state, trip.truckId);
  const km = getCorridor(state, trip.corridorId)?.totalKm ?? 0;
  const fixedCosts = truck?.fleetType === 'Fletero Contratado' ? 0 : Math.round(km * FLEET_COST_PER_KM_USD);
  const net = trip.agreedTariffUsd - routeCosts - trip.driverSettlementUsd - fixedCosts;
  return {
    recordedExpensesUsd: recorded,
    routeCostsUsd: routeCosts,
    fixedCostsUsd: fixedCosts,
    netUsd: net,
    marginPct: trip.agreedTariffUsd > 0 ? (net / trip.agreedTariffUsd) * 100 : 0,
    budgetDeviationUsd: recorded - trip.budgetedFuelAndTollsUsd,
  };
}

export type InvoiceStatus = 'no_listo' | 'listo' | 'emitida' | 'vencida' | 'cobrada';

export function invoiceStatus(trip: Trip): InvoiceStatus {
  if (trip.invoice?.paidAt) return 'cobrada';
  if (trip.invoice) return trip.invoice.dueAt < Date.now() ? 'vencida' : 'emitida';
  if (trip.stage === 'delivered') return 'listo';
  return 'no_listo';
}

export function nearestTrucksTo(state: DemoState, lat: number, lng: number) {
  return state.trucks
    .map((t) => ({ truck: t, km: Math.round(haversineKm(lat, lng, t.lat, t.lng) * 1.2) }))
    .sort((a, b) => a.km - b.km);
}

export function stageLabel(trip: Trip) {
  return STAGE_META[trip.stage].label;
}

export function audienceFor(role: 'admin' | 'finance' | 'driver' | 'client', ref?: string): SystemNotification['audience'][number] {
  if (role === 'driver') return `truck:${ref}`;
  if (role === 'client') return `client:${ref}`;
  return role;
}

export function panelOfNotification(n: SystemNotification): PanelId {
  return n.panelOrigin;
}
