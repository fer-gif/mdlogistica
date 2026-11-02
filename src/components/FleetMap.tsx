import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Crosshair, Layers, Maximize2 } from 'lucide-react';
import { DestinationNode, DriverProfile, RouteCorridor, Trip, TruckUnit } from '../types';
import { ARGENTINA_BOUNDS, TRUCK_STATUS_META } from '../data/seed';
import { splitPathAtKm } from '../lib/geo';
import { cx } from './ui';

type BaseLayer = 'argenmap' | 'vial' | 'oscuro' | 'satelite';

const IGN_ATTR =
  '<a href="https://www.ign.gob.ar/AreaServicios/Argenmap/Introduccion" target="_blank" rel="noreferrer">Instituto Geográfico Nacional</a> + <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

const BASE_LAYERS: Record<BaseLayer, { label: string; url: string; opts: L.TileLayerOptions }> = {
  argenmap: {
    label: 'Mapa IGN',
    url: 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png',
    opts: { maxZoom: 18, minZoom: 3, attribution: IGN_ATTR },
  },
  vial: {
    label: 'Mapa vial AR + BR',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    opts: { maxZoom: 18, minZoom: 3, attribution: 'Mapa vial © Esri, HERE, Garmin, OpenStreetMap' },
  },
  oscuro: {
    label: 'Oscuro',
    url: 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/argenmap_oscuro@EPSG%3A3857@png/{z}/{x}/{-y}.png',
    opts: { maxZoom: 18, minZoom: 3, attribution: IGN_ATTR },
  },
  satelite: {
    label: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    opts: { maxZoom: 18, minZoom: 3, attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics' },
  },
};

// Respaldo sin API key si el servidor del IGN no responde.
const FALLBACK_LAYER = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  opts: { maxZoom: 18, attribution: 'Mapa vial © Esri, HERE, Garmin, OpenStreetMap' } as L.TileLayerOptions,
};

interface FleetMapProps {
  trucks: TruckUnit[];
  trips: Trip[];
  corridors: RouteCorridor[];
  drivers?: DriverProfile[];
  destinations?: DestinationNode[];
  selectedTruckId?: string | null;
  onSelectTruck?: (truckId: string) => void;
  /** Ruta a resaltar (pestaña Rutas). */
  highlightedCorridorId?: string | null;
  /** Dibuja todas las rutas configuradas en gris tenue. */
  showAllCorridors?: boolean;
  pickMode?: boolean;
  pickedCoords?: { lat: number; lng: number } | null;
  onPickMapCoords?: (lat: number, lng: number) => void;
  /** compact = mapa del celular del chofer: sin controles y siguiendo la unidad. */
  variant?: 'full' | 'compact';
  heightClass?: string;
  /** Encuadre inicial: todo el país o las unidades visibles. */
  initialFit?: 'argentina' | 'trucks';
  className?: string;
}

function arrowSvg(color: string) {
  return `<svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 2 L19 20 L12 16 L5 20 Z" fill="#fff" stroke="${color}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
}

const TRUCK_SVG =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>';

function truckIcon(truck: TruckUnit, selected: boolean, compact: boolean) {
  const meta = TRUCK_STATUS_META[truck.status];
  const size = selected ? 34 : 28;
  const moving = truck.status === 'en_ruta';
  const label = compact ? '' : `<div class="md-truck-label ${selected ? 'is-selected' : ''}">${truck.code}</div>`;
  const pulse = selected || moving ? `<span class="md-truck-pulse" style="background:${meta.color}55"></span>` : '';
  const inner = moving
    ? `<span class="md-truck-arrow" style="transform:rotate(${Math.round(truck.headingDeg)}deg)">${arrowSvg(meta.color)}</span>`
    : TRUCK_SVG;
  return L.divIcon({
    className: 'md-leaflet-marker md-truck-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="md-truck-wrap" style="width:${size}px;height:${size}px">${pulse}${label}<div class="md-truck-dot ${selected ? 'is-selected' : ''}" style="width:${size}px;height:${size}px;background:${meta.color}">${inner}</div></div>`,
  });
}

function destinationIcon(dest: DestinationNode) {
  if (dest.kind === 'base' || dest.kind === 'deposito') {
    const isBase = dest.kind === 'base';
    return L.divIcon({
      className: 'md-leaflet-marker',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      html: `<div class="md-dest-base ${isBase ? '' : 'is-deposito'}">${isBase ? 'MD' : 'DEP'}</div><div class="md-dest-base-label">${dest.name}</div>`,
    });
  }
  return L.divIcon({
    className: 'md-leaflet-marker',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<div class="md-dest-dot ${dest.country === 'BR' ? 'is-br' : ''}"></div>`,
  });
}

export const FleetMap: React.FC<FleetMapProps> = ({
  trucks,
  trips,
  corridors,
  drivers = [],
  destinations = [],
  selectedTruckId,
  onSelectTruck,
  highlightedCorridorId,
  showAllCorridors = true,
  pickMode = false,
  pickedCoords = null,
  onPickMapCoords,
  variant = 'full',
  heightClass = 'h-[480px]',
  initialFit = 'argentina',
  className,
}) => {
  const compact = variant === 'compact';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const routeGroupRef = useRef<L.LayerGroup | null>(null);
  const destGroupRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Record<string, { marker: L.Marker; key: string }>>({});
  const pickMarkerRef = useRef<L.Marker | null>(null);
  const lastSelectedRef = useRef<string | null | undefined>(undefined);
  const lastHighlightRef = useRef<string | null | undefined>(undefined);
  const didInitialFit = useRef(false);
  const onSelectRef = useRef(onSelectTruck);
  onSelectRef.current = onSelectTruck;
  const onPickRef = useRef(onPickMapCoords);
  onPickRef.current = onPickMapCoords;
  const pickModeRef = useRef(pickMode);
  pickModeRef.current = pickMode;

  const [mapReady, setMapReady] = useState(false);
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('argenmap');
  const [usingFallback, setUsingFallback] = useState(false);
  const showDestinations = true;
  const [follow, setFollow] = useState(compact);
  const [layerMenu, setLayerMenu] = useState(false);

  const driverName = useMemo(() => {
    const m: Record<string, string> = {};
    drivers.forEach((d) => (m[d.id] = d.name));
    return m;
  }, [drivers]);

  // ---------- Inicialización ----------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: !compact,
      minZoom: 3,
      maxBounds: L.latLngBounds([-62, -100], [0, -20]),
      maxBoundsViscosity: 0.8,
    });
    if (!compact) {
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      map.attributionControl?.setPrefix(false);
    }
    map.fitBounds(ARGENTINA_BOUNDS, { padding: [10, 10] });

    routeGroupRef.current = L.layerGroup().addTo(map);
    destGroupRef.current = L.layerGroup().addTo(map);

    // Sin transiciones durante el zoom (evita que los camiones "floten" sobre el mapa).
    map.on('zoomstart', () => containerRef.current?.classList.add('md-zooming'));
    map.on('zoomend', () =>
      requestAnimationFrame(() => requestAnimationFrame(() => containerRef.current?.classList.remove('md-zooming')))
    );
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (pickModeRef.current && onPickRef.current) {
        onPickRef.current(Number(e.latlng.lat.toFixed(4)), Number(e.latlng.lng.toFixed(4)));
      }
    });
    map.on('dragstart', () => setFollow(false));

    mapRef.current = map;
    setMapReady(true);

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      markersRef.current = {};
      pickMarkerRef.current = null;
      lastSelectedRef.current = undefined;
      lastHighlightRef.current = undefined;
      didInitialFit.current = false;
      setMapReady(false);
    };
  }, [compact]);

  // ---------- Capa base (con respaldo automático si el IGN no responde) ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    tileRef.current?.remove();
    const def = usingFallback ? FALLBACK_LAYER : BASE_LAYERS[baseLayer];
    const layer = L.tileLayer(def.url, def.opts);
    let errors = 0;
    let loaded = 0;
    if (!usingFallback && (baseLayer === 'argenmap' || baseLayer === 'oscuro')) {
      layer.on('tileerror', () => {
        errors += 1;
        if (errors >= 6 && loaded < 3) setUsingFallback(true);
      });
      layer.on('tileload', () => {
        loaded += 1;
      });
    }
    layer.addTo(map);
    layer.bringToBack();
    tileRef.current = layer;
  }, [baseLayer, usingFallback, mapReady]);

  // ---------- Destinos / bases ----------
  useEffect(() => {
    const group = destGroupRef.current;
    if (!group) return;
    group.clearLayers();
    if (!showDestinations || compact) return;
    destinations.forEach((d) => {
      const m = L.marker([d.lat, d.lng], {
        icon: destinationIcon(d),
        zIndexOffset: d.kind === 'base' ? 300 : 100,
        keyboard: false,
      });
      const eyebrow =
        d.kind === 'base' ? 'Base MD Logística' : d.kind === 'deposito' ? 'Depósito MD' : `Destino · ${d.province}`;
      m.bindTooltip(
        `<div class="md-tt-eyebrow">${eyebrow}</div><div class="md-tt-title">${d.name}</div><div class="md-tt-sub">${d.addressNote}</div>`,
        { direction: 'top', offset: [0, -10], className: 'md-map-tooltip' }
      );
      m.addTo(group);
    });
  }, [destinations, showDestinations, compact, mapReady]);

  const selectedTruck = trucks.find((t) => t.id === selectedTruckId);
  const selectedTrip = selectedTruck?.activeTripId ? trips.find((t) => t.id === selectedTruck.activeTripId) : undefined;
  const selectedCorridor = selectedTrip ? corridors.find((c) => c.id === selectedTrip.corridorId) : undefined;

  // ---------- Rutas ----------
  useEffect(() => {
    const group = routeGroupRef.current;
    if (!group) return;
    group.clearLayers();
    const dark = (baseLayer === 'oscuro' || baseLayer === 'satelite') && !usingFallback;

    if (showAllCorridors && !compact) {
      corridors.forEach((c) => {
        if (c.id === highlightedCorridorId || c.id === selectedCorridor?.id) return;
        L.polyline(c.path, {
          color: dark ? '#E4E4E7' : '#475569',
          weight: 2.5,
          opacity: dark ? 0.5 : 0.35,
          dashArray: c.approximate ? '4 6' : undefined,
          interactive: false,
        }).addTo(group);
      });
    }

    const hi = corridors.find((c) => c.id === highlightedCorridorId);
    if (hi) {
      L.polyline(hi.path, { color: '#FFFFFF', weight: 8, opacity: 0.9, interactive: false }).addTo(group);
      L.polyline(hi.path, { color: '#B71E23', weight: 4.5, opacity: 1 })
        .bindTooltip(`${hi.name} · ${hi.totalKm} km`, { sticky: true, className: 'md-map-tooltip' })
        .addTo(group);
      hi.checkpoints.forEach((cp) => {
        L.circleMarker([cp.lat, cp.lng], { radius: 4, color: '#B71E23', weight: 2, fillColor: '#fff', fillOpacity: 1 })
          .bindTooltip(`${cp.label} · km ${cp.km}`, { className: 'md-map-tooltip', direction: 'top' })
          .addTo(group);
      });
    }

    if (!hi && selectedTrip && selectedCorridor && selectedTrip.stage !== 'pending_assignment') {
      const { done, remaining } = splitPathAtKm(selectedCorridor, selectedTrip.kmDone);
      L.polyline(selectedCorridor.path, { color: '#FFFFFF', weight: 8, opacity: 0.85, interactive: false }).addTo(group);
      L.polyline(remaining, { color: '#F2851D', weight: 4, opacity: 0.95, dashArray: '8 7', interactive: false }).addTo(group);
      L.polyline(done, { color: '#B71E23', weight: 5, opacity: 1, interactive: false }).addTo(group);
      const end = selectedCorridor.path[selectedCorridor.path.length - 1];
      L.circleMarker(end, { radius: 7, color: '#231F20', weight: 3, fillColor: '#FFF000', fillOpacity: 1 })
        .bindTooltip(`Destino · ${selectedCorridor.destination}`, { className: 'md-map-tooltip', direction: 'top' })
        .addTo(group);
      if (selectedCorridor.international && !selectedTrip.flags.customsOut) {
        const cp = selectedCorridor.checkpoints.find((c) => c.label.includes('Aduana'));
        if (cp) {
          L.circleMarker([cp.lat, cp.lng], { radius: 6, color: '#7C3AED', weight: 3, fillColor: '#fff', fillOpacity: 1 })
            .bindTooltip('Puente Internacional · Aduana Integrada', { className: 'md-map-tooltip', direction: 'top' })
            .addTo(group);
        }
      }
    }
  }, [corridors, highlightedCorridorId, selectedTrip, selectedCorridor, showAllCorridors, compact, baseLayer, usingFallback, mapReady]);

  // ---------- Camiones ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const ids = new Set(trucks.map((t) => t.id));
    Object.entries(markersRef.current).forEach(([id, entry]) => {
      if (!ids.has(id)) {
        entry.marker.remove();
        delete markersRef.current[id];
      }
    });

    trucks.forEach((truck) => {
      const selected = truck.id === selectedTruckId;
      const key = `${truck.status}|${selected}|${truck.code}`;
      const tooltip = `<div class="md-tt-eyebrow">${truck.code} · ${TRUCK_STATUS_META[truck.status].label}</div>
        <div class="md-tt-title">${driverName[truck.driverId] ?? ''}</div>
        <div class="md-tt-sub">${truck.brand} ${truck.model} · ${truck.tractorPlate}</div>
        <div class="md-tt-sub">${truck.locationLabel}${truck.speedKmh > 0 ? ` · ${truck.speedKmh} km/h` : ''}</div>`;
      const existing = markersRef.current[truck.id];
      if (existing) {
        existing.marker.setLatLng([truck.lat, truck.lng]);
        existing.marker.setTooltipContent(tooltip);
        if (existing.key !== key) {
          existing.marker.setIcon(truckIcon(truck, selected, compact));
          existing.key = key;
        } else {
          const arrow = existing.marker.getElement()?.querySelector<HTMLElement>('.md-truck-arrow');
          if (arrow) arrow.style.transform = `rotate(${Math.round(truck.headingDeg)}deg)`;
        }
        existing.marker.setZIndexOffset(selected ? 1000 : 500);
      } else {
        const marker = L.marker([truck.lat, truck.lng], {
          icon: truckIcon(truck, selected, compact),
          zIndexOffset: selected ? 1000 : 500,
        });
        marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -18], className: 'md-map-tooltip' });
        marker.on('click', () => onSelectRef.current?.(truck.id));
        marker.addTo(map);
        markersRef.current[truck.id] = { marker, key };
      }
    });
  }, [trucks, selectedTruckId, compact, driverName, mapReady]);

  // ---------- Encuadres ----------
  // Encuadre inicial a las unidades visibles (portal de clientes).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || didInitialFit.current || initialFit !== 'trucks' || trucks.length === 0) return;
    didInitialFit.current = true;
    const pts: [number, number][] = trucks.map((t) => [t.lat, t.lng]);
    trips.forEach((tr) => {
      const c = corridors.find((x) => x.id === tr.corridorId);
      if (c && tr.truckId && trucks.some((t) => t.id === tr.truckId)) pts.push(...c.path);
    });
    map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 9 });
  }, [initialFit, trucks, trips, corridors, mapReady]);

  // Al seleccionar una unidad: encuadrar su viaje (o acercarse si está libre).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lastSelectedRef.current === selectedTruckId) return;
    const first = lastSelectedRef.current === undefined;
    lastSelectedRef.current = selectedTruckId;
    if (!selectedTruck) return;
    if (compact) {
      map.setView([selectedTruck.lat, selectedTruck.lng], 9, { animate: false });
      return;
    }
    if (first) return;
    if (selectedCorridor) {
      map.flyToBounds(L.latLngBounds(selectedCorridor.path), { padding: [50, 50], duration: 0.8, maxZoom: 9 });
    } else {
      map.flyTo([selectedTruck.lat, selectedTruck.lng], 10, { duration: 0.8 });
    }
  }, [selectedTruckId, selectedTruck, selectedCorridor, compact, mapReady]);

  // Al resaltar una ruta: encuadrarla.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lastHighlightRef.current === highlightedCorridorId) return;
    lastHighlightRef.current = highlightedCorridorId;
    const c = corridors.find((x) => x.id === highlightedCorridorId);
    if (c) map.flyToBounds(L.latLngBounds(c.path), { padding: [50, 50], duration: 0.8 });
  }, [highlightedCorridorId, corridors, mapReady]);

  // Seguimiento de la unidad seleccionada.
  const followLat = selectedTruck?.lat;
  const followLng = selectedTruck?.lng;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !follow || followLat === undefined || followLng === undefined) return;
    map.panTo([followLat, followLng], { animate: true, duration: 1.2 });
  }, [follow, followLat, followLng]);

  // ---------- Punto elegido en modo "marcar destino" ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pickMarkerRef.current?.remove();
    pickMarkerRef.current = null;
    if (pickedCoords) {
      pickMarkerRef.current = L.marker([pickedCoords.lat, pickedCoords.lng], {
        icon: L.divIcon({
          className: 'md-leaflet-marker',
          iconSize: [28, 28],
          iconAnchor: [14, 28],
          html: `<svg width="28" height="28" viewBox="0 0 24 24" fill="#B71E23" stroke="#fff" stroke-width="1.5"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6" fill="#FFF000" stroke="none"/></svg>`,
        }),
        zIndexOffset: 2000,
      }).addTo(map);
    }
  }, [pickedCoords, mapReady]);

  const fitArgentina = () => mapRef.current?.flyToBounds(ARGENTINA_BOUNDS, { duration: 0.8, padding: [10, 10] });

  const ctrlBtn =
    'pointer-events-auto flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-[#231F20] shadow-sm backdrop-blur hover:border-[#B71E23] hover:text-[#B71E23] transition';

  return (
    <div
      className={cx(
        'relative w-full overflow-hidden rounded-2xl border border-zinc-200 bg-[#E8ECF0]',
        heightClass,
        pickMode && 'ring-2 ring-[#B71E23] md-pick-mode',
        className
      )}
    >
      <div ref={containerRef} className="md-map h-full w-full" />

      {!compact && (
        <>
          <div className="pointer-events-none absolute left-3 top-3 z-[400] flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full bg-[#181D26]/90 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              {pickMode ? 'Hacé clic en el mapa para ubicar el destino' : `GPS en vivo · ${trucks.length} unidad(es)`}
            </div>
          </div>

          <div className="absolute right-3 top-3 z-[400] flex max-w-[70%] flex-wrap justify-end gap-1.5">
            <button type="button" onClick={fitArgentina} className={ctrlBtn} title="Ver todo el país">
              <Maximize2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Argentina</span>
            </button>
            {selectedTruck && (
              <button
                type="button"
                onClick={() => setFollow((v) => !v)}
                className={cx(ctrlBtn, follow && '!border-[#B71E23] !bg-[#B71E23] !text-white')}
                title="Seguir la unidad seleccionada"
              >
                <Crosshair className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Seguir {selectedTruck.code}</span>
              </button>
            )}
            <div className="relative">
              <button type="button" onClick={() => setLayerMenu((v) => !v)} className={ctrlBtn} title="Tipo de mapa">
                <Layers className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{usingFallback ? 'Mapa' : BASE_LAYERS[baseLayer].label}</span>
              </button>
              {layerMenu && (
                <div className="absolute right-0 mt-1 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
                  {(Object.keys(BASE_LAYERS) as BaseLayer[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setBaseLayer(k);
                        setUsingFallback(false);
                        setLayerMenu(false);
                      }}
                      className={cx(
                        'block w-full px-3 py-2 text-left text-xs font-semibold hover:bg-zinc-50',
                        baseLayer === k ? 'text-[#B71E23]' : 'text-zinc-700'
                      )}
                    >
                      {BASE_LAYERS[k].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-6 left-3 z-[400] hidden md:flex items-center gap-3 rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-600 shadow backdrop-blur">
            {(['en_ruta', 'en_aduana', 'descargando', 'disponible'] as const).map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: TRUCK_STATUS_META[s].color }} />
                {TRUCK_STATUS_META[s].label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
