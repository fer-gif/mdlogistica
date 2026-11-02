export type PanelId = 'admin' | 'driver' | 'client' | 'finance';

export type UserRole = 'admin' | 'driver' | 'client' | 'finance';

export interface DemoUser {
  username: string;
  password: string;
  role: UserRole;
  displayName: string;
  /** Para choferes: unidad que opera. */
  truckId?: string;
  /** Para clientes: empresa a la que pertenece. */
  clientId?: string;
}

/**
 * Ciclo de vida de un viaje:
 * pending_assignment → assigned (en carga en origen) → in_transit → [customs] →
 * nearing_destination → unloading (en destino) → delivered (remito conformado)
 */
export type TripStage =
  | 'pending_assignment'
  | 'assigned'
  | 'in_transit'
  | 'customs'
  | 'nearing_destination'
  | 'unloading'
  | 'delivered';

export type TruckStatus = 'disponible' | 'en_carga' | 'en_ruta' | 'en_aduana' | 'descargando';

export interface Waypoint {
  lat: number;
  lng: number;
  label: string;
}

export interface Checkpoint extends Waypoint {
  /** Kilómetro sobre el trazado (calculado). */
  km: number;
}

export interface DestinationNode {
  id: string;
  name: string;
  province: string;
  country: 'AR' | 'BR';
  addressNote: string;
  lat: number;
  lng: number;
  kind: 'base' | 'deposito' | 'planta' | 'puerto';
}

export interface RouteCorridor {
  id: string;
  name: string;
  originId: string;
  destinationId: string;
  origin: string;
  destination: string;
  totalKm: number;
  estimatedHours: number;
  international: boolean;
  /** Trazado por ruta real [lat, lng]. */
  path: [number, number][];
  /** Puntos de referencia con nombre a lo largo del trazado. */
  checkpoints: Checkpoint[];
  /** Km del cruce de frontera (si es internacional). */
  borderKm?: number;
  /** true si el trazado es aproximado (sin ruteo vial). */
  approximate?: boolean;
}

export interface ClientAccount {
  id: string;
  name: string;
  taxId: string;
  country: 'AR' | 'BR';
  contactName: string;
  email: string;
  phone: string;
  /** Tarifa preferencial USD por km. */
  ratePerKmUsd: number;
  paymentTermsDays: number;
}

export interface DriverProfile {
  id: string;
  name: string;
  dni: string;
  phone: string;
  licenseCategory: string;
  licenseExpiry: string; // MM/AAAA
  employmentType: 'Chofer Propio' | 'Fletero Contratado';
  rating: number;
}

export interface TruckUnit {
  id: string;
  code: string;
  tractorPlate: string;
  trailerPlate: string;
  brand: string;
  model: string;
  year: number;
  maxCapacityTons: number;
  trailerType: 'Sider' | 'Furgón Térmico' | 'Semirremolque Abierto' | 'Portacontenedor' | 'Batea';
  driverId: string;
  driverAvailable: boolean;
  fleetType: 'Flota Propia MD' | 'Fletero Contratado';
  status: TruckStatus;
  speedKmh: number;
  fuelPct: number;
  odometerKm: number;
  cargoSeal: string;
  locationLabel: string;
  lat: number;
  lng: number;
  headingDeg: number;
  vtvExpiry: string; // MM/AAAA
  insuranceExpiry: string; // MM/AAAA
  activeTripId?: string;
}

export interface TripTimelineEvent {
  id: string;
  at: number; // epoch ms
  title: string;
  detail: string;
  actor: 'Sistema' | 'Admin' | 'Chofer' | 'Cliente' | 'Finanzas' | 'GPS' | 'Aduana';
}

export interface DeliveryProof {
  signedAt: number;
  receiverName: string;
  receiverDni: string;
  photoDataUrl?: string;
  remitoNumber: string;
}

export interface Invoice {
  number: string;
  kind: 'AFIP' | 'CTE';
  authCode: string; // CAE o chave CT-e
  issuedAt: number;
  dueAt: number;
  amountUsd: number;
  paidAt?: number;
}

export interface Trip {
  id: string;
  code: string;
  clientId: string;
  cargoDescription: string;
  modality: 'Carga Completa (FTL)' | 'Carga Consolidada (LTL)';
  weightTons: number;
  palletsCount: number;
  corridorId: string;
  truckId?: string;
  /** Unidades a las que se les publicó la carga (pueden ser varias). */
  offeredTruckIds: string[];
  rejectedTruckIds: string[];
  stage: TripStage;
  kmDone: number;
  createdAt: number;
  requestedByClient?: boolean;
  pickupDate?: string;
  acceptedAt?: number;
  departedAt?: number;
  arrivedAt?: number;
  deliveredAt?: number;
  agreedTariffUsd: number;
  budgetedFuelAndTollsUsd: number;
  driverSettlementUsd: number;
  delivery?: DeliveryProof;
  invoice?: Invoice;
  /** Horas simuladas restantes de trámite en aduana. */
  customsHoursLeft?: number;
  flags: {
    departed?: boolean;
    halfway?: boolean;
    near?: boolean;
    customsIn?: boolean;
    customsOut?: boolean;
  };
  timeline: TripTimelineEvent[];
  cartaPorteNumber: string;
}

export interface RouteExpense {
  id: string;
  tripId: string;
  truckId: string;
  driverName: string;
  category: 'Combustible' | 'Peajes' | 'Mantenimiento en Ruta' | 'Viáticos';
  amountArs: number;
  amountUsd: number;
  note: string;
  location: string;
  photoDataUrl?: string;
  status: 'pendiente' | 'aprobado' | 'rechazado';
  createdAt: number;
  source: 'App Chofer' | 'Tarjeta Combustible';
}

export interface SystemNotification {
  id: string;
  at: number;
  panelOrigin: PanelId;
  title: string;
  detail: string;
  channelBadge: string;
  /** Destinatarios lógicos para filtrar en cada panel. */
  audience: ('admin' | 'finance' | `client:${string}` | `truck:${string}`)[];
  toast?: boolean;
}

export interface FleetMessage {
  id: string;
  at: number;
  title: string;
  body: string;
  truckIds: string[]; // vacío = toda la flota
  readBy: string[];
}

export type OfflineQueuedAction =
  | { id: string; createdAt: number; description: string; type: 'start_trip'; tripId: string }
  | { id: string; createdAt: number; description: string; type: 'arrive'; tripId: string }
  | {
      id: string;
      createdAt: number;
      description: string;
      type: 'upload_remito';
      tripId: string;
      receiverName: string;
      receiverDni: string;
      photoDataUrl?: string;
    }
  | {
      id: string;
      createdAt: number;
      description: string;
      type: 'add_expense';
      tripId: string;
      category: RouteExpense['category'];
      amountArs: number;
      note: string;
      photoDataUrl?: string;
    };
