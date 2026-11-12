import React, { useMemo, useState } from 'react';
import { ArrowRight, Ban, CheckCircle2, Inbox, MapPin, Plus, Smartphone, Truck, Undo2, X } from 'lucide-react';
import { Trip } from '../../types';
import { useDemo } from '../../state/DemoContext';
import {
  assignmentCandidates,
  driverNameOf,
  getClient,
  getCorridor,
  getDriver,
  getTruck,
  invoiceStatus,
  tripCompletionPct,
  tripEta,
} from '../../state/store';
import { dateShort, num, usd, when } from '../../lib/format';
import { DocContext } from '../../lib/documents';
import {
  Button,
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
  TruckStatusBadge,
  useShowMore,
} from '../ui';
import { shortPlace, TripDocButtons, TripTimeline } from '../trip';
import type { AdminTabProps } from '../AdminPanel';

type TripFilter = 'pending' | 'active' | 'delivered';

const ACTIVE_STAGES: Trip['stage'][] = ['assigned', 'in_transit', 'customs', 'nearing_destination', 'unloading'];

export const TripsTab: React.FC<AdminTabProps> = ({ onNavigatePanel, onPreviewDriver, goTab, setSelectedTruckId }) => {
  const { state } = useDemo();

  // Primero los pedidos de clientes; dentro de cada grupo, el más antiguo arriba.
  const pending = state.trips
    .filter((t) => t.stage === 'pending_assignment')
    .sort((a, b) => Number(Boolean(b.requestedByClient)) - Number(Boolean(a.requestedByClient)) || a.createdAt - b.createdAt);
  const active = state.trips
    .filter((t) => ACTIVE_STAGES.includes(t.stage))
    .sort(
      (a, b) =>
        tripCompletionPct(b, getCorridor(state, b.corridorId)) - tripCompletionPct(a, getCorridor(state, a.corridorId))
    );
  const delivered = state.trips
    .filter((t) => t.stage === 'delivered')
    .sort((a, b) => (b.deliveredAt ?? 0) - (a.deliveredAt ?? 0));

  const [filter, setFilter] = useState<TripFilter>(() => (pending.length > 0 ? 'pending' : 'active'));
  const [openId, setOpenId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [assigned, setAssigned] = useState<{ tripCode: string; truckId: string } | null>(null);
  const deliveredList = useShowMore(delivered, 8);

  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));
  const openDriver = (truckId: string) => {
    setSelectedTruckId(truckId);
    onPreviewDriver(truckId);
    onNavigatePanel('driver');
  };
  const openMap = (truckId: string) => {
    setSelectedTruckId(truckId);
    goTab('tracking');
  };
  const docCtx = (trip: Trip): DocContext => {
    const truck = getTruck(state, trip.truckId);
    return {
      trip,
      corridor: getCorridor(state, trip.corridorId),
      client: getClient(state, trip.clientId),
      truck,
      driver: getDriver(state, truck?.driverId),
    };
  };
  const assignedTruck = assigned ? getTruck(state, assigned.truckId) : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented<TripFilter>
          value={filter}
          onChange={(f) => {
            setFilter(f);
            setOpenId(null);
          }}
          items={[
            { id: 'pending', label: 'Por asignar', badge: pending.length },
            { id: 'active', label: 'En curso', badge: active.length },
            { id: 'delivered', label: 'Entregados', badge: delivered.length },
          ]}
        />
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> Nuevo viaje
        </Button>
      </div>

      {assigned && assignedTruck && (
        <div className="md-slide-in flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2.5">
          <span className="flex items-center gap-2 text-xs font-bold text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            {assigned.tripCode} asignado a {assignedTruck.code} · {driverNameOf(state, assignedTruck)}. Ya lo ve en su App.
          </span>
          <span className="flex items-center gap-1">
            <Button size="sm" variant="success" onClick={() => openDriver(assignedTruck.id)}>
              <Smartphone className="h-3.5 w-3.5" /> Ver su celular
            </Button>
            <button type="button" onClick={() => setAssigned(null)} className="rounded p-1 text-emerald-700 hover:text-emerald-950" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </span>
        </div>
      )}

      {/* ---------- POR ASIGNAR ---------- */}
      {filter === 'pending' &&
        (pending.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />}
            title="Todos los viajes tienen unidad asignada"
            text="Los pedidos nuevos del Portal de Clientes aparecen acá. También podés cargar un viaje con «Nuevo viaje»."
          />
        ) : (
          <div className="space-y-2">
            {pending.map((trip) => (
              <PendingTripRow
                key={trip.id}
                trip={trip}
                open={openId === trip.id}
                onToggle={() => toggle(trip.id)}
                onAssigned={(truckId) => {
                  setAssigned({ tripCode: trip.code, truckId });
                  setOpenId(null);
                }}
              />
            ))}
          </div>
        ))}

      {/* ---------- EN CURSO ---------- */}
      {filter === 'active' &&
        (active.length === 0 ? (
          <EmptyState icon={<Truck className="h-8 w-8" />} title="No hay viajes en curso" />
        ) : (
          <div className="space-y-2">
            {active.map((trip) => (
              <ActiveTripRow
                key={trip.id}
                trip={trip}
                ctx={docCtx(trip)}
                open={openId === trip.id}
                onToggle={() => toggle(trip.id)}
                onOpenMap={openMap}
                onOpenDriver={openDriver}
              />
            ))}
          </div>
        ))}

      {/* ---------- ENTREGADOS ---------- */}
      {filter === 'delivered' &&
        (delivered.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="h-8 w-8" />} title="Todavía no hay viajes entregados" />
        ) : (
          <div className="space-y-2">
            {deliveredList.visible.map((trip) => {
              const ctx = docCtx(trip);
              const st = invoiceStatus(trip);
              return (
                <ExpandableRow
                  key={trip.id}
                  open={openId === trip.id}
                  onToggle={() => toggle(trip.id)}
                  summary={
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono font-bold">{trip.code}</span>
                          <span className="font-extrabold text-[#B71E23]">{ctx.client?.name}</span>
                        </div>
                        <div className="truncate text-xs text-zinc-600">
                          {shortPlace(ctx.corridor?.origin)} → {shortPlace(ctx.corridor?.destination)} · entregado{' '}
                          {trip.deliveredAt ? dateShort(trip.deliveredAt) : ''}
                        </div>
                      </div>
                      <span
                        className={cx(
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                          st === 'listo' && 'bg-[#FEF2F2] text-[#B71E23]',
                          st === 'emitida' && 'bg-blue-50 text-blue-700',
                          st === 'vencida' && 'bg-red-100 text-red-700',
                          st === 'cobrada' && 'bg-emerald-50 text-emerald-700'
                        )}
                      >
                        {st === 'listo' ? 'Para facturar' : st === 'emitida' ? 'Facturado' : st === 'vencida' ? 'Factura vencida' : 'Cobrado'}
                      </span>
                    </div>
                  }
                >
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Detail label="Unidad" value={ctx.truck ? `${ctx.truck.code} · ${ctx.driver?.name ?? ''}` : '—'} />
                      <Detail label="Recibió" value={trip.delivery?.receiverName ?? '—'} />
                      <Detail label="Remito" value={trip.delivery?.remitoNumber ?? '—'} />
                      <Detail label="Flete" value={usd(trip.agreedTariffUsd)} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <TripDocButtons ctx={ctx} />
                      {st === 'listo' && (
                        <Button size="sm" onClick={() => goTab('finance')}>
                          Facturar en Finanzas <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </ExpandableRow>
              );
            })}
            {deliveredList.toggle}
          </div>
        ))}

      <NewTripModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={(tripCode, truckId) => {
          if (truckId) {
            setAssigned({ tripCode, truckId });
            setFilter('active');
          } else {
            setFilter('pending');
          }
        }}
      />
    </div>
  );
};

// ---------- Viaje por asignar: se expande para elegir la unidad ----------

function PendingTripRow({
  trip,
  open,
  onToggle,
  onAssigned,
}: {
  trip: Trip;
  open: boolean;
  onToggle: () => void;
  onAssigned: (truckId: string) => void;
}) {
  const { state, dispatch } = useDemo();
  const corridor = getCorridor(state, trip.corridorId);
  const client = getClient(state, trip.clientId);
  const candidates = useMemo(
    () => assignmentCandidates(state, trip.corridorId, trip.weightTons),
    [state, trip.corridorId, trip.weightTons]
  );
  const available = candidates.filter((c) => !c.reason);
  const unavailable = candidates.filter((c) => c.reason);
  const [picked, setPicked] = useState<string | null>(null);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const pickedId = picked && available.some((c) => c.truck.id === picked) ? picked : available[0]?.truck.id ?? null;
  const pickedTruck = pickedId ? getTruck(state, pickedId) : undefined;

  if (!corridor) return null;

  return (
    <ExpandableRow
      open={open}
      onToggle={onToggle}
      highlight={trip.requestedByClient}
      summary={
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono font-bold">{trip.code}</span>
              <span className="font-extrabold text-[#B71E23]">{client?.name}</span>
              {trip.requestedByClient ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[10px] font-bold text-[#C25E08]">
                  <Inbox className="h-3 w-3" /> Pedido del cliente
                </span>
              ) : (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600">Cargado por Operaciones</span>
              )}
              {corridor.international && (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">Internacional</span>
              )}
            </div>
            <div className="mt-0.5 truncate text-sm font-extrabold">
              {shortPlace(corridor.origin)} → {shortPlace(corridor.destination)}
            </div>
            <div className="truncate text-[11px] text-zinc-500">
              {num(trip.weightTons, 1)} tn · {trip.palletsCount} pallets · {num(corridor.totalKm)} km
              {trip.pickupDate ? ` · retiro ${trip.pickupDate.split('-').reverse().join('/')}` : ''} · {when(trip.createdAt)}
            </div>
          </div>
          <span className="hidden shrink-0 font-mono text-xs font-bold text-emerald-700 sm:block">{usd(trip.agreedTariffUsd)}</span>
          {!open && (
            <span className="shrink-0 rounded-xl bg-[#B71E23] px-3 py-1.5 text-[11px] font-extrabold text-white">Asignar</span>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        <div className="text-[11px] text-zinc-500">
          {trip.cargoDescription} · {trip.modality} · flete {usd(trip.agreedTariffUsd)}
        </div>

        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Elegí la unidad · ordenadas por cercanía al origen
          </div>
          {available.length === 0 ? (
            <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
              No hay unidades libres con capacidad para esta carga en este momento.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {available.map(({ truck, km }) => {
                const checked = truck.id === pickedId;
                return (
                  <label
                    key={truck.id}
                    className={cx(
                      'flex cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-2 text-[11px] transition',
                      checked ? 'border-[#B71E23] bg-[#FEF2F2]' : 'border-zinc-200 hover:border-zinc-400'
                    )}
                  >
                    <input
                      type="radio"
                      name={`assign-${trip.id}`}
                      checked={checked}
                      onChange={() => setPicked(truck.id)}
                      className="accent-[#B71E23]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">
                        {truck.code} · {driverNameOf(state, truck)}
                      </span>
                      <span className="block truncate text-zinc-500">
                        A {num(km)} km del origen · {truck.trailerType} · {truck.maxCapacityTons} tn
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {unavailable.length > 0 && (
            <button
              type="button"
              onClick={() => setShowUnavailable((v) => !v)}
              className="mt-1.5 text-[11px] font-bold text-zinc-500 hover:text-[#B71E23]"
            >
              {showUnavailable ? 'Ocultar' : 'Ver'} unidades no disponibles ({unavailable.length})
            </button>
          )}
          {showUnavailable && (
            <div className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {unavailable.map(({ truck, reason }) => (
                <div key={truck.id} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-[11px] text-zinc-500">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-bold text-zinc-600">{truck.code}</span> · {driverNameOf(state, truck)} · {reason}
                  </span>
                  <TruckStatusBadge status={truck.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
          {confirmCancel ? (
            <span className="flex items-center gap-2 text-xs">
              <span className="font-bold text-red-700">¿Anular el viaje?</span>
              <Button size="sm" onClick={() => dispatch({ type: 'CANCEL_TRIP', tripId: trip.id })}>
                Sí, anular
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(false)}>
                No
              </Button>
            </span>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(true)}>
              <Ban className="h-3.5 w-3.5" /> Anular
            </Button>
          )}
          <Button
            disabled={!pickedTruck}
            onClick={() => {
              if (!pickedTruck) return;
              dispatch({ type: 'ASSIGN_TRIP', tripId: trip.id, truckId: pickedTruck.id });
              onAssigned(pickedTruck.id);
            }}
          >
            <Truck className="h-3.5 w-3.5" /> {pickedTruck ? `Asignar a ${pickedTruck.code}` : 'Asignar'}
          </Button>
        </div>
      </div>
    </ExpandableRow>
  );
}

// ---------- Viaje en curso: cumplimiento a la vista, detalle al expandir ----------

function ActiveTripRow({
  trip,
  ctx,
  open,
  onToggle,
  onOpenMap,
  onOpenDriver,
}: {
  trip: Trip;
  ctx: DocContext;
  open: boolean;
  onToggle: () => void;
  onOpenMap: (truckId: string) => void;
  onOpenDriver: (truckId: string) => void;
}) {
  const { dispatch } = useDemo();
  const [confirmUnassign, setConfirmUnassign] = useState(false);
  const { corridor, client, truck, driver } = ctx;
  const eta = tripEta(trip, corridor);
  const status =
    trip.stage === 'assigned'
      ? `Cargando en ${shortPlace(corridor?.origin)} · esperando inicio de viaje`
      : trip.stage === 'unloading'
      ? 'En destino · esperando remito conformado'
      : `${eta ? `Llega ${when(eta.ts)}` : 'En ruta'} · ${truck?.locationLabel ?? ''}`;

  return (
    <ExpandableRow
      open={open}
      onToggle={onToggle}
      summary={
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono font-bold">{trip.code}</span>
              <StageBadge stage={trip.stage} />
              <span className="font-extrabold text-[#B71E23]">{client?.name}</span>
            </div>
            <div className="mt-0.5 truncate text-sm font-extrabold">
              {shortPlace(corridor?.origin)} → {shortPlace(corridor?.destination)}
              <span className="ml-2 text-xs font-semibold text-zinc-500">
                {truck?.code} · {driver?.name}
              </span>
            </div>
            <div className="truncate text-[11px] text-zinc-500">{status}</div>
          </div>
          <div className="w-28 shrink-0 sm:w-44">
            <div className="mb-1 text-right text-[10px] font-bold uppercase tracking-wider text-zinc-400">Cumplimiento</div>
            <CompletionMeter pct={tripCompletionPct(trip, corridor)} />
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Detail label="Mercadería" value={trip.cargoDescription} />
          <Detail label="Carga" value={`${num(trip.weightTons, 1)} tn · ${trip.palletsCount} pallets`} />
          <Detail label="Recorrido" value={corridor ? `${num(Math.min(trip.kmDone, corridor.totalKm))} de ${num(corridor.totalKm)} km` : '—'} />
          <Detail label="Velocidad" value={truck ? `${truck.speedKmh} km/h` : '—'} />
          <Detail label="Asignado" value={trip.assignedAt ? when(trip.assignedAt) : '—'} />
          <Detail label="Salida" value={trip.departedAt ? when(trip.departedAt) : 'Pendiente'} />
          <Detail label="Llegada estimada" value={eta ? when(eta.ts) : trip.stage === 'unloading' ? 'En destino' : '—'} />
          <Detail label="Flete" value={usd(trip.agreedTariffUsd)} />
        </div>

        <TripTimeline trip={trip} />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
          <TripDocButtons ctx={ctx} />
          <div className="flex flex-wrap items-center gap-1.5">
            {trip.stage === 'assigned' &&
              (confirmUnassign ? (
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="font-bold text-red-700">¿Quitar la unidad?</span>
                  <Button size="sm" onClick={() => dispatch({ type: 'UNASSIGN_TRIP', tripId: trip.id })}>
                    Sí, quitar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmUnassign(false)}>
                    No
                  </Button>
                </span>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirmUnassign(true)}>
                  <Undo2 className="h-3.5 w-3.5" /> Quitar asignación
                </Button>
              ))}
            {truck && (
              <>
                <Button size="sm" variant="secondary" onClick={() => onOpenDriver(truck.id)}>
                  <Smartphone className="h-3.5 w-3.5" /> Celular del chofer
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onOpenMap(truck.id)}>
                  <MapPin className="h-3.5 w-3.5" /> Ver en mapa
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </ExpandableRow>
  );
}

// ---------- Alta de viaje (sin pedido del cliente), con asignación opcional ----------

function NewTripModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (tripCode: string, truckId?: string) => void;
}) {
  const { state, dispatch } = useDemo();
  const [clientId, setClientId] = useState(state.clients[0]?.id ?? '');
  const [corridorId, setCorridorId] = useState(state.corridors[0]?.id ?? '');
  const [cargo, setCargo] = useState('26 pallets alimentos paletizados');
  const [modality, setModality] = useState<Trip['modality']>('Carga Completa (FTL)');
  const [weight, setWeight] = useState(25);
  const [pallets, setPallets] = useState(26);
  const [pickupDate, setPickupDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [tariffOverride, setTariffOverride] = useState<number | null>(null);
  const [truckId, setTruckId] = useState('');

  const client = getClient(state, clientId);
  const corridor = getCorridor(state, corridorId);
  const suggested = client && corridor ? Math.round(corridor.totalKm * client.ratePerKmUsd) : 0;
  const tariff = tariffOverride ?? suggested;
  const available = useMemo(
    () => assignmentCandidates(state, corridorId, Number(weight) || 0).filter((c) => !c.reason),
    [state, corridorId, weight]
  );
  // Si cambia la ruta o el peso y la unidad elegida deja de servir, se vuelve a "asignar más tarde".
  const validTruckId = available.some((c) => c.truck.id === truckId) ? truckId : '';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !corridor) return;
    const code = `VIA-${state.seq.trip}`;
    dispatch({
      type: 'CREATE_TRIP',
      input: {
        clientId,
        corridorId,
        cargoDescription: cargo.trim() || 'Carga general',
        modality,
        weightTons: Number(weight) || 24,
        palletsCount: Number(pallets) || 24,
        agreedTariffUsd: Number(tariff) || suggested,
        pickupDate,
        truckId: validTruckId || undefined,
      },
    });
    onCreated(code, validTruckId || undefined);
    setTariffOverride(null);
    setTruckId('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Operaciones"
      title="Nuevo viaje"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="new-trip-form">
            {validTruckId ? 'Crear y asignar' : 'Crear viaje'}
          </Button>
        </>
      }
    >
      <form id="new-trip-form" onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Cliente">
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
            {state.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Modalidad">
          <select value={modality} onChange={(e) => setModality(e.target.value as Trip['modality'])} className={inputCls}>
            <option>Carga Completa (FTL)</option>
            <option>Carga Consolidada (LTL)</option>
          </select>
        </Field>
        <Field label="Ruta (origen → destino)" className="sm:col-span-2" hint="La distancia y el tiempo se calculan sobre la ruta real.">
          <select value={corridorId} onChange={(e) => setCorridorId(e.target.value)} className={inputCls}>
            {state.corridors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {num(c.totalKm)} km · ~{Math.round(c.estimatedHours)} h
              </option>
            ))}
          </select>
        </Field>
        <Field label="Detalle de la mercadería" className="sm:col-span-2">
          <input value={cargo} onChange={(e) => setCargo(e.target.value)} className={inputCls} required />
        </Field>
        <div className="grid grid-cols-3 gap-2 sm:col-span-2">
          <Field label="Peso (tn)">
            <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Pallets">
            <input type="number" value={pallets} onChange={(e) => setPallets(Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Fecha de retiro">
            <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field
          label="Tarifa acordada (USD)"
          hint={client && corridor ? `Sugerida ${usd(suggested)} (USD ${client.ratePerKmUsd}/km).` : undefined}
        >
          <input type="number" value={tariff} onChange={(e) => setTariffOverride(Number(e.target.value))} className={inputCls} />
        </Field>
        <Field
          label="Unidad"
          hint={validTruckId ? 'El viaje le aparece al chofer en su App al guardar.' : 'Si no elegís ahora, queda en «Por asignar».'}
        >
          <select value={validTruckId} onChange={(e) => setTruckId(e.target.value)} className={inputCls}>
            <option value="">Asignar más tarde</option>
            {available.map(({ truck, km }) => (
              <option key={truck.id} value={truck.id}>
                {truck.code} · {driverNameOf(state, truck)} · a {num(km)} km
              </option>
            ))}
          </select>
        </Field>
      </form>
    </Modal>
  );
}
