import React, { useMemo, useState } from 'react';
import { Building2, MapPin, Megaphone, Navigation, Package, PackagePlus, PackageCheck, Route, Send, Truck } from 'lucide-react';
import { PanelId } from '../types';
import { useDemo } from '../state/DemoContext';
import { invoiceStatus } from '../state/store';
import { expiryState } from '../lib/format';
import { cx, Tabs } from './ui';

function Stat({
  icon,
  value,
  label,
  onClick,
  highlight,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50">
      <span
        className={cx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          highlight ? 'bg-[#B71E23] text-white' : 'bg-zinc-100 text-zinc-600'
        )}
      >
        {icon}
      </span>
      <span>
        <span className="block text-xl font-extrabold leading-none">{value}</span>
        <span className="mt-1 block text-[11px] font-semibold text-zinc-500">{label}</span>
      </span>
    </button>
  );
}
import { TrackingTab } from './admin/TrackingTab';
import { DispatchTab } from './admin/DispatchTab';
import { FleetTab } from './admin/FleetTab';
import { ClientsTab } from './admin/ClientsTab';
import { RoutesTab } from './admin/RoutesTab';
import { CommsTab } from './admin/CommsTab';

export type AdminTab = 'tracking' | 'dispatch' | 'fleet' | 'clients' | 'routes' | 'comms';

export interface AdminTabProps {
  onNavigatePanel: (p: PanelId) => void;
  onPreviewDriver: (truckId: string) => void;
  onPreviewClient: (clientId: string) => void;
  goTab: (t: AdminTab) => void;
  selectedTruckId: string;
  setSelectedTruckId: (id: string) => void;
}

export const AdminPanel: React.FC<{
  onNavigatePanel: (p: PanelId) => void;
  onPreviewDriver: (truckId: string) => void;
  onPreviewClient: (clientId: string) => void;
}> = ({ onNavigatePanel, onPreviewDriver, onPreviewClient }) => {
  const { state } = useDemo();
  const [tab, setTab] = useState<AdminTab>('tracking');
  const [selectedTruckId, setSelectedTruckId] = useState('truck-104');

  const k = useMemo(() => {
    const trucks = state.trucks;
    const moving = trucks.filter((t) => t.status === 'en_ruta' || t.status === 'en_aduana').length;
    const free = trucks.filter((t) => t.status === 'disponible' && t.driverAvailable).length;
    const pending = state.trips.filter((t) => t.stage === 'pending_assignment');
    const transit = state.trips.filter((t) => ['assigned', 'in_transit', 'customs', 'nearing_destination', 'unloading'].includes(t.stage));
    const toUnload = state.trips.filter((t) => t.stage === 'nearing_destination' || t.stage === 'unloading').length;
    const tons = transit.reduce((s, t) => s + t.weightTons, 0);
    const docAlerts =
      trucks.filter((t) => expiryState(t.vtvExpiry) !== 'ok' || expiryState(t.insuranceExpiry) !== 'ok').length +
      state.drivers.filter((d) => expiryState(d.licenseExpiry) !== 'ok').length;
    const overdue = state.trips.filter((t) => invoiceStatus(t) === 'vencida').length;
    const requests = pending.filter((t) => t.requestedByClient && t.offeredTruckIds.length === 0).length;
    return { moving, free, pending, transit, toUnload, tons, docAlerts, overdue, requests };
  }, [state.trucks, state.trips, state.drivers]);

  const props: AdminTabProps = {
    onNavigatePanel,
    onPreviewDriver,
    onPreviewClient,
    goTab: setTab,
    selectedTruckId,
    setSelectedTruckId,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm sm:grid-cols-4 sm:divide-x">
        <Stat
          icon={<Navigation className="h-4 w-4" />}
          value={`${k.moving}/${state.trucks.length}`}
          label="Camiones en ruta"
          onClick={() => setTab('tracking')}
        />
        <Stat
          icon={<PackagePlus className="h-4 w-4" />}
          value={k.pending.length}
          label="Cargas sin cubrir"
          highlight={k.pending.length > 0}
          onClick={() => setTab('dispatch')}
        />
        <Stat
          icon={<Package className="h-4 w-4" />}
          value={k.toUnload}
          label="Por descargar"
          onClick={() => setTab('tracking')}
        />
        <Stat
          icon={<PackageCheck className="h-4 w-4" />}
          value={state.trips.filter((t) => t.stage === 'delivered' && !t.invoice).length}
          label="Para facturar"
          onClick={() => onNavigatePanel('finance')}
        />
      </div>

      <Tabs<AdminTab>
        value={tab}
        onChange={setTab}
        items={[
          { id: 'tracking', label: 'Mapa y seguimiento', icon: <MapPin className="h-4 w-4" /> },
          { id: 'dispatch', label: 'Cargas y despacho', icon: <Send className="h-4 w-4" />, badge: k.pending.length },
          { id: 'fleet', label: 'Flota y choferes', icon: <Truck className="h-4 w-4" />, badge: k.docAlerts },
          { id: 'clients', label: 'Clientes', icon: <Building2 className="h-4 w-4" /> },
          { id: 'routes', label: 'Rutas y destinos', icon: <Route className="h-4 w-4" /> },
          { id: 'comms', label: 'Comunicación', icon: <Megaphone className="h-4 w-4" /> },
        ]}
      />

      {tab === 'tracking' && <TrackingTab {...props} />}
      {tab === 'dispatch' && <DispatchTab {...props} />}
      {tab === 'fleet' && <FleetTab {...props} />}
      {tab === 'clients' && <ClientsTab {...props} />}
      {tab === 'routes' && <RoutesTab {...props} />}
      {tab === 'comms' && <CommsTab {...props} />}
    </div>
  );
};
