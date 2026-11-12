import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, MapPin, Star, Truck, UserPlus, Users, XCircle } from 'lucide-react';
import { DriverProfile, TruckUnit } from '../../types';
import { useDemo } from '../../state/DemoContext';
import { driverNameOf, NewTruckInput } from '../../state/store';
import { expiryState, num } from '../../lib/format';
import { Button, cx, Detail, ExpandableRow, Field, inputCls, Modal, Segmented, TruckStatusBadge } from '../ui';
import type { AdminTabProps } from '../AdminPanel';

function ExpiryPill({ label, value }: { label: string; value: string }) {
  const st = expiryState(value);
  const cls =
    st === 'expired' ? 'bg-red-50 text-red-700' : st === 'soon' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700';
  const Icon = st === 'expired' ? XCircle : st === 'soon' ? AlertTriangle : CheckCircle2;
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold', cls)}>
      <Icon className="h-3 w-3" />
      {label} {value}
      {st === 'expired' ? ' · vencido' : st === 'soon' ? ' · por vencer' : ''}
    </span>
  );
}

/** Resumen de vencimientos en una sola etiqueta: lo peor de la lista manda. */
function DocsSummary({ values }: { values: string[] }) {
  const states = values.map(expiryState);
  const expired = states.filter((s) => s === 'expired').length;
  const soon = states.filter((s) => s === 'soon').length;
  if (expired)
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
        <XCircle className="h-3 w-3" /> {expired} vencido{expired > 1 ? 's' : ''}
      </span>
    );
  if (soon)
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
        <AlertTriangle className="h-3 w-3" /> {soon} por vencer
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
      <CheckCircle2 className="h-3 w-3" /> Papeles al día
    </span>
  );
}

type FleetView = 'trucks' | 'drivers';

export const FleetTab: React.FC<AdminTabProps> = ({ setSelectedTruckId, goTab }) => {
  const { state } = useDemo();
  const [truckModal, setTruckModal] = useState(false);
  const [driverModal, setDriverModal] = useState(false);
  const [view, setView] = useState<FleetView>('trucks');
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  const truckAlerts = state.trucks.filter((t) => expiryState(t.vtvExpiry) !== 'ok' || expiryState(t.insuranceExpiry) !== 'ok').length;
  const driverAlerts = state.drivers.filter((d) => expiryState(d.licenseExpiry) !== 'ok').length;
  const deliveredBy = (truckId: string) => state.trips.filter((x) => x.truckId === truckId && x.stage === 'delivered').length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented<FleetView>
          value={view}
          onChange={(v) => {
            setView(v);
            setOpenId(null);
          }}
          items={[
            { id: 'trucks', label: `Unidades (${state.trucks.length})`, icon: <Truck className="h-3.5 w-3.5" />, badge: truckAlerts },
            { id: 'drivers', label: `Choferes (${state.drivers.length})`, icon: <Users className="h-3.5 w-3.5" />, badge: driverAlerts },
          ]}
        />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setDriverModal(true)}>
            <UserPlus className="h-4 w-4 text-[#F2851D]" /> Nuevo chofer
          </Button>
          <Button onClick={() => setTruckModal(true)}>
            <Truck className="h-4 w-4" /> Nueva unidad
          </Button>
        </div>
      </div>

      {view === 'trucks' && (
        <div className="space-y-2">
          {state.trucks.map((t) => (
            <ExpandableRow
              key={t.id}
              open={openId === t.id}
              onToggle={() => toggle(t.id)}
              summary={
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <div className="w-44 min-w-0">
                    <div className="font-mono text-xs font-bold text-[#B71E23]">{t.code}</div>
                    <div className="truncate text-[11px] text-zinc-500">
                      {t.brand} {t.model}
                    </div>
                  </div>
                  <div className="w-36 min-w-0 truncate text-xs font-bold">{driverNameOf(state, t)}</div>
                  <div className="min-w-0 flex-1">
                    <TruckStatusBadge status={t.status} />
                    <div className="mt-0.5 truncate text-[11px] text-zinc-500">{t.locationLabel}</div>
                  </div>
                  <DocsSummary values={[t.vtvExpiry, t.insuranceExpiry]} />
                </div>
              }
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Detail label="Patentes" value={`${t.tractorPlate} / ${t.trailerPlate}`} />
                  <Detail label="Equipo" value={`${t.trailerType} · ${t.maxCapacityTons} tn`} />
                  <Detail label="Modelo" value={`${t.brand} ${t.model} (${t.year})`} />
                  <Detail label="Vínculo" value={t.fleetType} />
                  <Detail label="Odómetro" value={`${num(t.odometerKm)} km`} />
                  <Detail label="Combustible" value={`${Math.round(t.fuelPct)}%`} />
                  <Detail label="Viajes entregados" value={deliveredBy(t.id)} />
                  <Detail label="Chofer" value={t.driverAvailable ? 'Disponible' : 'En descanso'} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                  <div className="flex flex-wrap gap-1.5">
                    <ExpiryPill label="VTV/RTO" value={t.vtvExpiry} />
                    <ExpiryPill label="Seguro" value={t.insuranceExpiry} />
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedTruckId(t.id);
                      goTab('tracking');
                    }}
                  >
                    <MapPin className="h-3.5 w-3.5" /> Ver en mapa
                  </Button>
                </div>
              </div>
            </ExpandableRow>
          ))}
        </div>
      )}

      {view === 'drivers' && (
        <div className="space-y-2">
          {state.drivers.map((d) => {
            const truck = state.trucks.find((t) => t.driverId === d.id);
            return (
              <ExpandableRow
                key={d.id}
                open={openId === d.id}
                onToggle={() => toggle(d.id)}
                summary={
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <div className="w-44 min-w-0">
                      <div className="truncate text-xs font-extrabold">{d.name}</div>
                      <div className="text-[11px] text-zinc-500">{d.employmentType}</div>
                    </div>
                    <div className="min-w-0 flex-1 text-[11px] text-zinc-600">
                      {truck ? (
                        <>
                          <span className="font-mono font-bold">{truck.code}</span> · {truck.locationLabel}
                        </>
                      ) : (
                        'Sin unidad asignada'
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                      <Star className="h-3 w-3 fill-current" /> {d.rating.toFixed(1)}
                    </span>
                    <ExpiryPill label="Licencia" value={d.licenseExpiry} />
                  </div>
                }
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Detail label="DNI" value={d.dni} />
                  <Detail label="Teléfono" value={d.phone} />
                  <Detail label="Habilitación" value={d.licenseCategory} className="col-span-2" />
                  <Detail label="Viajes entregados" value={truck ? deliveredBy(truck.id) : 0} />
                  <Detail label="Estado" value={truck ? (truck.driverAvailable ? 'Disponible' : 'En descanso') : '—'} />
                </div>
              </ExpandableRow>
            );
          })}
        </div>
      )}

      <NewTruckModal open={truckModal} onClose={() => setTruckModal(false)} />
      <NewDriverModal open={driverModal} onClose={() => setDriverModal(false)} />
    </div>
  );
};

function NewTruckModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useDemo();
  const freeDrivers = state.drivers.filter((d) => !state.trucks.some((t) => t.driverId === d.id));
  const [f, setF] = useState<NewTruckInput>({
    code: `MD-${120 + state.trucks.length}`,
    brand: 'Scania',
    model: 'R500 NextGen',
    year: 2025,
    tractorPlate: '',
    trailerPlate: '',
    trailerType: 'Sider',
    maxCapacityTons: 28,
    fleetType: 'Flota Propia MD',
    driverId: '',
    vtvExpiry: '10/2027',
    insuranceExpiry: '06/2027',
    baseDestinationId: 'dest-libres',
  });
  const set = <K extends keyof NewTruckInput>(k: K, v: NewTruckInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const driverId = f.driverId || freeDrivers[0]?.id || state.drivers[0]?.id;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverId) return;
    dispatch({
      type: 'CREATE_TRUCK',
      truck: { ...f, driverId, tractorPlate: f.tractorPlate.toUpperCase(), trailerPlate: f.trailerPlate.toUpperCase() },
    });
    setF((p) => ({ ...p, code: `MD-${121 + state.trucks.length}`, tractorPlate: '', trailerPlate: '', driverId: '' }));
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Alta de unidad"
      title="Registrar tractor y semirremolque"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="new-truck-form">
            Guardar y ubicar en el mapa
          </Button>
        </>
      }
    >
      <form id="new-truck-form" onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Código interno">
          <input value={f.code} onChange={(e) => set('code', e.target.value)} className={inputCls} required />
        </Field>
        <Field label="Marca">
          <select value={f.brand} onChange={(e) => set('brand', e.target.value)} className={inputCls}>
            {['Scania', 'Volvo', 'Mercedes-Benz', 'Iveco', 'Volkswagen', 'DAF'].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </Field>
        <Field label="Modelo">
          <input value={f.model} onChange={(e) => set('model', e.target.value)} className={inputCls} required />
        </Field>
        <Field label="Año">
          <input type="number" value={f.year} onChange={(e) => set('year', Number(e.target.value))} className={inputCls} required />
        </Field>
        <Field label="Patente tractor">
          <input value={f.tractorPlate} onChange={(e) => set('tractorPlate', e.target.value)} placeholder="AH 123 BC" className={cx(inputCls, 'uppercase')} required />
        </Field>
        <Field label="Patente semirremolque">
          <input value={f.trailerPlate} onChange={(e) => set('trailerPlate', e.target.value)} placeholder="AH 124 TR" className={cx(inputCls, 'uppercase')} required />
        </Field>
        <Field label="Tipo de semirremolque">
          <select value={f.trailerType} onChange={(e) => set('trailerType', e.target.value as TruckUnit['trailerType'])} className={inputCls}>
            {(['Sider', 'Furgón Térmico', 'Semirremolque Abierto', 'Portacontenedor', 'Batea'] as const).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Capacidad (tn)">
          <input type="number" value={f.maxCapacityTons} onChange={(e) => set('maxCapacityTons', Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Modalidad">
          <select value={f.fleetType} onChange={(e) => set('fleetType', e.target.value as TruckUnit['fleetType'])} className={inputCls}>
            <option>Flota Propia MD</option>
            <option>Fletero Contratado</option>
          </select>
        </Field>
        <Field label="Chofer asignado">
          <select value={driverId} onChange={(e) => set('driverId', e.target.value)} className={inputCls}>
            {state.drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {state.trucks.some((t) => t.driverId === d.id) ? ' (ya tiene unidad)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ubicación inicial">
          <select value={f.baseDestinationId} onChange={(e) => set('baseDestinationId', e.target.value)} className={inputCls}>
            {state.destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Vto. VTV/RTO">
            <input value={f.vtvExpiry} onChange={(e) => set('vtvExpiry', e.target.value)} placeholder="MM/AAAA" className={inputCls} />
          </Field>
          <Field label="Vto. seguro">
            <input value={f.insuranceExpiry} onChange={(e) => set('insuranceExpiry', e.target.value)} placeholder="MM/AAAA" className={inputCls} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function NewDriverModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useDemo();
  const empty = {
    name: '',
    dni: '',
    phone: '+54 9 3772 ',
    licenseCategory: 'LINTI Cargas Generales · E1',
    licenseExpiry: '10/2028',
    employmentType: 'Chofer Propio' as DriverProfile['employmentType'],
  };
  const [f, setF] = useState(empty);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    dispatch({ type: 'CREATE_DRIVER', driver: { ...f, name: f.name.trim() } });
    setF(empty);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Alta de personal de conducción"
      title="Registrar chofer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="new-driver-form">
            Guardar chofer
          </Button>
        </>
      }
    >
      <form id="new-driver-form" onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nombre y apellido" className="sm:col-span-2">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} placeholder="Lucas Fernández" required />
        </Field>
        <Field label="DNI / CUIL">
          <input value={f.dni} onChange={(e) => setF({ ...f, dni: e.target.value })} className={inputCls} placeholder="33.492.108" required />
        </Field>
        <Field label="Teléfono / WhatsApp">
          <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={inputCls} required />
        </Field>
        <Field label="Habilitación LINTI">
          <input value={f.licenseCategory} onChange={(e) => setF({ ...f, licenseCategory: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Vencimiento licencia">
          <input value={f.licenseExpiry} onChange={(e) => setF({ ...f, licenseExpiry: e.target.value })} placeholder="MM/AAAA" className={inputCls} />
        </Field>
        <Field label="Vínculo" className="sm:col-span-2">
          <select
            value={f.employmentType}
            onChange={(e) => setF({ ...f, employmentType: e.target.value as DriverProfile['employmentType'] })}
            className={inputCls}
          >
            <option value="Chofer Propio">Chofer propio MD</option>
            <option value="Fletero Contratado">Fletero contratado</option>
          </select>
        </Field>
      </form>
    </Modal>
  );
}
