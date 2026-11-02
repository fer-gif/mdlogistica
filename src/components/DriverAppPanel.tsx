import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudOff,
  FileText,
  Home,
  ImagePlus,
  MapPin,
  Navigation,
  Package,
  Receipt,
  RefreshCw,
  Route as RouteIcon,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Star,
  Truck,
  User,
  Wifi,
  X,
} from 'lucide-react';
import { PanelId, RouteExpense, Trip } from '../types';
import { useDemo } from '../state/DemoContext';
import { driverNameOf, getClient, getCorridor, getDriver, tripEta, tripProgressPct } from '../state/store';
import { ars, compressImage, expiryState, hhmm, num, usd, USD_ARS_RATE, when, dateShort } from '../lib/format';
import { printTripDocument, tripDocuments } from '../lib/documents';
import { STAGE_META } from '../data/seed';
import { FleetMap } from './FleetMap';
import { Button, cx, ProgressBar, StageBadge } from './ui';
import mdLogo from '../../logo/logo.png';

type PhoneTab = 'inicio' | 'viaje' | 'gastos' | 'perfil';

interface DriverAppPanelProps {
  truckId: string;
  showTruckPicker: boolean;
  onChangeTruck?: (truckId: string) => void;
  onNavigatePanel?: (p: PanelId) => void;
}

const darkInput =
  'w-full rounded-xl border border-white/10 bg-[#121620] px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#F2851D] focus:outline-none disabled:opacity-50';

const cardCls = 'rounded-2xl border border-white/10 bg-[#1D2330] p-3.5';

function expiryTone(mmYYYY: string) {
  const st = expiryState(mmYYYY);
  if (st === 'expired') return { cls: 'text-red-300 bg-red-500/15 border-red-500/30', label: 'Vencido' };
  if (st === 'soon') return { cls: 'text-amber-200 bg-amber-500/15 border-amber-500/30', label: 'Por vencer' };
  return { cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25', label: 'Al día' };
}

/** Genera una foto de remito de ejemplo para poder probar la demo desde una computadora. */
function sampleRemitoImage(tripCode: string, clientName: string): string {
  const c = document.createElement('canvas');
  c.width = 600;
  c.height = 780;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#f7f3e8';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#B71E23';
  ctx.fillRect(0, 0, c.width, 70);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 30px Arial';
  ctx.fillText('MD LOGÍSTICA S.R.L.', 28, 46);
  ctx.fillStyle = '#231F20';
  ctx.font = 'bold 34px Arial';
  ctx.fillText('REMITO R-0008 · CONFORMADO', 28, 130);
  ctx.font = '22px Arial';
  const lines = [
    `Viaje: ${tripCode}`,
    `Cliente: ${clientName}`,
    `Fecha: ${dateShort(Date.now())} ${hhmm(Date.now())}`,
    'Mercadería recibida en conformidad.',
    'Cantidad de bultos: según carta de porte.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, 28, 190 + i * 40));
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  for (let y = 420; y < 600; y += 36) {
    ctx.beginPath();
    ctx.moveTo(28, y);
    ctx.lineTo(572, y);
    ctx.stroke();
  }
  // firma
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(60, 690);
  ctx.bezierCurveTo(110, 630, 150, 730, 200, 670);
  ctx.bezierCurveTo(240, 620, 270, 720, 330, 660);
  ctx.stroke();
  ctx.fillStyle = '#231F20';
  ctx.font = '18px Arial';
  ctx.fillText('Firma y aclaración del receptor', 60, 730);
  // sello
  ctx.strokeStyle = '#B71E23';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(470, 680, 70, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#B71E23';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('RECIBIDO', 418, 688);
  return c.toDataURL('image/jpeg', 0.7);
}

export const DriverAppPanel: React.FC<DriverAppPanelProps> = ({
  truckId,
  showTruckPicker,
  onChangeTruck,
  onNavigatePanel,
}) => {
  const { state, dispatch, driverAction } = useDemo();
  const truck = state.trucks.find((t) => t.id === truckId) ?? state.trucks[0];
  const driver = getDriver(state, truck?.driverId);
  const activeTrip = truck?.activeTripId ? state.trips.find((t) => t.id === truck.activeTripId) : undefined;
  const corridor = activeTrip ? getCorridor(state, activeTrip.corridorId) : undefined;
  const offline = state.isOffline;

  const offers = state.trips.filter(
    (t) => t.stage === 'pending_assignment' && truck && t.offeredTruckIds.includes(truck.id)
  );
  const myMessages = state.messages.filter((m) => truck && (m.truckIds.length === 0 || m.truckIds.includes(truck.id)));
  const unread = myMessages.filter((m) => truck && !m.readBy.includes(truck.id));

  const [tab, setTab] = useState<PhoneTab>(activeTrip ? 'viaje' : 'inicio');
  const [flash, setFlash] = useState<string | null>(null);
  const [openOffer, setOpenOffer] = useState<string | null>(null);

  // Remito
  const [receiverName, setReceiverName] = useState('');
  const [receiverDni, setReceiverDni] = useState('');
  const [remitoPhoto, setRemitoPhoto] = useState<string | undefined>();
  // Gasto
  const [expCategory, setExpCategory] = useState<RouteExpense['category']>('Combustible');
  const [expArs, setExpArs] = useState<number>(120000);
  const [expNote, setExpNote] = useState('YPF RN 14 · Ticket 0004-1182');
  const [expPhoto, setExpPhoto] = useState<string | undefined>();
  const [photoError, setPhotoError] = useState<string | null>(null);

  const remitoInputRef = useRef<HTMLInputElement | null>(null);
  const expInputRef = useRef<HTMLInputElement | null>(null);

  // Al cambiar de celular (vista previa) se vuelve al inicio.
  useEffect(() => {
    setTab(truck?.activeTripId ? 'viaje' : 'inicio');
    setOpenOffer(null);
    setReceiverName('');
    setReceiverDni('');
    setRemitoPhoto(undefined);
    setExpPhoto(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [truckId]);

  // Los comunicados se marcan como leídos al quedar visibles en Inicio.
  useEffect(() => {
    if (tab !== 'inicio' || unread.length === 0 || !truck) return;
    const t = setTimeout(() => dispatch({ type: 'MARK_MESSAGES_READ', truckId: truck.id }), 2500);
    return () => clearTimeout(t);
  }, [tab, unread.length, truck, dispatch]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(t);
  }, [flash]);

  if (!truck) return null;

  const showFlash = (result: 'sent' | 'queued', sentMsg: string) =>
    setFlash(result === 'queued' ? 'Guardado sin señal · se enviará al reconectar' : sentMsg);

  const handlePhoto = async (file: File | undefined, set: (v: string) => void) => {
    if (!file) return;
    setPhotoError(null);
    try {
      set(await compressImage(file));
    } catch {
      setPhotoError('No se pudo leer la imagen. Probá con otra foto.');
    }
  };

  const client = activeTrip ? getClient(state, activeTrip.clientId) : undefined;
  const remainingKm = activeTrip && corridor ? Math.max(0, corridor.totalKm - activeTrip.kmDone) : 0;
  const eta = activeTrip ? tripEta(activeTrip, corridor) : null;
  const destPoint = corridor ? corridor.path[corridor.path.length - 1] : undefined;

  const myExpenses = state.expenses.filter((e) => e.truckId === truck.id).sort((a, b) => b.createdAt - a.createdAt);
  const history = state.trips
    .filter((t) => t.stage === 'delivered' && t.truckId === truck.id)
    .sort((a, b) => (b.deliveredAt ?? 0) - (a.deliveredAt ?? 0));

  const startTrip = (trip: Trip) => {
    const r = driverAction({ type: 'start_trip', tripId: trip.id, description: `Inicio de viaje ${trip.code}` });
    showFlash(r, 'Viaje iniciado · la oficina y el cliente ya lo ven en el mapa');
  };
  const arrive = (trip: Trip) => {
    const r = driverAction({ type: 'arrive', tripId: trip.id, description: `Llegada a destino ${trip.code}` });
    showFlash(r, 'Llegada confirmada · ahora subí el remito conformado');
  };
  const submitRemito = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip || !receiverName.trim() || !receiverDni.trim()) return;
    const r = driverAction({
      type: 'upload_remito',
      tripId: activeTrip.id,
      receiverName: receiverName.trim(),
      receiverDni: receiverDni.trim(),
      photoDataUrl: remitoPhoto,
      description: `Remito conformado ${activeTrip.code}`,
    });
    showFlash(r, 'Remito enviado · viaje finalizado y listo para facturar');
    setReceiverName('');
    setReceiverDni('');
    setRemitoPhoto(undefined);
  };
  const submitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip || !expArs || expArs <= 0) return;
    const r = driverAction({
      type: 'add_expense',
      tripId: activeTrip.id,
      category: expCategory,
      amountArs: Math.round(expArs),
      note: expNote.trim() || expCategory,
      photoDataUrl: expPhoto,
      description: `Gasto ${expCategory.toLowerCase()} ${ars(expArs)} · ${activeTrip.code}`,
    });
    showFlash(r, 'Gasto enviado a Finanzas para auditoría');
    setExpPhoto(undefined);
  };

  const isDriverRole = !onNavigatePanel;

  // ---------------- Pestañas del celular ----------------

  const renderInicio = () => (
    <div className="space-y-3.5">
      <div className={cx(cardCls, 'flex items-center justify-between gap-3')}>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Estado del chofer</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-sm font-bold">
            <span className={cx('h-2.5 w-2.5 rounded-full', truck.driverAvailable ? 'bg-emerald-400' : 'bg-zinc-500')} />
            {truck.driverAvailable ? 'Disponible para cargas' : 'En descanso'}
          </div>
          <div className="truncate text-[11px] text-zinc-400">{truck.locationLabel}</div>
          {offline && <div className="mt-0.5 text-[10px] font-semibold text-amber-300">Requiere señal</div>}
        </div>
        <button
          type="button"
          disabled={offline}
          onClick={() => dispatch({ type: 'TOGGLE_AVAILABILITY', truckId: truck.id })}
          className={cx(
            'relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-40',
            truck.driverAvailable ? 'bg-emerald-500' : 'bg-zinc-600'
          )}
          aria-label="Cambiar disponibilidad"
        >
          <span
            className={cx(
              'absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all',
              truck.driverAvailable ? 'left-7' : 'left-1'
            )}
          />
        </button>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-300">Cargas ofrecidas</span>
          {offers.length > 0 && (
            <span className="rounded-full bg-[#CE2329] px-2 py-0.5 text-[10px] font-extrabold">{offers.length} nueva(s)</span>
          )}
        </div>
        {offers.length === 0 ? (
          <div className={cx(cardCls, 'text-center text-xs text-zinc-400')}>
            <Package className="mx-auto mb-1.5 h-6 w-6 text-zinc-500" />
            No tenés cargas ofrecidas. Cuando Operaciones te publique una, te llega acá al instante.
          </div>
        ) : (
          <div className="space-y-3">
            {offers.map((trip) => {
              const c = getCorridor(state, trip.corridorId);
              const cl = getClient(state, trip.clientId);
              const expanded = openOffer === trip.id;
              const blockReason = offline
                ? 'Requiere señal'
                : truck.activeTripId
                ? 'Terminá tu viaje en curso para aceptar otra carga'
                : !truck.driverAvailable
                ? 'Activá tu disponibilidad para aceptar'
                : null;
              return (
                <div key={trip.id} className="rounded-2xl border-2 border-[#CE2329] bg-gradient-to-b from-[#B71E23]/25 to-[#1D2330] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-[#CE2329] px-2.5 py-0.5 text-[10px] font-extrabold uppercase">Nueva carga</span>
                    <span className="font-mono text-xs font-bold text-zinc-300">{trip.code}</span>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#F2851D]">{cl?.name}</div>
                    <div className="mt-0.5 text-sm font-extrabold leading-snug">
                      {c?.origin.split(',')[0]} → {c?.destination.split(',')[0]}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-300">
                      {trip.cargoDescription} · {num(trip.weightTons, 1)} tn
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded-lg bg-black/25 px-1.5 py-1.5">
                      <div className="text-[9px] uppercase text-zinc-400">Distancia</div>
                      <div className="font-mono text-xs font-bold">{c ? num(c.totalKm) : '—'} km</div>
                    </div>
                    <div className="rounded-lg bg-black/25 px-1.5 py-1.5">
                      <div className="text-[9px] uppercase text-zinc-400">Tu pago</div>
                      <div className="font-mono text-xs font-bold text-emerald-300">{usd(trip.driverSettlementUsd)}</div>
                    </div>
                    <div className="rounded-lg bg-black/25 px-1.5 py-1.5">
                      <div className="text-[9px] uppercase text-zinc-400">Carga</div>
                      <div className="text-xs font-bold">{trip.pickupDate ?? 'Inmediata'}</div>
                    </div>
                  </div>

                  {expanded && c && (
                    <div className="rounded-xl bg-black/25 p-2.5 text-[11px] text-zinc-300 space-y-1.5">
                      <div>
                        <span className="text-zinc-400">Recorrido: </span>
                        {c.name} · ~{num(c.estimatedHours, 1)} h de manejo
                        {c.international && <span className="ml-1 font-bold text-violet-300">· Cruce internacional</span>}
                      </div>
                      <div>
                        <span className="text-zinc-400">Modalidad: </span>
                        {trip.modality} · {trip.palletsCount} pallets
                      </div>
                      <div className="pt-1">
                        <div className="mb-1 text-[10px] font-bold uppercase text-zinc-400">Puntos de control</div>
                        <ol className="space-y-0.5">
                          {c.checkpoints.map((cp) => (
                            <li key={cp.label} className="flex justify-between gap-2">
                              <span className="truncate">{cp.label}</span>
                              <span className="font-mono text-zinc-500">km {cp.km}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={Boolean(blockReason)}
                    onClick={() => {
                      dispatch({ type: 'ACCEPT_OFFER', tripId: trip.id, truckId: truck.id });
                      setTab('viaje');
                      setFlash('Viaje aceptado · dirigite al punto de carga');
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#B71E23] py-3.5 text-sm font-extrabold shadow-md transition hover:bg-[#96171B] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Aceptar viaje
                  </button>
                  {blockReason && <div className="text-center text-[10px] font-semibold text-amber-300">{blockReason}</div>}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={offline}
                      onClick={() => dispatch({ type: 'REJECT_OFFER', tripId: trip.id, truckId: truck.id })}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-bold text-zinc-200 hover:border-white/30 disabled:opacity-40"
                    >
                      <X className="h-3.5 w-3.5" /> Rechazar
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenOffer(expanded ? null : trip.id)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-bold text-zinc-200 hover:border-white/30"
                    >
                      {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {expanded ? 'Ocultar' : 'Ver detalle'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeTrip && (
        <button
          type="button"
          onClick={() => setTab('viaje')}
          className={cx(cardCls, 'flex w-full items-center justify-between text-left hover:border-[#CE2329]')}
        >
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Viaje en curso</div>
            <div className="truncate text-sm font-bold">
              {activeTrip.code} · {STAGE_META[activeTrip.stage].short}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-[#F2851D]" />
        </button>
      )}

      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-zinc-300">
          <Bell className="h-3.5 w-3.5 text-[#F2851D]" /> Comunicados de la oficina
        </div>
        {myMessages.length === 0 ? (
          <div className={cx(cardCls, 'text-xs text-zinc-400')}>Sin comunicados.</div>
        ) : (
          <div className="space-y-2">
            {myMessages.slice(0, 4).map((m) => {
              const isNew = !m.readBy.includes(truck.id);
              return (
                <div key={m.id} className={cx(cardCls, isNew && 'border-[#F2851D]/50')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold">{m.title}</span>
                    {isNew ? (
                      <span className="shrink-0 rounded-full bg-[#F2851D] px-1.5 py-0.5 text-[9px] font-extrabold text-[#181D26]">NUEVO</span>
                    ) : (
                      <span className="shrink-0 text-[10px] text-zinc-500">{when(m.at)}</span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-300">{m.body}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderViaje = () => {
    if (!activeTrip || !corridor) {
      return (
        <div className={cx(cardCls, 'p-5 text-center space-y-2')}>
          <Truck className="mx-auto h-8 w-8 text-zinc-500" />
          <div className="text-sm font-bold">Sin viaje en curso</div>
          <p className="text-xs text-zinc-400">
            Estás en {truck.locationLabel}. Cuando aceptes una carga vas a ver acá el recorrido, la navegación y la documentación.
          </p>
          {offers.length > 0 && (
            <button
              type="button"
              onClick={() => setTab('inicio')}
              className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#F2851D]"
            >
              Ver {offers.length} carga(s) ofrecida(s) <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      );
    }
    const pct = tripProgressPct(activeTrip, corridor);
    const docs = tripDocuments({ trip: activeTrip, corridor, client, truck, driver });
    return (
      <div className="space-y-3.5">
        <div className={cx(cardCls, 'space-y-2.5')}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs font-bold text-[#F2851D]">{activeTrip.code}</span>
            <StageBadge stage={activeTrip.stage} />
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-300">{client?.name}</div>
            <div className="text-sm font-extrabold leading-snug">
              {corridor.origin.split(',')[0]} → {corridor.destination.split(',')[0]}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-400">
              {activeTrip.cargoDescription} · {num(activeTrip.weightTons, 1)} tn · Precinto {truck.cargoSeal}
            </div>
          </div>
          <ProgressBar pct={pct} className="bg-white/10" />
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded-lg bg-black/25 px-1 py-1.5">
              <div className="text-[9px] uppercase text-zinc-400">Recorrido</div>
              <div className="font-mono text-[11px] font-bold">
                {num(activeTrip.kmDone)}/{num(corridor.totalKm)} km
              </div>
            </div>
            <div className="rounded-lg bg-black/25 px-1 py-1.5">
              <div className="text-[9px] uppercase text-zinc-400">Restan</div>
              <div className="font-mono text-[11px] font-bold">{num(remainingKm)} km</div>
            </div>
            <div className="rounded-lg bg-black/25 px-1 py-1.5">
              <div className="text-[9px] uppercase text-zinc-400">ETA</div>
              <div className="font-mono text-[11px] font-bold">{eta ? (new Date(eta.ts).getDate() === new Date().getDate() ? `${hhmm(eta.ts)} hs` : `Mañ. ${hhmm(eta.ts)}`) : "—"}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-300">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#CE2329]" />
            <span className="truncate">{truck.locationLabel}</span>
            {truck.speedKmh > 0 && <span className="ml-auto shrink-0 font-mono text-[11px] text-zinc-400">{truck.speedKmh} km/h</span>}
          </div>

          <FleetMap
            trucks={[truck]}
            trips={[activeTrip]}
            corridors={state.corridors}
            selectedTruckId={truck.id}
            variant="compact"
            heightClass="h-[190px]"
          />

          {destPoint && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${destPoint[0]},${destPoint[1]}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 py-2 text-xs font-bold text-zinc-100 hover:border-[#F2851D]"
            >
              <Navigation className="h-3.5 w-3.5 text-[#F2851D]" /> Abrir navegación a destino
            </a>
          )}
        </div>

        {/* Acción principal según etapa */}
        {activeTrip.stage === 'assigned' && (
          <button
            type="button"
            onClick={() => startTrip(activeTrip)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#B71E23] to-[#D9411E] py-4 text-sm font-extrabold shadow-lg transition hover:brightness-110 active:scale-[0.99]"
          >
            <Navigation className="h-4 w-4" /> Carga completa · Iniciar viaje
          </button>
        )}

        {(activeTrip.stage === 'in_transit' || activeTrip.stage === 'nearing_destination') &&
          (remainingKm <= 20 ? (
            <button
              type="button"
              onClick={() => arrive(activeTrip)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#B71E23] to-[#D9411E] py-4 text-sm font-extrabold shadow-lg transition hover:brightness-110 active:scale-[0.99]"
            >
              <MapPin className="h-4 w-4" /> Confirmar llegada a destino
            </button>
          ) : (
            <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-xs text-emerald-200">
              <RouteIcon className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>
                <strong>En viaje</strong> · el GPS reporta automáticamente. El botón de llegada se habilita a 20 km del destino.
              </span>
            </div>
          ))}

        {activeTrip.stage === 'customs' && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-violet-500/35 bg-violet-500/10 px-3.5 py-3 text-xs text-violet-200">
            <ShieldCheck className="h-4 w-4 shrink-0 text-violet-300" />
            <span>
              <strong>En aduana · trámite en curso.</strong> MIC/DTA y CRT presentados digitalmente. Tiempo estimado restante:{' '}
              {num(Math.max(0, activeTrip.customsHoursLeft ?? 0), 1)} h.
            </span>
          </div>
        )}

        {activeTrip.stage === 'unloading' && (
          <form onSubmit={submitRemito} className="rounded-2xl border-2 border-[#F2851D]/70 bg-[#1D2330] p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#F2851D]">
              <Camera className="h-4 w-4" /> Remito conformado · cerrar entrega
            </div>
            <input
              className={darkInput}
              placeholder="Nombre de quien recibe"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              required
            />
            <input
              className={darkInput}
              placeholder="DNI de quien recibe"
              inputMode="numeric"
              value={receiverDni}
              onChange={(e) => setReceiverDni(e.target.value)}
              required
            />
            <input
              ref={remitoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                void handlePhoto(e.target.files?.[0], setRemitoPhoto);
                e.target.value = '';
              }}
            />
            {remitoPhoto ? (
              <div className="relative">
                <img src={remitoPhoto} alt="Foto del remito" className="h-36 w-full rounded-xl border border-white/10 object-cover" />
                <button
                  type="button"
                  onClick={() => setRemitoPhoto(undefined)}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
                  aria-label="Quitar foto"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => remitoInputRef.current?.click()}
                  className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-white/20 py-3 text-[11px] font-bold text-zinc-200 hover:border-[#F2851D]"
                >
                  <Camera className="h-5 w-5 text-[#F2851D]" /> Sacar foto
                </button>
                <button
                  type="button"
                  onClick={() => setRemitoPhoto(sampleRemitoImage(activeTrip.code, client?.name ?? ''))}
                  className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-white/20 py-3 text-[11px] font-bold text-zinc-200 hover:border-[#F2851D]"
                >
                  <ImagePlus className="h-5 w-5 text-zinc-400" /> Usar foto de ejemplo
                </button>
              </div>
            )}
            {photoError && <div className="text-[11px] text-red-300">{photoError}</div>}
            <button
              type="submit"
              disabled={!receiverName.trim() || !receiverDni.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#B71E23] py-3.5 text-sm font-extrabold transition hover:bg-[#96171B] disabled:opacity-40"
            >
              <CheckCircle2 className="h-4 w-4" /> Enviar remito y finalizar viaje
            </button>
          </form>
        )}

        <div className={cardCls}>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-zinc-300">
            <FileText className="h-3.5 w-3.5 text-[#F2851D]" /> Documentación del viaje
          </div>
          <div className="space-y-1.5">
            {docs.map((d) => (
              <button
                key={d.key}
                type="button"
                disabled={!d.available}
                onClick={() => printTripDocument(d.key, { trip: activeTrip, corridor, client, truck, driver })}
                className="flex w-full items-center justify-between gap-2 rounded-lg bg-black/25 px-2.5 py-2 text-left text-xs hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{d.short}</span>
                  <span className="block truncate font-mono text-[10px] text-zinc-400">{d.available ? d.code : d.pendingNote}</span>
                </span>
                {d.available ? (
                  <span className="shrink-0 text-[10px] font-bold text-emerald-300">Ver</span>
                ) : (
                  <Clock className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderGastos = () => (
    <div className="space-y-3.5">
      <form onSubmit={submitExpense} className={cx(cardCls, 'space-y-2.5')}>
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#F2851D]">
          <Receipt className="h-4 w-4" /> Rendir gasto de ruta
        </div>
        {!activeTrip && (
          <div className="rounded-lg bg-black/25 px-2.5 py-2 text-[11px] text-zinc-400">
            Los gastos se imputan a un viaje. Vas a poder cargarlos cuando tengas un viaje en curso.
          </div>
        )}
        <select
          className={darkInput}
          value={expCategory}
          disabled={!activeTrip}
          onChange={(e) => setExpCategory(e.target.value as RouteExpense['category'])}
        >
          <option value="Combustible">Combustible</option>
          <option value="Peajes">Peajes</option>
          <option value="Mantenimiento en Ruta">Mantenimiento en ruta</option>
          <option value="Viáticos">Viáticos</option>
        </select>
        <div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">$</span>
            <input
              type="number"
              min={1}
              className={cx(darkInput, 'pl-7 pr-12 font-mono font-bold')}
              value={expArs || ''}
              disabled={!activeTrip}
              onChange={(e) => setExpArs(Number(e.target.value))}
              placeholder="Importe"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400">ARS</span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            ≈ {usd(Math.round((expArs || 0) / USD_ARS_RATE))} · TC {num(USD_ARS_RATE)}
          </div>
        </div>
        <input
          className={darkInput}
          value={expNote}
          disabled={!activeTrip}
          onChange={(e) => setExpNote(e.target.value)}
          placeholder="Estación, peaje o detalle"
        />
        <input
          ref={expInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void handlePhoto(e.target.files?.[0], setExpPhoto);
            e.target.value = '';
          }}
        />
        {expPhoto ? (
          <div className="flex items-center gap-2">
            <img src={expPhoto} alt="Ticket" className="h-14 w-14 rounded-lg border border-white/10 object-cover" />
            <span className="flex-1 text-[11px] text-emerald-300">Foto del ticket adjunta</span>
            <button type="button" onClick={() => setExpPhoto(undefined)} className="text-zinc-400 hover:text-white" aria-label="Quitar foto">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!activeTrip}
            onClick={() => expInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 py-2.5 text-[11px] font-bold text-zinc-200 hover:border-[#F2851D] disabled:opacity-40"
          >
            <Camera className="h-4 w-4 text-[#F2851D]" /> Foto del ticket (opcional)
          </button>
        )}
        {photoError && <div className="text-[11px] text-red-300">{photoError}</div>}
        <button
          type="submit"
          disabled={!activeTrip || !expArs || expArs <= 0}
          className="w-full rounded-xl bg-[#B71E23] py-3 text-sm font-extrabold transition hover:bg-[#96171B] disabled:opacity-40"
        >
          Enviar a Finanzas
        </button>
      </form>

      <div>
        <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-zinc-300">Mis gastos rendidos</div>
        {myExpenses.length === 0 ? (
          <div className={cx(cardCls, 'text-xs text-zinc-400')}>Todavía no rendiste gastos con esta unidad.</div>
        ) : (
          <div className="space-y-2">
            {myExpenses.slice(0, 12).map((e) => {
              const trip = state.trips.find((t) => t.id === e.tripId);
              const pill =
                e.status === 'aprobado'
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : e.status === 'rechazado'
                  ? 'bg-red-500/15 text-red-300'
                  : 'bg-amber-500/15 text-amber-200';
              return (
                <div key={e.id} className={cx(cardCls, 'py-2.5')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold">
                      {e.category} <span className="font-mono text-[10px] text-zinc-400">· {trip?.code}</span>
                    </span>
                    <span className={cx('rounded-full px-2 py-0.5 text-[10px] font-bold capitalize', pill)}>{e.status}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="truncate text-zinc-400">{e.note}</span>
                    <span className="shrink-0 font-mono font-bold">
                      {ars(e.amountArs)} <span className="text-zinc-500">· {usd(e.amountUsd)}</span>
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-500">
                    {when(e.createdAt)} · {e.source}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderPerfil = () => {
    const lic = driver ? expiryTone(driver.licenseExpiry) : null;
    const vtv = expiryTone(truck.vtvExpiry);
    const ins = expiryTone(truck.insuranceExpiry);
    const totalKm = history.reduce((s, t) => s + (getCorridor(state, t.corridorId)?.totalKm ?? 0), 0);
    return (
      <div className="space-y-3.5">
        <div className={cx(cardCls, 'flex items-center gap-3')}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#B71E23] text-base font-extrabold">
            {(driver?.name ?? '?')
              .split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('')}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold">{driver?.name}</div>
            <div className="text-[11px] text-zinc-400">
              DNI {driver?.dni} · {driver?.employmentType}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-amber-300">
              <Star className="h-3 w-3 fill-amber-300" /> {num(driver?.rating ?? 0, 1)} puntuación interna
            </div>
          </div>
        </div>

        <div className={cx(cardCls, 'space-y-2')}>
          <div className="text-xs font-extrabold uppercase tracking-wider text-zinc-300">Mi documentación</div>
          {driver && lic && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0">
                <span className="block font-semibold">Licencia LINTI</span>
                <span className="block truncate text-[10px] text-zinc-400">{driver.licenseCategory}</span>
              </span>
              <span className={cx('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold', lic.cls)}>
                {lic.label} · {driver.licenseExpiry}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold">VTV / RTO {truck.code}</span>
            <span className={cx('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold', vtv.cls)}>
              {vtv.label} · {truck.vtvExpiry}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold">Seguro de la unidad</span>
            <span className={cx('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold', ins.cls)}>
              {ins.label} · {truck.insuranceExpiry}
            </span>
          </div>
          {[lic, vtv, ins].some((x) => x && x.label !== 'Al día') && (
            <div className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Tenés documentación por vencer. Administración ya recibió el aviso automático.
            </div>
          )}
        </div>

        <div className={cx(cardCls, 'space-y-1.5 text-xs')}>
          <div className="text-xs font-extrabold uppercase tracking-wider text-zinc-300">Mi unidad</div>
          <div className="flex justify-between"><span className="text-zinc-400">Tractor</span><span className="font-semibold">{truck.code} · {truck.brand} {truck.model} ({truck.year})</span></div>
          <div className="flex justify-between"><span className="text-zinc-400">Patentes</span><span className="font-mono">{truck.tractorPlate} / {truck.trailerPlate}</span></div>
          <div className="flex justify-between"><span className="text-zinc-400">Semirremolque</span><span>{truck.trailerType} · {truck.maxCapacityTons} tn</span></div>
          <div className="flex justify-between"><span className="text-zinc-400">Odómetro</span><span className="font-mono">{num(truck.odometerKm)} km</span></div>
          <div className="flex justify-between"><span className="text-zinc-400">Combustible</span><span className="font-mono">{Math.round(truck.fuelPct)}%</span></div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-zinc-300">
            <span>Historial de viajes</span>
            <span className="font-mono text-[10px] normal-case text-zinc-400">{history.length} viajes · {num(totalKm)} km</span>
          </div>
          {history.length === 0 ? (
            <div className={cx(cardCls, 'text-xs text-zinc-400')}>Sin viajes finalizados con esta unidad.</div>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 10).map((t) => {
                const c = getCorridor(state, t.corridorId);
                return (
                  <div key={t.id} className={cx(cardCls, 'py-2.5')}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-[#F2851D]">{t.code}</span>
                      <span className="text-[10px] text-zinc-400">{t.deliveredAt ? dateShort(t.deliveredAt) : ''}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] font-semibold">
                      {c?.origin.split(',')[0]} → {c?.destination.split(',')[0]}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {getClient(state, t.clientId)?.name} · {c ? num(c.totalKm) : '—'} km
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const tabs: { id: PhoneTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'inicio', label: 'Inicio', icon: <Home className="h-5 w-5" />, badge: offers.length + unread.length },
    { id: 'viaje', label: 'Viaje', icon: <RouteIcon className="h-5 w-5" /> },
    { id: 'gastos', label: 'Gastos', icon: <Receipt className="h-5 w-5" /> },
    { id: 'perfil', label: 'Perfil', icon: <User className="h-5 w-5" /> },
  ];

  const phone = (
    <div className="w-full max-w-[400px]">
      {showTruckPicker && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-zinc-200 bg-white px-3.5 py-2 shadow-sm">
          <div className="flex shrink-0 items-center gap-2 text-xs font-bold text-zinc-600">
            <Smartphone className="h-4 w-4 text-[#B71E23]" />
            <span>Vista previa del celular de:</span>
          </div>
          <select
            value={truck.id}
            onChange={(e) => onChangeTruck?.(e.target.value)}
            className="min-w-0 flex-1 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs font-extrabold text-[#231F20] focus:outline-none"
          >
            {state.trucks.map((t) => {
              const hasOffer = state.trips.some((tr) => tr.stage === 'pending_assignment' && tr.offeredTruckIds.includes(t.id));
              return (
                <option key={t.id} value={t.id}>
                  {driverNameOf(state, t)} · {t.code}
                  {hasOffer ? ' · oferta nueva' : ''}
                </option>
              );
            })}
          </select>
        </div>
      )}

      <div
        className={cx(
          'overflow-hidden bg-[#121620] text-white shadow-2xl',
          isDriverRole
            ? 'rounded-2xl border-0 sm:rounded-[40px] sm:border-[10px] sm:border-[#181D26]'
            : 'rounded-[40px] border-[10px] border-[#181D26]'
        )}
      >
        {/* Encabezado de la app */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#181D26] px-4 pt-3 pb-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="shrink-0 rounded-lg bg-white px-1.5 py-1 shadow-sm">
              <img src={mdLogo} alt="MD Logística" className="h-7 w-auto object-contain" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#F2851D]">App Chofer · {truck.code}</div>
              <div className="truncate text-sm font-extrabold">{driver?.name ?? 'Chofer'}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_OFFLINE', offline: !offline })}
            className={cx(
              'flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition',
              offline ? 'bg-[#F2851D] text-[#181D26]' : 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
            )}
            title="Simular corte de señal en ruta"
          >
            {offline ? <CloudOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
            {offline ? 'Sin señal' : '4G'}
          </button>
        </div>

        {offline && (
          <div className="space-y-1.5 border-b border-[#F2851D]/30 bg-[#F2851D]/15 px-4 py-2.5 text-xs text-amber-100">
            <div className="flex items-center gap-2">
              <CloudOff className="h-4 w-4 shrink-0 text-[#F2851D]" />
              <span className="flex-1">
                Sin señal. <strong>{state.offlineQueue.length} evento(s)</strong> guardados en el celular.
              </span>
            </div>
            {state.offlineQueue.length > 0 && (
              <ul className="space-y-0.5 pl-6 text-[11px] text-amber-200/90">
                {state.offlineQueue.map((q) => (
                  <li key={q.id} className="list-disc">
                    {q.description} <span className="text-amber-200/50">· {hhmm(q.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_OFFLINE', offline: false })}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#F2851D] py-1.5 text-[11px] font-extrabold text-[#181D26]"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reconectar y sincronizar
            </button>
          </div>
        )}

        {flash && (
          <div className="md-slide-in flex items-center gap-2 border-b border-white/10 bg-emerald-500/15 px-4 py-2 text-[11px] font-semibold text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            {flash}
          </div>
        )}

        <div className="h-[600px] overflow-y-auto p-4">
          {tab === 'inicio' && renderInicio()}
          {tab === 'viaje' && renderViaje()}
          {tab === 'gastos' && renderGastos()}
          {tab === 'perfil' && renderPerfil()}
        </div>

        {/* Barra de navegación inferior */}
        <nav className="grid grid-cols-4 border-t border-white/10 bg-[#181D26] px-1 pb-2 pt-1.5">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cx(
                  'relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold transition',
                  active ? 'text-[#F2851D]' : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                {t.icon}
                {t.label}
                {t.badge ? (
                  <span className="absolute right-[22%] top-0.5 min-w-[16px] rounded-full bg-[#CE2329] px-1 text-[9px] font-extrabold leading-4 text-white">
                    {t.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );

  if (isDriverRole) {
    return <div className="flex justify-center">{phone}</div>;
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <div className="flex flex-col items-center lg:col-span-5">{phone}</div>

      <div className="space-y-4 lg:col-span-7">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#FEF2F2] px-3 py-1 text-xs font-extrabold text-[#B71E23]">
            App del Chofer · Ruta conectada con la oficina
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-[#231F20] sm:text-2xl">
            Botones grandes, una mano y funcionamiento sin señal.
          </h2>
          <p className="text-sm leading-relaxed text-zinc-600">
            Cada acción del chofer en el celular (aceptar una carga, iniciar el viaje, confirmar la llegada, subir el remito o
            rendir un ticket) impacta en el acto en el resto de la plataforma, sin llamadas ni mensajes de WhatsApp.
          </p>
          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
            {[
              { title: 'Administración', text: 'Ve el avance GPS en el mapa, las aceptaciones y el remito digital al instante.', panel: 'admin' as PanelId, cta: 'Ir al mapa' },
              { title: 'Cliente', text: 'Recibe avisos automáticos, sigue su carga y descarga la prueba de entrega.', panel: 'client' as PanelId, cta: 'Ver portal' },
              { title: 'Finanzas', text: 'El remito habilita facturar en 1 clic y los tickets se auditan contra el presupuesto.', panel: 'finance' as PanelId, cta: 'Ver finanzas' },
            ].map((b) => (
              <div key={b.title} className="space-y-2 rounded-xl border border-zinc-200 bg-[#F5F6F8] p-4">
                <div className="text-xs font-extrabold uppercase text-[#B71E23]">{b.title}</div>
                <p className="text-xs text-zinc-600">{b.text}</p>
                <button
                  type="button"
                  onClick={() => onNavigatePanel?.(b.panel)}
                  className="inline-flex items-center gap-1 text-xs font-extrabold text-[#231F20] hover:text-[#B71E23]"
                >
                  {b.cta} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-zinc-800 bg-[#181D26] p-5 text-white sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#F2851D]">Probar corte de señal</div>
            <h4 className="text-sm font-bold">¿Qué pasa cuando el chofer cruza una zona rural sin cobertura?</h4>
            <p className="text-xs text-zinc-400">
              Cortá la señal, registrá acciones en el celular (iniciar viaje, gasto, remito) y después reconectá: todo se
              sincroniza solo y en orden.
              {state.offlineQueue.length > 0 && (
                <span className="ml-1 font-bold text-[#F2851D]">{state.offlineQueue.length} evento(s) en cola.</span>
              )}
            </p>
          </div>
          <Button
            variant="primary"
            className="shrink-0"
            onClick={() => dispatch({ type: 'SET_OFFLINE', offline: !offline })}
          >
            {offline ? <RefreshCw className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
            {offline ? 'Reconectar y sincronizar' : 'Cortar señal'}
          </Button>
        </div>
      </div>
    </div>
  );
};
