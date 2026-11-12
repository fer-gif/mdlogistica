import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock,
  Gauge,
  List,
  Map as MapIcon,
  MapPin,
  PackageCheck,
  PackagePlus,
  Receipt,
  Route,
  Truck,
  Wallet,
} from 'lucide-react';
import { PanelId, Trip } from '../types';
import { useDemo } from '../state/DemoContext';
import { getClient, getCorridor, getDriver, getTruck, invoiceStatus, tripCompletionPct, tripEta } from '../state/store';
import { dateShort, durationHours, num, usd, when } from '../lib/format';
import { DocContext, printTripDocument } from '../lib/documents';
import { FleetMap } from './FleetMap';
import { shortPlace, TripDocButtons, TripTimeline } from './trip';
import {
  Button,
  Card,
  CompletionMeter,
  cx,
  Detail,
  EmptyState,
  ExpandableRow,
  Field,
  inputCls,
  Modal,
  Segmented,
  StageBadge,
  Tabs,
  useShowMore,
} from './ui';

interface ClientPortalPanelProps {
  clientId: string;
  showClientPicker: boolean;
  onChangeClient?: (clientId: string) => void;
  onNavigatePanel?: (p: PanelId) => void;
}

type PortalTab = 'shipments' | 'account' | 'metrics';
type ShipmentFilter = 'active' | 'delivered';
type ShipmentView = 'list' | 'map';

function tomorrowIso() {
  const d = new Date(Date.now() + 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const isoToShort = (iso: string) => iso.split('-').reverse().join('/');

export const ClientPortalPanel: React.FC<ClientPortalPanelProps> = ({
  clientId,
  showClientPicker,
  onChangeClient,
  onNavigatePanel,
}) => {
  const { state, dispatch } = useDemo();
  const client = getClient(state, clientId);

  const [portalTab, setPortalTab] = useState<PortalTab>('shipments');
  const [filter, setFilter] = useState<ShipmentFilter>('active');
  const [view, setView] = useState<ShipmentView>('list');
  const [openTripId, setOpenTripId] = useState<string | null>(null);
  const [focusedTruckId, setFocusedTruckId] = useState<string | null>(null);
  const [justRequested, setJustRequested] = useState<string | null>(null);

  useEffect(() => {
    setPortalTab('shipments');
    setFilter('active');
    setView('list');
    setOpenTripId(null);
    setFocusedTruckId(null);
    setJustRequested(null);
  }, [clientId]);

  const clientTrips = useMemo(
    () => state.trips.filter((t) => t.clientId === clientId).sort((a, b) => b.createdAt - a.createdAt),
    [state.trips, clientId]
  );
  // Los más próximos a completarse primero; los pendientes de asignación al final.
  const activeTrips = clientTrips
    .filter((t) => t.stage !== 'delivered')
    .sort(
      (a, b) =>
        tripCompletionPct(b, getCorridor(state, b.corridorId)) - tripCompletionPct(a, getCorridor(state, a.corridorId))
    );
  const deliveredTrips = clientTrips
    .filter((t) => t.stage === 'delivered')
    .sort((a, b) => (b.deliveredAt ?? 0) - (a.deliveredAt ?? 0));

  // Privacidad: solo unidades que hoy transportan carga de este cliente.
  const activeTripIds = new Set(activeTrips.map((t) => t.id));
  const clientTrucks = state.trucks.filter((t) => t.activeTripId && activeTripIds.has(t.activeTripId));
  const selectedTruckId =
    focusedTruckId && clientTrucks.some((t) => t.id === focusedTruckId) ? focusedTruckId : clientTrucks[0]?.id ?? null;
  const mappedTrips = activeTrips.filter((t) => t.truckId && clientTrucks.some((tr) => tr.id === t.truckId));

  const delivered = useShowMore(deliveredTrips, 6);

  // ---------- Solicitud ----------
  const [showRequest, setShowRequest] = useState(false);
  const [reqCorridorId, setReqCorridorId] = useState(state.corridors[0]?.id ?? '');
  const [reqModality, setReqModality] = useState<Trip['modality']>('Carga Completa (FTL)');
  const [reqWeight, setReqWeight] = useState(24);
  const [reqPallets, setReqPallets] = useState(24);
  const [reqCargo, setReqCargo] = useState('Pallets de producto terminado');
  const [reqDate, setReqDate] = useState(tomorrowIso());

  const reqCorridor = getCorridor(state, reqCorridorId) ?? state.corridors[0];
  const estimatedTariff = reqCorridor && client ? Math.round(reqCorridor.totalKm * client.ratePerKmUsd) : 0;

  const submitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !reqCorridor) return;
    const nextCode = `VIA-${state.seq.trip}`;
    dispatch({
      type: 'CREATE_TRIP',
      input: {
        clientId: client.id,
        cargoDescription: reqCargo.trim() || 'Carga general',
        corridorId: reqCorridor.id,
        modality: reqModality,
        weightTons: Number(reqWeight) || 0,
        palletsCount: Number(reqPallets) || 0,
        agreedTariffUsd: estimatedTariff,
        requestedByClient: true,
        pickupDate: reqDate,
      },
    });
    setShowRequest(false);
    setJustRequested(nextCode);
    setPortalTab('shipments');
    setFilter('active');
    setView('list');
  };

  // ---------- Métricas ----------
  const metrics = useMemo(() => {
    const timed = deliveredTrips
      .map((t) => {
        const c = getCorridor(state, t.corridorId);
        const hours = t.deliveredAt && t.departedAt ? (t.deliveredAt - t.departedAt) / 3600000 : 0;
        return { trip: t, corridor: c, hours };
      })
      .filter((r): r is { trip: Trip; corridor: NonNullable<typeof r.corridor>; hours: number } => Boolean(r.corridor) && r.hours > 0);
    const totalKm = deliveredTrips.reduce((s, t) => s + (getCorridor(state, t.corridorId)?.totalKm ?? 0), 0);
    const avgHours = timed.length ? timed.reduce((s, r) => s + r.hours, 0) / timed.length : undefined;
    const onTime = timed.filter((r) => r.hours <= r.corridor.estimatedHours * 1.15).length;
    return {
      count: deliveredTrips.length,
      totalKm,
      tons: deliveredTrips.reduce((s, t) => s + t.weightTons, 0),
      avgHours,
      onTimePct: timed.length ? (onTime / timed.length) * 100 : undefined,
    };
  }, [deliveredTrips, state]);

  // ---------- Estado de cuenta ----------
  const invoiced = clientTrips.filter((t) => t.invoice).sort((a, b) => b.invoice!.issuedAt - a.invoice!.issuedAt);
  const pendingBalance = invoiced.filter((t) => !t.invoice!.paidAt).reduce((s, t) => s + t.invoice!.amountUsd, 0);
  const overdueTrips = invoiced.filter((t) => invoiceStatus(t) === 'vencida');
  const overdueBalance = overdueTrips.reduce((s, t) => s + t.invoice!.amountUsd, 0);

  const docCtx = (trip: Trip): DocContext => {
    const truck = getTruck(state, trip.truckId);
    return { trip, corridor: getCorridor(state, trip.corridorId), client, truck, driver: getDriver(state, truck?.driverId) };
  };

  // Próxima llegada entre los envíos en ruta
  const nextArrival = activeTrips
    .filter((t) => t.truckId && t.stage !== 'assigned')
    .map((t) => ({ trip: t, eta: tripEta(t, getCorridor(state, t.corridorId)) }))
    .filter((x) => x.eta)
    .sort((a, b) => a.eta!.ts - b.eta!.ts)[0];

  const showOnMap = (truckId: string) => {
    setFilter('active');
    setView('map');
    setFocusedTruckId(truckId);
  };

  if (!client) {
    return <EmptyState icon={<Building2 className="h-8 w-8" />} title="Cliente no encontrado" />;
  }

  const listed = filter === 'active' ? activeTrips : delivered.visible;

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#B71E23]">Portal de Clientes</div>
          <div className="text-xl font-extrabold leading-tight">{client.name}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showClientPicker && (
            <select
              value={clientId}
              onChange={(e) => onChangeClient?.(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-bold"
              title="Vista previa del portal de otro cliente"
            >
              {state.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  Ver como: {c.name}
                </option>
              ))}
            </select>
          )}
          <Button size="lg" onClick={() => setShowRequest(true)}>
            <PackagePlus className="h-4 w-4" /> Solicitar viaje
          </Button>
        </div>
      </div>

      {justRequested && (
        <div className="md-slide-in flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            Solicitud {justRequested} enviada. Le avisaremos cuando se asigne la unidad.
          </div>
          {onNavigatePanel && (
            <Button variant="success" size="sm" onClick={() => onNavigatePanel('admin')}>
              Asignarla desde Administración
            </Button>
          )}
        </div>
      )}

      {/* Lo que le importa al cliente, de un vistazo */}
      <div className="grid grid-cols-1 divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Summary
          icon={<Truck className="h-4 w-4" />}
          value={`${activeTrips.length}`}
          label={`Envíos en curso · ${clientTrucks.length} en camino`}
          onClick={() => {
            setPortalTab('shipments');
            setFilter('active');
          }}
        />
        <Summary
          icon={<Clock className="h-4 w-4" />}
          value={nextArrival ? when(nextArrival.eta!.ts) : '—'}
          label={nextArrival ? `Próxima llegada · ${nextArrival.trip.code}` : 'Sin llegadas previstas'}
        />
        <Summary
          icon={<Wallet className="h-4 w-4" />}
          value={usd(pendingBalance)}
          label={overdueBalance > 0 ? `Saldo a pagar · ${usd(overdueBalance)} vencido` : 'Saldo a pagar'}
          danger={overdueBalance > 0}
          onClick={() => setPortalTab('account')}
        />
      </div>

      <Tabs<PortalTab>
        value={portalTab}
        onChange={setPortalTab}
        items={[
          { id: 'shipments', label: 'Mis envíos', icon: <PackageCheck className="h-4 w-4" /> },
          { id: 'account', label: 'Estado de cuenta', icon: <Receipt className="h-4 w-4" />, badge: overdueTrips.length },
          { id: 'metrics', label: 'Métricas', icon: <Gauge className="h-4 w-4" /> },
        ]}
      />

      {/* ---------- ENVÍOS ---------- */}
      {portalTab === 'shipments' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented<ShipmentFilter>
              value={filter}
              onChange={(f) => {
                setFilter(f);
                if (f === 'delivered') setView('list');
              }}
              items={[
                { id: 'active', label: 'En curso', badge: activeTrips.length },
                { id: 'delivered', label: 'Entregados', badge: deliveredTrips.length },
              ]}
            />
            {filter === 'active' && clientTrucks.length > 0 && (
              <Segmented<ShipmentView>
                value={view}
                onChange={setView}
                items={[
                  { id: 'list', label: 'Lista', icon: <List className="h-3.5 w-3.5" /> },
                  { id: 'map', label: 'Ver en mapa', icon: <MapIcon className="h-3.5 w-3.5" /> },
                ]}
              />
            )}
          </div>

          {view === 'map' && filter === 'active' && clientTrucks.length > 0 ? (
            <div className="space-y-3">
              <FleetMap
                key={clientId}
                trucks={clientTrucks}
                trips={state.trips}
                corridors={state.corridors}
                drivers={state.drivers}
                destinations={state.destinations}
                selectedTruckId={selectedTruckId}
                onSelectTruck={setFocusedTruckId}
                showAllCorridors={false}
                initialFit="trucks"
                heightClass="h-[360px] sm:h-[460px]"
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {mappedTrips.map((trip) => {
                  const corridor = getCorridor(state, trip.corridorId);
                  const selected = trip.truckId === selectedTruckId;
                  return (
                    <button
                      key={trip.id}
                      type="button"
                      onClick={() => setFocusedTruckId(trip.truckId!)}
                      className={cx(
                        'rounded-xl border bg-white px-3 py-2.5 text-left transition',
                        selected ? 'border-[#B71E23] ring-2 ring-[#B71E23]/10' : 'border-zinc-200 hover:border-zinc-300'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold">{trip.code}</span>
                        <StageBadge stage={trip.stage} />
                      </div>
                      <div className="mt-1 truncate text-xs font-bold">
                        {shortPlace(corridor?.origin)} → {shortPlace(corridor?.destination)}
                      </div>
                      <CompletionMeter pct={tripCompletionPct(trip, corridor)} size="sm" className="mt-2" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {listed.length === 0 &&
                (filter === 'active' ? (
                  <EmptyState
                    icon={<PackageCheck className="h-8 w-8" />}
                    title="No hay envíos en curso"
                    text="Solicitá un viaje con el botón de arriba."
                  />
                ) : (
                  <EmptyState icon={<PackageCheck className="h-8 w-8" />} title="Todavía no hay envíos entregados" />
                ))}
              {listed.map((trip) => (
                <ShipmentRow
                  key={trip.id}
                  trip={trip}
                  open={openTripId === trip.id}
                  onToggle={() => setOpenTripId(openTripId === trip.id ? null : trip.id)}
                  docCtx={docCtx(trip)}
                  onShowOnMap={showOnMap}
                />
              ))}
              {filter === 'delivered' && delivered.toggle}
            </div>
          )}
        </div>
      )}

      {/* ---------- ESTADO DE CUENTA ---------- */}
      {portalTab === 'account' && (
        <Card className="p-4">
          {invoiced.length === 0 ? (
            <p className="text-xs text-zinc-500">Todavía no hay comprobantes emitidos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-[10px] uppercase tracking-wider text-zinc-400">
                    <th className="pb-2 font-bold">Comprobante</th>
                    <th className="pb-2 font-bold">Viaje</th>
                    <th className="pb-2 font-bold">Vence</th>
                    <th className="pb-2 text-right font-bold">Importe</th>
                    <th className="pb-2 text-right font-bold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {invoiced.map((t) => {
                    const st = invoiceStatus(t);
                    const inv = t.invoice!;
                    return (
                      <tr key={t.id}>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => printTripDocument('factura', docCtx(t))}
                            className="font-mono font-bold hover:text-[#B71E23] hover:underline"
                          >
                            {inv.number}
                          </button>
                        </td>
                        <td className="py-2 font-mono text-zinc-500">{t.code}</td>
                        <td className={cx('py-2', st === 'vencida' ? 'font-bold text-red-700' : 'text-zinc-600')}>{dateShort(inv.dueAt)}</td>
                        <td className="py-2 text-right font-mono font-bold">{usd(inv.amountUsd)}</td>
                        <td className="py-2 text-right">
                          <span
                            className={cx(
                              'rounded-full px-2 py-0.5 text-[10px] font-bold',
                              st === 'cobrada' && 'bg-emerald-50 text-emerald-700',
                              st === 'vencida' && 'bg-red-50 text-red-700',
                              st === 'emitida' && 'bg-amber-50 text-amber-800'
                            )}
                          >
                            {st === 'cobrada' ? 'Pagada' : st === 'vencida' ? 'Vencida' : 'A pagar'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ---------- MÉTRICAS ---------- */}
      {portalTab === 'metrics' && (
        <Card className="p-4">
          {metrics.count === 0 ? (
            <p className="text-xs text-zinc-500">Las métricas se generan cuando se completa su primer viaje.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label="Viajes entregados" value={num(metrics.count)} />
              <Metric label="Km recorridos" value={`${num(metrics.totalKm)} km`} />
              <Metric label="Tiempo promedio" value={metrics.avgHours !== undefined ? durationHours(metrics.avgHours) : '—'} />
              <Metric
                label="Entregas en término"
                value={metrics.onTimePct !== undefined ? `${num(metrics.onTimePct)}%` : '—'}
                hint="Hasta 15 % sobre el tiempo estimado"
              />
            </div>
          )}
        </Card>
      )}

      {/* Modal de solicitud */}
      <Modal
        open={showRequest}
        onClose={() => setShowRequest(false)}
        eyebrow="Solicitudes"
        title={`Nuevo viaje para ${client.name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRequest(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="md-client-request">
              Enviar solicitud
            </Button>
          </>
        }
      >
        <form id="md-client-request" onSubmit={submitRequest} className="space-y-3">
          <Field label="Ruta">
            <select value={reqCorridor?.id ?? ''} onChange={(e) => setReqCorridorId(e.target.value)} className={inputCls}>
              {state.corridors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {num(c.totalKm)} km
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha de retiro">
              <input type="date" value={reqDate} min={tomorrowIso()} onChange={(e) => setReqDate(e.target.value)} className={inputCls} required />
            </Field>
            <Field label="Modalidad">
              <select value={reqModality} onChange={(e) => setReqModality(e.target.value as Trip['modality'])} className={inputCls}>
                <option value="Carga Completa (FTL)">Completa (FTL)</option>
                <option value="Carga Consolidada (LTL)">Consolidada (LTL)</option>
              </select>
            </Field>
            <Field label="Peso (tn)">
              <input type="number" min={0.5} max={30} step={0.1} value={reqWeight} onChange={(e) => setReqWeight(Number(e.target.value))} className={inputCls} required />
            </Field>
            <Field label="Pallets">
              <input type="number" min={1} max={40} value={reqPallets} onChange={(e) => setReqPallets(Number(e.target.value))} className={inputCls} required />
            </Field>
          </div>
          <Field label="Mercadería">
            <input type="text" value={reqCargo} onChange={(e) => setReqCargo(e.target.value)} className={inputCls} required />
          </Field>
          {reqCorridor && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-[#B71E23]/25 bg-[#FEF2F2] p-3">
              <span className="flex items-center gap-1.5 text-xs font-bold">
                <Route className="h-3.5 w-3.5 text-[#B71E23]" /> Tarifa estimada
              </span>
              <span className="font-mono text-base font-extrabold text-[#B71E23]">{usd(estimatedTariff)}</span>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
};

/** Una línea por envío: lo esencial a la vista y el resto al expandir. */
function ShipmentRow({
  trip,
  open,
  onToggle,
  docCtx,
  onShowOnMap,
}: {
  trip: Trip;
  open: boolean;
  onToggle: () => void;
  docCtx: DocContext;
  onShowOnMap: (truckId: string) => void;
}) {
  const { corridor, truck, driver } = docCtx;
  const eta = tripEta(trip, corridor);
  const pct = tripCompletionPct(trip, corridor);
  const isDelivered = trip.stage === 'delivered';

  let status = '';
  switch (trip.stage) {
    case 'pending_assignment':
      status = `Pendiente de asignación de unidad${trip.pickupDate ? ` · retiro ${isoToShort(trip.pickupDate)}` : ''}`;
      break;
    case 'assigned':
      status = `${truck?.code ?? 'Unidad'} cargando en ${shortPlace(corridor?.origin)}`;
      break;
    case 'unloading':
      status = 'En destino · descargando';
      break;
    case 'delivered':
      status = `Entregado ${trip.deliveredAt ? dateShort(trip.deliveredAt) : ''}${trip.delivery ? ` · Remito ${trip.delivery.remitoNumber}` : ''}`;
      break;
    default:
      status = `${eta ? `Llega ${when(eta.ts)}` : 'En ruta'} · ${truck?.locationLabel ?? ''}`;
  }

  return (
    <ExpandableRow
      open={open}
      onToggle={onToggle}
      summary={
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold">{trip.code}</span>
              <StageBadge stage={trip.stage} />
            </div>
            <div className="mt-0.5 truncate text-sm font-extrabold">
              {shortPlace(corridor?.origin)} → {shortPlace(corridor?.destination)}
            </div>
            <div className="truncate text-[11px] text-zinc-500">{status}</div>
          </div>
          <div className="w-28 shrink-0 sm:w-44">
            <div className="mb-1 text-right text-[10px] font-bold uppercase tracking-wider text-zinc-400">Cumplimiento</div>
            <CompletionMeter pct={pct} />
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Detail label="Mercadería" value={trip.cargoDescription} />
          <Detail label="Carga" value={`${num(trip.weightTons, 1)} tn · ${trip.palletsCount} pallets`} />
          <Detail label="Unidad" value={truck ? `${truck.code} · ${truck.tractorPlate}` : 'A asignar'} />
          <Detail label="Chofer" value={driver?.name ?? '—'} />
          {isDelivered ? (
            <>
              <Detail label="Recibió" value={trip.delivery ? `${trip.delivery.receiverName} · DNI ${trip.delivery.receiverDni}` : '—'} />
              <Detail
                label="Duración"
                value={trip.deliveredAt && trip.departedAt ? durationHours((trip.deliveredAt - trip.departedAt) / 3600000) : '—'}
              />
            </>
          ) : (
            <>
              <Detail label="Ubicación" value={truck && trip.stage !== 'pending_assignment' ? truck.locationLabel : '—'} />
              <Detail
                label="Recorrido"
                value={corridor ? `${num(Math.min(trip.kmDone, corridor.totalKm))} de ${num(corridor.totalKm)} km` : '—'}
              />
            </>
          )}
        </div>

        <TripTimeline trip={trip} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <TripDocButtons ctx={docCtx} />
          {truck && !isDelivered && trip.stage !== 'pending_assignment' && (
            <Button size="sm" variant="secondary" onClick={() => onShowOnMap(truck.id)}>
              <MapPin className="h-3.5 w-3.5" /> Ver en mapa
            </Button>
          )}
        </div>
      </div>
    </ExpandableRow>
  );
}

function Summary({
  icon,
  value,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cx('flex items-center gap-3 px-4 py-3 text-left', onClick && 'transition hover:bg-zinc-50')}
    >
      <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', danger ? 'bg-red-50 text-red-600' : 'bg-zinc-100 text-zinc-600')}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-lg font-extrabold leading-tight">{value}</span>
        <span className={cx('block truncate text-[11px] font-semibold', danger ? 'text-red-600' : 'text-zinc-500')}>{label}</span>
      </span>
    </Comp>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</div>
      <div className="mt-1 text-lg font-extrabold">{value}</div>
      {hint && <div className="text-[10px] text-zinc-400">{hint}</div>}
    </div>
  );
}

export default ClientPortalPanel;
