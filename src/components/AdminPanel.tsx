import React, { useMemo } from 'react';
import { Building2, Landmark, ListChecks, MapPin, Megaphone, Navigation, Package, PackageCheck, PackagePlus, Route, Truck } from 'lucide-react';
import { PanelId } from '../types';
import { useDemo } from '../state/DemoContext';
import { invoiceStatus } from '../state/store';
import { expiryState } from '../lib/format';
import { cx, Tabs } from './ui';
import { TripsTab } from './admin/TripsTab';
import { TrackingTab } from './admin/TrackingTab';
import { FinanceTab } from './admin/FinanceTab';
import { FleetTab } from './admin/FleetTab';
import { ClientsTab } from './admin/ClientsTab';
import { RoutesTab } from './admin/RoutesTab';
import { CommsTab } from './admin/CommsTab';

export type AdminTab = 'trips' | 'tracking' | 'finance' | 'fleet' | 'clients' | 'routes' | 'comms';

export interface AdminTabProps {
  onNavigatePanel: (p: PanelId) => void;
  onPreviewDriver: (truckId: string) => void;
  onPreviewClient: (clientId: string) => void;
  goTab: (t: AdminTab) => void;
  selectedTruckId: string;
  setSelectedTruckId: (id: string) => void;
}

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

export const AdminPanel: React.FC<{
  tab: AdminTab;
  onTabChange: (t: AdminTab) => void;
  /** Pestañas visibles según el rol (Finanzas solo ve la suya). */
  allowedTabs?: AdminTab[];
  selectedTruckId: string;
  setSelectedTruckId: (id: string) => void;
  onNavigatePanel: (p: PanelId) => void;
  onPreviewDriver: (truckId: string) => void;
  onPreviewClient: (clientId: string) => void;
}> = ({ tab, onTabChange, allowedTabs, selectedTruckId, setSelectedTruckId, onNavigatePanel, onPreviewDriver, onPreviewClient }) => {
  const { state } = useDemo();

  const k = useMemo(() => {
    const trucks = state.trucks;
    const moving = trucks.filter((t) => t.status === 'en_ruta' || t.status === 'en_aduana').length;
    const pending = state.trips.filter((t) => t.stage === 'pending_assignment').length;
    const toUnload = state.trips.filter((t) => t.stage === 'nearing_destination' || t.stage === 'unloading').length;
    const toInvoice = state.trips.filter((t) => invoiceStatus(t) === 'listo').length;
    const overdue = state.trips.filter((t) => invoiceStatus(t) === 'vencida').length;
    const docAlerts =
      trucks.filter((t) => expiryState(t.vtvExpiry) !== 'ok' || expiryState(t.insuranceExpiry) !== 'ok').length +
      state.drivers.filter((d) => expiryState(d.licenseExpiry) !== 'ok').length;
    return { moving, pending, toUnload, toInvoice, overdue, docAlerts };
  }, [state.trucks, state.trips, state.drivers]);

  const allTabs: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'trips', label: 'Viajes', icon: <ListChecks className="h-4 w-4" />, badge: k.pending },
    { id: 'tracking', label: 'Mapa', icon: <MapPin className="h-4 w-4" /> },
    { id: 'finance', label: 'Finanzas', icon: <Landmark className="h-4 w-4" />, badge: k.toInvoice + k.overdue },
    { id: 'fleet', label: 'Flota', icon: <Truck className="h-4 w-4" />, badge: k.docAlerts },
    { id: 'clients', label: 'Clientes', icon: <Building2 className="h-4 w-4" /> },
    { id: 'routes', label: 'Rutas', icon: <Route className="h-4 w-4" /> },
    { id: 'comms', label: 'Comunicación', icon: <Megaphone className="h-4 w-4" /> },
  ];
  const tabs = allowedTabs ? allTabs.filter((t) => allowedTabs.includes(t.id)) : allTabs;
  const current = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;

  const props: AdminTabProps = {
    onNavigatePanel,
    onPreviewDriver,
    onPreviewClient,
    goTab: onTabChange,
    selectedTruckId,
    setSelectedTruckId,
  };

  // El resumen operativo solo acompaña a las pestañas de operación, para no duplicar datos en el resto.
  const showOpsSummary = current === 'trips' || current === 'tracking';

  return (
    <div className="space-y-4">
      {tabs.length > 1 && <Tabs<AdminTab> value={current} onChange={onTabChange} items={tabs} />}

      {showOpsSummary && (
        <div className="grid grid-cols-2 divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm sm:grid-cols-4 sm:divide-x">
          <Stat
            icon={<Navigation className="h-4 w-4" />}
            value={`${k.moving}/${state.trucks.length}`}
            label="Camiones en ruta"
            onClick={() => onTabChange('tracking')}
          />
          <Stat
            icon={<PackagePlus className="h-4 w-4" />}
            value={k.pending}
            label="Viajes por asignar"
            highlight={k.pending > 0}
            onClick={() => onTabChange('trips')}
          />
          <Stat icon={<Package className="h-4 w-4" />} value={k.toUnload} label="Por descargar" onClick={() => onTabChange('trips')} />
          <Stat
            icon={<PackageCheck className="h-4 w-4" />}
            value={k.toInvoice}
            label="Para facturar"
            onClick={() => onTabChange('finance')}
          />
        </div>
      )}

      {current === 'trips' && <TripsTab {...props} />}
      {current === 'tracking' && <TrackingTab {...props} />}
      {current === 'finance' && <FinanceTab />}
      {current === 'fleet' && <FleetTab {...props} />}
      {current === 'clients' && <ClientsTab {...props} />}
      {current === 'routes' && <RoutesTab {...props} />}
      {current === 'comms' && <CommsTab {...props} />}
    </div>
  );
};
