import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Star, Truck, UserPlus, Users, XCircle } from 'lucide-react';
import { DriverProfile, TruckUnit } from '../../types';
import { useDemo } from '../../state/DemoContext';
import { driverNameOf, NewTruckInput } from '../../state/store';
import { expiryState, num } from '../../lib/format';
import { Button, Card, cx, Field, inputCls, Modal, SectionHeader, TruckStatusBadge } from '../ui';
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

export const FleetTab: React.FC<AdminTabProps> = ({ setSelectedTruckId, goTab }) => {
  const { state } = useDemo();
  const [truckModal, setTruckModal] = useState(false);
  const [driverModal, setDriverModal] = useState(false);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <SectionHeader
          title="Gestión de flota"
          subtitle="Unidades propias y fleteros con su documentación, vencimientos e historial. Todo cambio impacta al instante en el mapa y en despacho."
          actions={
            <>
              <Button variant="secondary" onClick={() => setDriverModal(true)}>
                <UserPlus className="h-4 w-4 text-[#F2851D]" /> Nuevo chofer
              </Button>
              <Button onClick={() => setTruckModal(true)}>
                <Truck className="h-4 w-4" /> Nueva unidad
              </Button>
            </>
          }
        />
      </Card>

      <Card className="p-5">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-extrabold">
          <Truck className="h-4 w-4 text-[#B71E23]" /> Unidades ({state.trucks.length})
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-[11px] uppercase tracking-wider text-zinc-400">
                <th className="pb-2.5 font-bold">Unidad</th>
                <th className="pb-2.5 font-bold">Tractor / Semi</th>
                <th className="pb-2.5 font-bold">Equipo</th>
                <th className="pb-2.5 font-bold">Chofer</th>
                <th className="pb-2.5 font-bold">Estado y ubicación</th>
                <th className="pb-2.5 font-bold">Odómetro</th>
                <th className="pb-2.5 font-bold">Documentación</th>
                <th className="pb-2.5 font-bold">Viajes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {state.trucks.map((t) => {
                const done = state.trips.filter((x) => x.truckId === t.id && x.stage === 'delivered').length;
                return (
                  <tr
                    key={t.id}
                    className="cursor-pointer hover:bg-zinc-50"
                    onClick={() => {
                      setSelectedTruckId(t.id);
                      goTab('tracking');
                    }}
                    title="Ver en el mapa"
                  >
                    <td className="py-3">
                      <div className="font-mono font-bold text-[#B71E23]">{t.code}</div>
                      <div className="text-[10px] text-zinc-400">{t.fleetType}</div>
                    </td>
                    <td className="py-3">
                      <div className="font-bold">
                        {t.brand} {t.model} <span className="font-normal text-zinc-400">({t.year})</span>
                      </div>
                      <div className="font-mono text-[11px] text-zinc-500">
                        {t.tractorPlate} / {t.trailerPlate}
                      </div>
                    </td>
                    <td className="py-3">
                      {t.trailerType} · <span className="font-mono">{t.maxCapacityTons} tn</span>
                    </td>
                    <td className="py-3 font-bold">{driverNameOf(state, t)}</td>
                    <td className="py-3">
                      <TruckStatusBadge status={t.status} />
                      <div className="mt-0.5 max-w-[200px] truncate text-[11px] text-zinc-500">{t.locationLabel}</div>
                    </td>
                    <td className="py-3 font-mono">{num(t.odometerKm)} km</td>
                    <td className="space-y-1 py-3">
                      <div>
                        <ExpiryPill label="VTV/RTO" value={t.vtvExpiry} />
                      </div>
                      <div>
                        <ExpiryPill label="Seguro" value={t.insuranceExpiry} />
                      </div>
                    </td>
                    <td className="py-3 font-mono font-bold">{done}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-extrabold">
          <Users className="h-4 w-4 text-[#F2851D]" /> Choferes ({state.drivers.length})
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {state.drivers.map((d) => {
            const truck = state.trucks.find((t) => t.driverId === d.id);
            const trips = state.trips.filter((t) => t.stage === 'delivered' && state.trucks.find((x) => x.id === t.truckId)?.driverId === d.id);
            return (
              <div key={d.id} className="space-y-2 rounded-xl border border-zinc-200 bg-[#F5F6F8]/60 p-3.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold">{d.name}</span>
                  <span className="rounded-full bg-[#231F20] px-2 py-0.5 text-[10px] font-bold text-white">{d.employmentType}</span>
                </div>
                <div className="font-mono text-[11px] text-zinc-500">
                  DNI {d.dni} · {d.phone}
                </div>
                <div className="text-[11px] font-semibold text-zinc-700">{d.licenseCategory}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <ExpiryPill label="Licencia" value={d.licenseExpiry} />
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                    <Star className="h-3 w-3 fill-current" /> {d.rating.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-zinc-200 pt-2 text-[11px] text-zinc-500">
                  <span>{truck ? `Unidad ${truck.code}` : 'Sin unidad asignada'}</span>
                  <span>{trips.length} viaje(s) entregados</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

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
