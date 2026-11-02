import React, { useMemo, useState } from 'react';
import { ArrowRight, Ban, CheckCircle2, Clock, Inbox, Plus, Route as RouteIcon, Send, Smartphone, Undo2, UserX } from 'lucide-react';
import { Trip } from '../../types';
import { useDemo } from '../../state/DemoContext';
import { driverNameOf, getClient, getCorridor, nearestTrucksTo } from '../../state/store';
import { positionAtKm } from '../../lib/geo';
import { usd, when, num } from '../../lib/format';
import { Button, Card, cx, EmptyState, Field, inputCls, Modal, SectionHeader, StageBadge, TruckStatusBadge } from '../ui';
import type { AdminTabProps } from '../AdminPanel';

export const DispatchTab: React.FC<AdminTabProps> = ({ onNavigatePanel, onPreviewDriver, goTab, setSelectedTruckId }) => {
  const { state, dispatch } = useDemo();
  const [showNew, setShowNew] = useState(false);

  const pending = state.trips
    .filter((t) => t.stage === 'pending_assignment')
    .sort((a, b) => Number(Boolean(b.requestedByClient)) - Number(Boolean(a.requestedByClient)) || b.createdAt - a.createdAt);
  const loading = state.trips.filter((t) => t.stage === 'assigned');

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-8">
        <SectionHeader
          title={`Cargas pendientes de asignación (${pending.length})`}
          subtitle="Elegí una o varias unidades y publicá la carga: les llega al instante a la App del Chofer. La primera que acepta se la queda."
          actions={
            <>
              <Button variant="secondary" onClick={() => goTab('routes')}>
                <RouteIcon className="h-3.5 w-3.5" /> Nueva ruta
              </Button>
              <Button onClick={() => setShowNew(true)}>
                <Plus className="h-4 w-4" /> Nueva orden de carga
              </Button>
            </>
          }
        />

        {pending.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />}
            title="Todas las cargas están cubiertas"
            text="Creá una nueva orden o esperá solicitudes desde el Portal de Clientes."
          />
        ) : (
          <div className="space-y-3">
            {pending.map((trip) => (
              <PendingLoadCard
                key={trip.id}
                trip={trip}
                onOpenDriver={(truckId) => {
                  onPreviewDriver(truckId);
                  onNavigatePanel('driver');
                }}
              />
            ))}
          </div>
        )}

        {loading.length > 0 && (
          <Card className="p-4">
            <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-zinc-500">
              Asignadas · en carga en origen ({loading.length})
            </div>
            <div className="space-y-2">
              {loading.map((t) => {
                const c = getCorridor(state, t.corridorId);
                const truck = state.trucks.find((x) => x.id === t.truckId);
                return (
                  <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2.5 text-xs">
                    <div>
                      <span className="font-mono font-bold">{t.code}</span> · {getClient(state, t.clientId)?.name} ·{' '}
                      {c?.origin.split(',')[0]} → {c?.destination.split(',')[0]}
                      <div className="text-[11px] text-zinc-500">
                        {truck?.code} · {driverNameOf(state, truck)} · aceptado {t.acceptedAt ? when(t.acceptedAt) : ''} · esperando inicio de viaje desde la App
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (truck) {
                          setSelectedTruckId(truck.id);
                          onPreviewDriver(truck.id);
                        }
                        onNavigatePanel('driver');
                      }}
                    >
                      <Smartphone className="h-3.5 w-3.5" /> Ver celular
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      <div className="lg:col-span-4">
        <Card dark className="p-5">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#F2851D]">Registro trazable</span>
          <h3 className="mt-0.5 text-base font-extrabold">Bitácora de operaciones</h3>
          <div className="mt-4 max-h-[560px] space-y-2.5 overflow-y-auto pr-1">
            {state.notifications.slice(0, 30).map((n) => (
              <div key={n.id} className="space-y-1 rounded-xl border border-white/10 bg-[#222834] p-3">
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="truncate rounded border border-[#CE2329]/40 bg-[#B71E23]/30 px-2 py-0.5 font-bold text-[#F2851D]">
                    {n.channelBadge}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 font-mono text-zinc-400">
                    <Clock className="h-3 w-3" /> {when(n.at)}
                  </span>
                </div>
                <div className="text-xs font-bold">{n.title}</div>
                <p className="text-[11px] leading-relaxed text-zinc-400">{n.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <NewLoadModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
};

function PendingLoadCard({ trip, onOpenDriver }: { trip: Trip; onOpenDriver: (truckId: string) => void }) {
  const { state, dispatch } = useDemo();
  const corridor = getCorridor(state, trip.corridorId);
  const client = getClient(state, trip.clientId);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const candidates = useMemo(() => {
    if (!corridor) return [];
    const o = positionAtKm(corridor, 0);
    return nearestTrucksTo(state, o.lat, o.lng).map(({ truck, km }) => {
      let reason = '';
      if (truck.activeTripId) reason = 'En viaje';
      else if (!truck.driverAvailable) reason = 'Chofer en descanso';
      else if (truck.maxCapacityTons < trip.weightTons) reason = `Capacidad ${truck.maxCapacityTons} tn`;
      else if (trip.rejectedTruckIds.includes(truck.id)) reason = 'Rechazó esta carga';
      return { truck, km, reason };
    });
  }, [state, corridor, trip.weightTons, trip.rejectedTruckIds]);

  if (!corridor) return null;
  const offered = trip.offeredTruckIds;

  return (
    <Card className={cx('p-4', trip.requestedByClient && 'border-[#F2851D]/60')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-[#231F20] px-2 py-0.5 font-mono text-xs font-bold text-white">{trip.code}</span>
          <span className="text-xs font-extrabold text-[#B71E23]">{client?.name}</span>
          {trip.requestedByClient && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[10px] font-bold text-[#C25E08]">
              <Inbox className="h-3 w-3" /> Solicitud del portal
            </span>
          )}
          {corridor.international && (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">Internacional</span>
          )}
          <StageBadge stage={trip.stage} />
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-700">
          Flete {usd(trip.agreedTariffUsd)}
        </span>
      </div>
      <h4 className="mt-2 text-sm font-extrabold">
        {corridor.origin} → {corridor.destination}
      </h4>
      <p className="mt-0.5 text-xs text-zinc-500">
        {trip.cargoDescription} · {trip.weightTons} tn · {trip.palletsCount} pallets · {num(corridor.totalKm)} km (~{Math.round(corridor.estimatedHours)} h)
        {trip.pickupDate ? ` · Retiro ${trip.pickupDate.split('-').reverse().join('/')}` : ''} · creada {when(trip.createdAt)}
      </p>

      {offered.length > 0 ? (
        <div className="mt-3 rounded-xl border border-[#B71E23]/30 bg-[#FEF2F2] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold">
              <Send className="h-3.5 w-3.5 text-[#B71E23]" /> Publicada a {offered.length} chofer(es) · esperando respuesta
            </span>
            <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'WITHDRAW_OFFER', tripId: trip.id })}>
              <Undo2 className="h-3.5 w-3.5" /> Retirar publicación
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {offered.map((id) => {
              const t = state.trucks.find((x) => x.id === id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onOpenDriver(id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-bold hover:border-[#B71E23]"
                >
                  <Smartphone className="h-3.5 w-3.5 text-[#B71E23]" />
                  {driverNameOf(state, t)} ({t?.code}) · abrir su app
                  <ArrowRight className="h-3 w-3" />
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-3 border-t border-zinc-100 pt-3">
          <div className="mb-2 text-[11px] font-bold text-zinc-500">Unidades sugeridas (ordenadas por cercanía al origen)</div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {candidates.slice(0, 6).map(({ truck, km, reason }) => {
              const checked = picked.includes(truck.id);
              return (
                <label
                  key={truck.id}
                  className={cx(
                    'flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] transition',
                    reason ? 'cursor-not-allowed border-zinc-100 bg-zinc-50 opacity-60' : checked ? 'border-[#B71E23] bg-[#FEF2F2]' : 'border-zinc-200 hover:border-zinc-400'
                  )}
                >
                  <input
                    type="checkbox"
                    disabled={Boolean(reason)}
                    checked={checked}
                    onChange={() => setPicked((p) => (checked ? p.filter((x) => x !== truck.id) : [...p, truck.id]))}
                    className="accent-[#B71E23]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">
                      {truck.code} · {driverNameOf(state, truck)}
                    </span>
                    <span className="block truncate text-zinc-500">
                      {reason || `A ${num(km)} km del origen · ${truck.trailerType}`}
                    </span>
                  </span>
                  {reason ? (
                    reason === 'Rechazó esta carga' ? <UserX className="h-3.5 w-3.5 text-zinc-400" /> : <TruckStatusBadge status={truck.status} />
                  ) : null}
                </label>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {confirmCancel ? (
              <span className="flex items-center gap-2 text-xs">
                <span className="font-bold text-red-700">¿Anular la carga?</span>
                <Button size="sm" variant="primary" onClick={() => dispatch({ type: 'CANCEL_TRIP', tripId: trip.id })}>
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
              disabled={picked.length === 0}
              onClick={() => {
                dispatch({ type: 'OFFER_TRIP', tripId: trip.id, truckIds: picked });
                setPicked([]);
              }}
            >
              <Send className="h-3.5 w-3.5" /> Publicar a {picked.length || ''} chofer{picked.length === 1 ? '' : 'es'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function NewLoadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useDemo();
  const [clientId, setClientId] = useState(state.clients[0]?.id ?? '');
  const [corridorId, setCorridorId] = useState(state.corridors[0]?.id ?? '');
  const [cargo, setCargo] = useState('26 pallets alimentos paletizados');
  const [modality, setModality] = useState<Trip['modality']>('Carga Completa (FTL)');
  const [weight, setWeight] = useState(25);
  const [pallets, setPallets] = useState(26);
  const [pickupDate, setPickupDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [tariffOverride, setTariffOverride] = useState<number | null>(null);

  const client = getClient(state, clientId);
  const corridor = getCorridor(state, corridorId);
  const suggested = client && corridor ? Math.round(corridor.totalKm * client.ratePerKmUsd) : 0;
  const tariff = tariffOverride ?? suggested;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !corridor) return;
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
      },
    });
    setTariffOverride(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Módulo de operaciones"
      title="Nueva orden de carga"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="new-load-form">
            Guardar orden
          </Button>
        </>
      }
    >
      <form id="new-load-form" onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Cliente dador de carga">
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
          className="sm:col-span-2"
          hint={client && corridor ? `Sugerida ${usd(suggested)} según tarifa preferencial de ${client.name} (USD ${client.ratePerKmUsd}/km).` : undefined}
        >
          <input type="number" value={tariff} onChange={(e) => setTariffOverride(Number(e.target.value))} className={inputCls} />
        </Field>
      </form>
    </Modal>
  );
}
