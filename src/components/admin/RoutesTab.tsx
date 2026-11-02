import React, { useState } from 'react';
import { Loader2, MapPin, Route as RouteIcon } from 'lucide-react';
import { DestinationNode } from '../../types';
import { useDemo } from '../../state/DemoContext';
import { PROVINCES } from '../../data/seed';
import { buildCheckpoints, estimateRoadKmBetween } from '../../lib/geo';
import { fetchRoadRoute } from '../../lib/routing';
import { AVG_TRUCK_SPEED_KMH, num } from '../../lib/format';
import { FleetMap } from '../FleetMap';
import { Button, Card, cx, Field, inputCls, SectionHeader } from '../ui';
import type { AdminTabProps } from '../AdminPanel';

export const RoutesTab: React.FC<AdminTabProps> = () => {
  const { state, dispatch } = useDemo();
  const [mode, setMode] = useState<'none' | 'dest' | 'route'>('none');
  const [highlight, setHighlight] = useState<string | null>(null);

  // Nuevo destino
  const [destName, setDestName] = useState('');
  const [destProvince, setDestProvince] = useState('Buenos Aires');
  const [destAddress, setDestAddress] = useState('');
  const [destKind, setDestKind] = useState<DestinationNode['kind']>('planta');
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);

  // Nueva ruta
  const [originId, setOriginId] = useState(state.destinations[0]?.id ?? '');
  const [viaId, setViaId] = useState('');
  const [targetId, setTargetId] = useState(state.destinations[2]?.id ?? '');
  const [routeName, setRouteName] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const saveDestination = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destName.trim()) return;
    const prov = PROVINCES.find((p) => p.name === destProvince) ?? PROVINCES[0];
    const lat = picked?.lat ?? prov.lat;
    const lng = picked?.lng ?? prov.lng;
    dispatch({
      type: 'CREATE_DESTINATION',
      destination: {
        name: destName.trim(),
        province: prov.name,
        country: prov.country,
        addressNote: destAddress.trim() || `Planta / centro de descarga · ${prov.name}`,
        lat,
        lng,
        kind: destKind,
      },
    });
    setDestName('');
    setDestAddress('');
    setPicked(null);
    setMode('none');
  };

  const origin = state.destinations.find((d) => d.id === originId);
  const via = state.destinations.find((d) => d.id === viaId);
  const target = state.destinations.find((d) => d.id === targetId);
  const previewKm =
    origin && target && origin.id !== target.id
      ? via
        ? estimateRoadKmBetween(origin.lat, origin.lng, via.lat, via.lng) + estimateRoadKmBetween(via.lat, via.lng, target.lat, target.lng)
        : estimateRoadKmBetween(origin.lat, origin.lng, target.lat, target.lng)
      : 0;

  const saveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !target || origin.id === target.id) {
      setRouteError('Elegí un origen y un destino distintos.');
      return;
    }
    setRouteError(null);
    setCalculating(true);
    const pts: [number, number][] = [[origin.lat, origin.lng], ...(via ? [[via.lat, via.lng] as [number, number]] : []), [target.lat, target.lng]];
    const road = await fetchRoadRoute(pts);
    const base = { path: road.path, totalKm: road.km };
    const stops = [origin, ...(via ? [via] : []), target].map((d) => ({ lat: d.lat, lng: d.lng, label: d.name }));
    const international = origin.country !== target.country || (via ? via.country !== origin.country : false);
    dispatch({
      type: 'CREATE_CORRIDOR',
      corridor: {
        name: routeName.trim() || `${origin.name} → ${target.name}`,
        originId: origin.id,
        destinationId: target.id,
        origin: `${origin.name}, ${origin.province}`,
        destination: `${target.name}, ${target.province}`,
        totalKm: road.km,
        estimatedHours: Math.round((road.km / AVG_TRUCK_SPEED_KMH) * 10) / 10,
        international,
        path: road.path,
        checkpoints: buildCheckpoints(base, stops, 60),
        approximate: road.approximate,
      },
    });
    setCalculating(false);
    setRouteName('');
    setViaId('');
    setMode('none');
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-5">
        <Card className="space-y-3 p-4">
          <SectionHeader
            title="Rutas y destinos operativos"
            subtitle="Cargá origen y destino: el sistema traza la ruta por rutas reales y calcula distancia y tiempo de manejo."
          />
          <div className="grid grid-cols-2 gap-2">
            <Button variant={mode === 'dest' ? 'dark' : 'secondary'} onClick={() => setMode(mode === 'dest' ? 'none' : 'dest')}>
              <MapPin className="h-4 w-4" /> Nuevo destino
            </Button>
            <Button variant={mode === 'route' ? 'dark' : 'primary'} onClick={() => setMode(mode === 'route' ? 'none' : 'route')}>
              <RouteIcon className="h-4 w-4" /> Nueva ruta
            </Button>
          </div>

          {mode === 'dest' && (
            <form onSubmit={saveDestination} className="space-y-3 rounded-xl border-2 border-[#B71E23] bg-[#F5F6F8] p-3.5">
              <div className="text-[11px] font-extrabold uppercase text-[#B71E23]">Agregar destino / planta</div>
              <Field label="Nombre">
                <input value={destName} onChange={(e) => setDestName(e.target.value)} placeholder="Planta Bahía Blanca" className={inputCls} required />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Provincia / Estado">
                  <select value={destProvince} onChange={(e) => setDestProvince(e.target.value)} className={inputCls}>
                    {PROVINCES.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} ({p.country})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tipo">
                  <select value={destKind} onChange={(e) => setDestKind(e.target.value as DestinationNode['kind'])} className={inputCls}>
                    <option value="planta">Planta / cliente</option>
                    <option value="deposito">Depósito MD</option>
                    <option value="puerto">Puerto / terminal</option>
                  </select>
                </Field>
              </div>
              <Field label="Dirección / referencia">
                <input value={destAddress} onChange={(e) => setDestAddress(e.target.value)} placeholder="Parque Industrial RN 3" className={inputCls} />
              </Field>
              <div className={cx('rounded-lg border px-3 py-2 text-[11px]', picked ? 'border-emerald-200 bg-emerald-50 font-bold text-emerald-700' : 'border-zinc-200 bg-white text-zinc-600')}>
                {picked ? `Ubicación marcada: ${picked.lat}, ${picked.lng}` : 'Hacé clic en el mapa para marcar la ubicación exacta (si no, se usa la capital de la provincia).'}
              </div>
              <Button type="submit" className="w-full">
                Guardar destino
              </Button>
            </form>
          )}

          {mode === 'route' && (
            <form onSubmit={saveRoute} className="space-y-3 rounded-xl border-2 border-[#F2851D] bg-[#F5F6F8] p-3.5">
              <div className="text-[11px] font-extrabold uppercase text-[#C25E08]">Trazar nueva ruta</div>
              <Field label="Origen">
                <select value={originId} onChange={(e) => setOriginId(e.target.value)} className={inputCls}>
                  {state.destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.province})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Pasando por (opcional)">
                <select value={viaId} onChange={(e) => setViaId(e.target.value)} className={inputCls}>
                  <option value="">Directo</option>
                  {state.destinations
                    .filter((d) => d.id !== originId && d.id !== targetId)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.province})
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Destino">
                <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={inputCls}>
                  {state.destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.province})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nombre (opcional)">
                <input value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="Se genera automáticamente" className={inputCls} />
              </Field>
              {previewKm > 0 && (
                <div className="flex justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs">
                  <span className="font-semibold text-zinc-600">Estimación preliminar</span>
                  <span className="font-mono font-extrabold text-[#B71E23]">
                    ~{num(previewKm)} km · ~{Math.round(previewKm / AVG_TRUCK_SPEED_KMH)} h
                  </span>
                </div>
              )}
              {routeError && <div className="text-xs font-bold text-red-600">{routeError}</div>}
              <Button type="submit" className="w-full" disabled={calculating}>
                {calculating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Calculando ruta vial…
                  </>
                ) : (
                  'Calcular ruta real y guardar'
                )}
              </Button>
            </form>
          )}
        </Card>

        <Card className="max-h-[420px] space-y-2 overflow-y-auto p-4">
          <div className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">
            Rutas configuradas ({state.corridors.length}) · clic para ver en el mapa
          </div>
          {state.corridors.map((c) => {
            const on = highlight === c.id;
            const activeTrips = state.trips.filter((t) => t.corridorId === c.id && t.stage !== 'delivered' && t.stage !== 'pending_assignment').length;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setHighlight(on ? null : c.id)}
                className={cx(
                  'w-full rounded-xl border p-3 text-left transition',
                  on ? 'border-[#B71E23] bg-[#FEF2F2]' : 'border-zinc-200 bg-zinc-50/60 hover:border-zinc-400'
                )}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-extrabold">{c.name}</span>
                  <span className="shrink-0 font-mono font-bold text-[#B71E23]">{num(c.totalKm)} km</span>
                </div>
                <div className="mt-0.5 text-[11px] text-zinc-500">
                  ~{Math.round(c.estimatedHours)} h de manejo · {c.checkpoints.length} puntos de control
                  {c.international ? ' · Internacional' : ''}
                  {c.approximate ? ' · trazado estimado' : ''}
                  {activeTrips ? ` · ${activeTrips} viaje(s) en curso` : ''}
                </div>
              </button>
            );
          })}
        </Card>
      </div>

      <div className="xl:col-span-7">
        <FleetMap
          trucks={state.trucks}
          trips={state.trips}
          corridors={state.corridors}
          drivers={state.drivers}
          destinations={state.destinations}
          highlightedCorridorId={highlight}
          pickMode={mode === 'dest'}
          pickedCoords={picked}
          onPickMapCoords={(lat, lng) => setPicked({ lat, lng })}
          heightClass="h-[480px] xl:h-[640px]"
        />
      </div>
    </div>
  );
};
