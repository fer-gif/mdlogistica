import React, { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, FileText, Fuel, MapPin, Phone, Search, Smartphone } from 'lucide-react';
import { useDemo } from '../../state/DemoContext';
import { driverNameOf, getClient, getCorridor, getDriver, tripCompletionPct, tripEta } from '../../state/store';
import { STAGE_META } from '../../data/seed';
import { num, when } from '../../lib/format';
import { printTripDocument, tripDocuments } from '../../lib/documents';
import { FleetMap } from '../FleetMap';
import { Button, Card, CompletionMeter, cx, StageBadge, TruckStatusBadge } from '../ui';
import type { AdminTabProps } from '../AdminPanel';

const STATUS_ORDER = { descargando: 0, en_aduana: 1, en_ruta: 2, en_carga: 3, disponible: 4 } as const;

export const TrackingTab: React.FC<AdminTabProps> = ({
  selectedTruckId,
  setSelectedTruckId,
  onNavigatePanel,
  onPreviewDriver,
  goTab,
}) => {
  const { state } = useDemo();
  const [query, setQuery] = useState('');
  const [showDetail, setShowDetail] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.trucks
      .filter((t) => {
        if (!q) return true;
        const trip = state.trips.find((x) => x.id === t.activeTripId);
        return [t.code, t.tractorPlate, driverNameOf(state, t), t.locationLabel, trip?.code, trip && getClient(state, trip.clientId)?.name]
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }, [state, query]);

  const truck = state.trucks.find((t) => t.id === selectedTruckId) ?? state.trucks[0];
  const trip = truck?.activeTripId ? state.trips.find((t) => t.id === truck.activeTripId) : undefined;
  const corridor = trip ? getCorridor(state, trip.corridorId) : undefined;
  const client = trip ? getClient(state, trip.clientId) : undefined;
  const driver = getDriver(state, truck?.driverId);
  const eta = trip ? tripEta(trip, corridor) : null;
  const pct = trip ? tripCompletionPct(trip, corridor) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="xl:col-span-8">
        <FleetMap
          trucks={state.trucks}
          trips={state.trips}
          corridors={state.corridors}
          drivers={state.drivers}
          destinations={state.destinations}
          selectedTruckId={truck?.id}
          onSelectTruck={setSelectedTruckId}
          initialFit="trucks"
          heightClass="h-[420px] sm:h-[600px]"
        />
      </div>

      <div className="space-y-4 xl:col-span-4">
        {/* Unidad seleccionada: solo lo esencial */}
        {truck && (
          <Card className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[#231F20] px-1.5 py-0.5 font-mono text-xs font-bold text-white">{truck.code}</span>
                  {trip ? <StageBadge stage={trip.stage} /> : <TruckStatusBadge status={truck.status} />}
                </div>
                <div className="mt-1 text-sm font-extrabold">{driver?.name}</div>
              </div>
              <a
                href={`tel:${driver?.phone.replace(/[^\d+]/g, '')}`}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-bold hover:border-[#B71E23] hover:text-[#B71E23]"
              >
                <Phone className="h-3 w-3" /> Llamar
              </a>
            </div>

            {trip && corridor ? (
              <>
                <div className="mt-3 text-xs text-zinc-500">
                  {trip.code} · <span className="font-semibold text-[#231F20]">{client?.name}</span>
                </div>
                <div className="text-sm font-bold">
                  {corridor.origin.split(',')[0]} → {corridor.destination.split(',')[0]}
                </div>
                <CompletionMeter pct={pct} className="mt-3" />
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Fact label="Restan" value={`${num(Math.max(0, corridor.totalKm - trip.kmDone))} km`} />
                  <Fact label="Llega" value={trip.stage === 'unloading' ? 'En destino' : eta ? when(eta.ts) : '—'} />
                  <Fact label="Velocidad" value={`${truck.speedKmh} km/h`} />
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500">
                  <MapPin className="h-3 w-3 shrink-0 text-[#B71E23]" />
                  <span className="truncate">{truck.locationLabel}</span>
                  <span className={cx('ml-auto flex shrink-0 items-center gap-1', truck.fuelPct < 25 && 'font-bold text-amber-600')}>
                    <Fuel className="h-3 w-3" /> {Math.round(truck.fuelPct)}%
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDetail((v) => !v)}
                  className="mt-3 flex w-full items-center justify-between border-t border-zinc-100 pt-3 text-xs font-bold text-zinc-600 hover:text-[#B71E23]"
                >
                  Ver detalle del viaje
                  <ChevronDown className={cx('h-4 w-4 transition', showDetail && 'rotate-180')} />
                </button>
                {showDetail && (
                  <div className="mt-3 space-y-4">
                    <div className="text-[11px] text-zinc-500">
                      {trip.cargoDescription} · {trip.weightTons} tn · {STAGE_META[trip.stage].label}
                    </div>
                    <ol className="space-y-2">
                      {[...trip.timeline].reverse().slice(0, 5).map((ev) => (
                        <li key={ev.id} className="flex gap-2 text-xs">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#B71E23]" />
                          <div>
                            <span className="font-bold">{ev.title}</span>{' '}
                            <span className="font-mono text-[10px] text-zinc-400">{when(ev.at)}</span>
                          </div>
                        </li>
                      ))}
                    </ol>
                    <div className="flex flex-wrap gap-1.5">
                      {tripDocuments({ trip, corridor, client, truck, driver })
                        .filter((d) => d.available)
                        .map((d) => (
                          <button
                            key={d.key}
                            type="button"
                            onClick={() => printTripDocument(d.key, { trip, corridor, client, truck, driver })}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-[11px] font-semibold hover:border-[#B71E23]"
                          >
                            <FileText className="h-3 w-3 text-[#B71E23]" /> {d.short}
                          </button>
                        ))}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        onPreviewDriver(truck.id);
                        onNavigatePanel('driver');
                      }}
                    >
                      <Smartphone className="h-3.5 w-3.5" /> Ver su App del Chofer
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-3">
                <p className="text-xs text-zinc-500">
                  {truck.locationLabel} · {truck.driverAvailable ? 'Libre para cargar' : 'Chofer en descanso'}
                </p>
                <Button className="mt-3 w-full" onClick={() => goTab('trips')}>
                  Asignarle un viaje <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Lista de unidades */}
        <Card className="p-3">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar patente, chofer o cliente"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-8 pr-3 text-xs focus:border-[#B71E23] focus:outline-none"
            />
          </div>
          <div className="max-h-[300px] space-y-1 overflow-y-auto pr-1">
            {list.map((t) => {
              const tr = state.trips.find((x) => x.id === t.activeTripId);
              const c = tr ? getCorridor(state, tr.corridorId) : undefined;
              const sel = t.id === truck?.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTruckId(t.id)}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition',
                    sel ? 'bg-[#FEF2F2] ring-1 ring-[#B71E23]' : 'hover:bg-zinc-50'
                  )}
                >
                  <span className="w-14 shrink-0 font-mono text-[11px] font-bold">{t.code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{driverNameOf(state, t)}</span>
                    <span className="block truncate text-[10px] text-zinc-500">
                      {tr && c ? `${getClient(state, tr.clientId)?.name} · ${tripCompletionPct(tr, c)}% cumplido` : t.locationLabel}
                    </span>
                  </span>
                  <TruckStatusBadge status={t.status} />
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-1 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</div>
      <div className="mt-0.5 truncate text-xs font-extrabold" title={value}>
        {value}
      </div>
    </div>
  );
}
