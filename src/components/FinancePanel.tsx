import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Clock,
  Download,
  FileBadge2,
  FileText,
  Fuel,
  Image as ImageIcon,
  Landmark,
  Loader2,
  PieChart,
  Receipt,
  TrendingUp,
  Truck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { PanelId, RouteExpense, Trip } from '../types';
import { useDemo } from '../state/DemoContext';
import {
  DemoState,
  driverNameOf,
  getClient,
  getCorridor,
  getDriver,
  getTruck,
  invoiceStatus,
  InvoiceStatus,
  tripFinancials,
  FLEET_COST_PER_KM_USD,
} from '../state/store';
import { ars, dateShort, downloadCsv, num, usd, when } from '../lib/format';
import { printTripDocument } from '../lib/documents';
import { Button, Card, cx, EmptyState, KpiCard, Modal, SectionHeader, StageBadge, Tabs } from './ui';

type FinanceTab = 'billing' | 'collections' | 'expenses' | 'profit';

const DAY = 86400000;

function docCtx(state: DemoState, trip: Trip) {
  const truck = getTruck(state, trip.truckId);
  return {
    trip,
    corridor: getCorridor(state, trip.corridorId),
    client: getClient(state, trip.clientId),
    truck,
    driver: getDriver(state, truck?.driverId),
  };
}

function marginColor(pct: number) {
  if (pct >= 25) return 'text-emerald-700';
  if (pct >= 10) return 'text-amber-600';
  return 'text-red-600';
}

function marginBar(pct: number) {
  if (pct >= 25) return 'bg-emerald-500';
  if (pct >= 10) return 'bg-amber-500';
  return 'bg-red-500';
}

const STATUS_PILL: Record<InvoiceStatus, { label: string; cls: string }> = {
  no_listo: { label: 'En curso', cls: 'bg-zinc-100 text-zinc-600' },
  listo: { label: 'Listo para facturar', cls: 'bg-[#FEF2F2] text-[#B71E23]' },
  emitida: { label: 'Emitida', cls: 'bg-blue-50 text-blue-700' },
  vencida: { label: 'Vencida', cls: 'bg-red-100 text-red-700' },
  cobrada: { label: 'Cobrada', cls: 'bg-emerald-50 text-emerald-700' },
};

function StatusPill({ status }: { status: InvoiceStatus }) {
  const s = STATUS_PILL[status];
  return <span className={cx('inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap', s.cls)}>{s.label}</span>;
}

function daysLabel(trip: Trip) {
  const inv = trip.invoice;
  if (!inv) return '';
  if (inv.paidAt) return `Cobrada ${dateShort(inv.paidAt)}`;
  const diff = Math.round((inv.dueAt - Date.now()) / DAY);
  if (diff < 0) return `Vencida hace ${Math.abs(diff)} día(s)`;
  if (diff === 0) return 'Vence hoy';
  return `Vence en ${diff} día(s)`;
}

export const FinancePanel: React.FC<{ onNavigatePanel?: (p: PanelId) => void }> = ({ onNavigatePanel }) => {
  const { state, dispatch } = useDemo();
  const [tab, setTab] = useState<FinanceTab>('billing');
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [expenseFilter, setExpenseFilter] = useState<'pendientes' | 'todos'>('pendientes');
  const [photo, setPhoto] = useState<RouteExpense | null>(null);

  const trips = state.trips;
  const now = Date.now();
  const nowD = new Date(now);

  // ---------- KPIs ----------
  const invoiced = trips.filter((t) => t.invoice);
  const monthInvoiced = invoiced
    .filter((t) => {
      const d = new Date(t.invoice!.issuedAt);
      return d.getMonth() === nowD.getMonth() && d.getFullYear() === nowD.getFullYear();
    })
    .reduce((s, t) => s + t.invoice!.amountUsd, 0);
  const collected = invoiced.filter((t) => t.invoice!.paidAt).reduce((s, t) => s + t.invoice!.amountUsd, 0);
  const receivable = invoiced.filter((t) => !t.invoice!.paidAt);
  const receivableUsd = receivable.reduce((s, t) => s + t.invoice!.amountUsd, 0);
  const overdue = receivable.filter((t) => t.invoice!.dueAt < now);
  const overdueUsd = overdue.reduce((s, t) => s + t.invoice!.amountUsd, 0);
  const readyTrips = trips.filter((t) => invoiceStatus(t) === 'listo');
  const deliveredTrips = trips.filter((t) => t.stage === 'delivered');
  const deliveredFin = deliveredTrips.map((t) => ({ t, f: tripFinancials(state, t) }));
  const totalTariffDelivered = deliveredFin.reduce((s, x) => s + x.t.agreedTariffUsd, 0);
  const totalNetDelivered = deliveredFin.reduce((s, x) => s + x.f.netUsd, 0);
  const avgMarginPct = totalTariffDelivered > 0 ? (totalNetDelivered / totalTariffDelivered) * 100 : 0;

  // ---------- Facturación ----------
  const inProgressTrips = trips.filter((t) => invoiceStatus(t) === 'no_listo' && t.stage !== 'pending_assignment');
  const emittedTrips = [...invoiced].sort((a, b) => b.invoice!.issuedAt - a.invoice!.issuedAt);

  const handleEmit = (trip: Trip) => {
    setIssuingId(trip.id);
    setTimeout(() => {
      dispatch({ type: 'EMIT_INVOICE', tripId: trip.id });
      setIssuingId(null);
    }, 900);
  };

  // ---------- Cobranzas ----------
  const collectionTrips = emittedTrips.filter((t) => clientFilter === 'all' || t.clientId === clientFilter);
  const clientBalances = useMemo(
    () =>
      state.clients
        .map((c) => {
          const inv = state.trips.filter((t) => t.clientId === c.id && t.invoice);
          const pending = inv.filter((t) => !t.invoice!.paidAt);
          const od = pending.filter((t) => t.invoice!.dueAt < Date.now());
          return {
            client: c,
            count: inv.length,
            balance: pending.reduce((s, t) => s + t.invoice!.amountUsd, 0),
            overdue: od.reduce((s, t) => s + t.invoice!.amountUsd, 0),
            paid: inv.filter((t) => t.invoice!.paidAt).reduce((s, t) => s + t.invoice!.amountUsd, 0),
          };
        })
        .filter((b) => b.count > 0),
    [state.clients, state.trips]
  );

  // ---------- Gastos ----------
  const tripCode = (id: string) => state.trips.find((t) => t.id === id)?.code ?? '—';
  const visibleExpenses = state.expenses.filter((e) => expenseFilter === 'todos' || e.status === 'pendiente');
  const pendingExpenses = state.expenses.filter((e) => e.status === 'pendiente');

  const settlements = useMemo(() => {
    return state.trucks
      .map((truck) => {
        const driver = getDriver(state, truck.driverId);
        const delivered = state.trips.filter((t) => t.truckId === truck.id && t.stage === 'delivered');
        const settlementUsd = delivered.reduce((s, t) => s + t.driverSettlementUsd, 0);
        const reimburse = state.expenses.filter(
          (e) => e.truckId === truck.id && e.status === 'aprobado' && e.source === 'App Chofer'
        );
        const reimburseUsd = reimburse.reduce((s, e) => s + e.amountUsd, 0);
        const pendingAudit = state.expenses.filter((e) => e.truckId === truck.id && e.status === 'pendiente').length;
        return {
          truck,
          driverName: driver?.name ?? 'Sin chofer',
          employment: driver?.employmentType ?? truck.fleetType,
          trips: delivered.length,
          settlementUsd,
          reimburseUsd,
          totalUsd: settlementUsd + reimburseUsd,
          pendingAudit,
        };
      })
      .sort((a, b) => b.totalUsd - a.totalUsd);
  }, [state]);

  // ---------- Rentabilidad ----------
  const profitTrips = trips
    .filter((t) => t.stage !== 'pending_assignment')
    .map((t) => ({ t, f: tripFinancials(state, t), projected: t.stage !== 'delivered' }))
    .sort((a, b) => Number(a.projected) - Number(b.projected) || b.f.marginPct - a.f.marginPct);

  function aggregate(keyOf: (t: Trip) => string, labelOf: (key: string) => string) {
    const map = new Map<string, { tariff: number; net: number; trips: number }>();
    profitTrips.forEach(({ t, f }) => {
      const k = keyOf(t);
      const cur = map.get(k) ?? { tariff: 0, net: 0, trips: 0 };
      cur.tariff += t.agreedTariffUsd;
      cur.net += f.netUsd;
      cur.trips += 1;
      map.set(k, cur);
    });
    return Array.from(map.entries())
      .map(([k, v]) => ({ key: k, label: labelOf(k), ...v, pct: v.tariff > 0 ? (v.net / v.tariff) * 100 : 0 }))
      .sort((a, b) => b.net - a.net);
  }

  const byTruck = aggregate(
    (t) => t.truckId ?? 'none',
    (k) => {
      const tr = getTruck(state, k);
      return tr ? `${tr.code} · ${driverNameOf(state, tr)}` : 'Sin unidad';
    }
  );
  const byClient = aggregate((t) => t.clientId, (k) => getClient(state, k)?.name ?? k);
  const byRoute = aggregate((t) => t.corridorId, (k) => getCorridor(state, k)?.name ?? k);

  // ---------- Exportación ----------
  const handleExport = () => {
    const stamp = dateShort(Date.now()).replace(/\//g, '-');
    if (tab === 'billing') {
      downloadCsv(`facturacion_${stamp}.csv`, [
        ['Viaje', 'Cliente', 'Identificación fiscal', 'Estado', 'Comprobante', 'CAE / Chave', 'Emisión', 'Importe USD'],
        ...trips
          .filter((t) => t.stage === 'delivered')
          .map((t) => {
            const c = getClient(state, t.clientId);
            return [
              t.code,
              c?.name ?? '',
              c?.taxId ?? '',
              STATUS_PILL[invoiceStatus(t)].label,
              t.invoice?.number ?? '',
              t.invoice?.authCode ?? '',
              t.invoice ? dateShort(t.invoice.issuedAt) : '',
              t.invoice?.amountUsd ?? t.agreedTariffUsd,
            ];
          }),
      ]);
    } else if (tab === 'collections') {
      downloadCsv(`cobranzas_${stamp}.csv`, [
        ['Comprobante', 'Viaje', 'Cliente', 'Emisión', 'Vencimiento', 'Situación', 'Importe USD', 'Estado'],
        ...collectionTrips.map((t) => [
          t.invoice!.number,
          t.code,
          getClient(state, t.clientId)?.name ?? '',
          dateShort(t.invoice!.issuedAt),
          dateShort(t.invoice!.dueAt),
          daysLabel(t),
          t.invoice!.amountUsd,
          STATUS_PILL[invoiceStatus(t)].label,
        ]),
      ]);
    } else if (tab === 'expenses') {
      downloadCsv(`gastos_y_liquidaciones_${stamp}.csv`, [
        ['GASTOS DE RUTA'],
        ['Fecha', 'Viaje', 'Chofer', 'Categoría', 'Detalle', 'Ubicación', 'Origen', 'Importe ARS', 'Importe USD', 'Estado'],
        ...state.expenses.map((e) => [
          dateShort(e.createdAt),
          tripCode(e.tripId),
          e.driverName,
          e.category,
          e.note,
          e.location,
          e.source,
          e.amountArs,
          e.amountUsd,
          e.status,
        ]),
        [],
        ['LIQUIDACIONES'],
        ['Unidad', 'Chofer', 'Vínculo', 'Viajes entregados', 'Liquidación USD', 'Reintegro gastos USD', 'Total a pagar USD'],
        ...settlements.map((s) => [s.truck.code, s.driverName, s.employment, s.trips, s.settlementUsd, s.reimburseUsd, s.totalUsd]),
      ]);
    } else {
      downloadCsv(`rentabilidad_${stamp}.csv`, [
        ['Viaje', 'Estado', 'Cliente', 'Ruta', 'Tarifa USD', 'Costos de ruta USD', 'Liquidación chofer USD', 'Neto USD', 'Margen %', 'Desvío presupuesto USD'],
        ...profitTrips.map(({ t, f, projected }) => [
          t.code,
          projected ? 'Proyectado' : 'Real',
          getClient(state, t.clientId)?.name ?? '',
          getCorridor(state, t.corridorId)?.name ?? '',
          t.agreedTariffUsd,
          f.routeCostsUsd,
          t.driverSettlementUsd,
          f.netUsd,
          num(f.marginPct, 1),
          f.budgetDeviationUsd,
        ]),
      ]);
    }
  };

  const thCls = 'pb-2.5 pr-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 whitespace-nowrap';
  const tdCls = 'py-2.5 pr-3 align-middle';
  const [showSettlements, setShowSettlements] = useState(false);
  const [rankBy, setRankBy] = useState<'truck' | 'client' | 'route'>('client');
  const ranking = rankBy === 'truck' ? byTruck : rankBy === 'client' ? byClient : byRoute;
  const maxNet = Math.max(1, ...ranking.map((r) => Math.abs(r.net)));
  const statusOrder: Record<InvoiceStatus, number> = { vencida: 0, emitida: 1, listo: 2, no_listo: 3, cobrada: 4 };
  const invoiceRows = [...collectionTrips].sort(
    (a, b) => statusOrder[invoiceStatus(a)] - statusOrder[invoiceStatus(b)] || b.invoice!.issuedAt - a.invoice!.issuedAt
  );

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#B71E23]">Panel de Finanzas</div>
          <div className="text-xl font-extrabold leading-tight">Facturación, cobros y rentabilidad</div>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          <Download className="h-4 w-4" /> Exportar a Excel
        </Button>
      </div>

      {/* Lo que requiere acción */}
      <div className="grid grid-cols-1 divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <ActionStat
          icon={<FileBadge2 className="h-4 w-4" />}
          value={`${readyTrips.length}`}
          label={readyTrips.length ? `Para facturar · ${usd(readyTrips.reduce((s, t) => s + t.agreedTariffUsd, 0))}` : 'Nada pendiente de facturar'}
          highlight={readyTrips.length > 0}
          onClick={() => setTab('billing')}
        />
        <ActionStat
          icon={<Wallet className="h-4 w-4" />}
          value={usd(receivableUsd)}
          label={overdueUsd > 0 ? `Por cobrar · ${usd(overdueUsd)} vencido` : 'Por cobrar · sin vencidas'}
          danger={overdueUsd > 0}
          onClick={() => setTab('billing')}
        />
        <ActionStat
          icon={<Receipt className="h-4 w-4" />}
          value={`${pendingExpenses.length}`}
          label="Gastos de ruta por auditar"
          highlight={pendingExpenses.length > 0}
          onClick={() => setTab('expenses')}
        />
      </div>

      <Tabs<FinanceTab>
        value={tab}
        onChange={setTab}
        items={[
          { id: 'billing', label: 'Facturación y cobros', icon: <FileBadge2 className="h-4 w-4" />, badge: readyTrips.length + overdue.length },
          { id: 'expenses', label: 'Gastos y liquidaciones', icon: <Receipt className="h-4 w-4" />, badge: pendingExpenses.length },
          { id: 'profit', label: 'Rentabilidad', icon: <PieChart className="h-4 w-4" /> },
        ]}
      />

      {/* ---------- FACTURACIÓN Y COBROS ---------- */}
      {tab === 'billing' && (
        <div className="space-y-4">
          {readyTrips.length > 0 && (
            <div className="space-y-2">
              {readyTrips.map((trip) => {
                const client = getClient(state, trip.clientId);
                const corridor = getCorridor(state, trip.corridorId);
                const isBr = client?.country === 'BR';
                const issuing = issuingId === trip.id;
                return (
                  <div key={trip.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[#B71E23]/50 bg-[#FEF2F2]/60 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-bold">{trip.code}</span>
                        <span className="font-extrabold">{client?.name}</span>
                        <span className="text-zinc-500">
                          {corridor?.origin.split(',')[0]} → {corridor?.destination.split(',')[0]}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-zinc-500">Remito conformado {trip.delivery ? when(trip.delivery.signedAt) : ''}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-base font-extrabold">{usd(trip.agreedTariffUsd)}</span>
                      <Button onClick={() => handleEmit(trip)} disabled={Boolean(issuingId)}>
                        {issuing ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            {isBr ? 'Transmitiendo a SEFAZ…' : 'Conectando con ARCA…'}
                          </>
                        ) : (
                          <>
                            <FileBadge2 className="h-3.5 w-3.5" />
                            {isBr ? 'Emitir CT-e · SEFAZ' : 'Emitir Factura A · ARCA'}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">Comprobantes emitidos</div>
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold focus:border-[#B71E23] focus:outline-none"
              >
                <option value="all">Todos los clientes</option>
                {state.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {invoiceRows.length === 0 ? (
              <EmptyState title="Sin comprobantes para este cliente" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200">
                      <th className={thCls}>Comprobante</th>
                      <th className={thCls}>Cliente</th>
                      <th className={thCls}>Vencimiento</th>
                      <th className={cx(thCls, 'text-right')}>Importe</th>
                      <th className={thCls}>Estado</th>
                      <th className={thCls}></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {invoiceRows.map((t) => {
                      const st = invoiceStatus(t);
                      return (
                        <tr key={t.id} className="hover:bg-zinc-50/70">
                          <td className={tdCls}>
                            <button
                              type="button"
                              onClick={() => printTripDocument('factura', docCtx(state, t))}
                              className="font-mono font-bold hover:text-[#B71E23] hover:underline"
                            >
                              {t.invoice!.number}
                            </button>
                            <div className="text-[10px] text-zinc-500">{t.code}</div>
                          </td>
                          <td className={cx(tdCls, 'font-semibold text-zinc-700')}>{getClient(state, t.clientId)?.name}</td>
                          <td className={cx(tdCls, st === 'vencida' ? 'font-bold text-red-600' : 'text-zinc-600')}>{daysLabel(t)}</td>
                          <td className={cx(tdCls, 'text-right font-mono font-bold')}>{usd(t.invoice!.amountUsd)}</td>
                          <td className={tdCls}>
                            <StatusPill status={st} />
                          </td>
                          <td className={cx(tdCls, 'text-right')}>
                            {st !== 'cobrada' ? (
                              <Button size="sm" variant="success" onClick={() => dispatch({ type: 'REGISTER_PAYMENT', tripId: t.id })}>
                                <Banknote className="h-3.5 w-3.5" /> Registrar cobro
                              </Button>
                            ) : (
                              <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ---------- GASTOS Y LIQUIDACIONES ---------- */}
      {tab === 'expenses' && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">Gastos de ruta</div>
              <div className="flex rounded-xl border border-zinc-200 bg-zinc-50 p-0.5">
                {(['pendientes', 'todos'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setExpenseFilter(f)}
                    className={cx('rounded-lg px-3 py-1 text-[11px] font-bold transition', expenseFilter === f ? 'bg-white text-[#B71E23] shadow-sm' : 'text-zinc-500')}
                  >
                    {f === 'pendientes' ? `Por auditar (${pendingExpenses.length})` : `Todos (${state.expenses.length})`}
                  </button>
                ))}
              </div>
            </div>
            {visibleExpenses.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />} title="Todo auditado" text="Los tickets nuevos de los choferes aparecen acá al instante." />
            ) : (
              <div className="divide-y divide-zinc-100">
                {visibleExpenses.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    {e.photoDataUrl ? (
                      <button type="button" onClick={() => setPhoto(e)} className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-zinc-200" title="Ver foto del ticket">
                        <img src={e.photoDataUrl} alt="Ticket" className="h-full w-full object-cover" />
                      </button>
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400">
                        {e.source === 'Tarjeta Combustible' ? <Fuel className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="font-bold">
                        {e.category} · <span className="font-mono">{tripCode(e.tripId)}</span>
                      </div>
                      <div className="truncate text-[11px] text-zinc-500">
                        {e.driverName} · {e.note} · {when(e.createdAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-extrabold">{ars(e.amountArs)}</div>
                      <div className="font-mono text-[10px] text-zinc-500">≈ {usd(e.amountUsd)}</div>
                    </div>
                    <div className="flex w-full justify-end gap-1.5 sm:w-auto">
                      {e.status === 'pendiente' ? (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => dispatch({ type: 'REVIEW_EXPENSE', expenseId: e.id, status: 'rechazado' })}>
                            <XCircle className="h-3.5 w-3.5" /> Rechazar
                          </Button>
                          <Button size="sm" onClick={() => dispatch({ type: 'REVIEW_EXPENSE', expenseId: e.id, status: 'aprobado' })}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
                          </Button>
                        </>
                      ) : (
                        <span
                          className={cx(
                            'rounded-full px-2.5 py-0.5 text-[10px] font-extrabold',
                            e.status === 'aprobado' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                          )}
                        >
                          {e.status === 'aprobado' ? 'Aprobado' : 'Rechazado'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <button
              type="button"
              onClick={() => setShowSettlements((v) => !v)}
              className="flex w-full items-center justify-between text-xs font-extrabold uppercase tracking-wider text-zinc-500 hover:text-[#B71E23]"
            >
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4" /> Liquidación a choferes y fleteros
              </span>
              <span className="normal-case tracking-normal">
                Total a pagar {usd(settlements.reduce((s, x) => s + x.totalUsd, 0))} · {showSettlements ? 'Ocultar' : 'Ver detalle'}
              </span>
            </button>
            {showSettlements && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200">
                      <th className={thCls}>Chofer</th>
                      <th className={thCls}>Vínculo</th>
                      <th className={cx(thCls, 'text-right')}>Viajes</th>
                      <th className={cx(thCls, 'text-right')}>Liquidación</th>
                      <th className={cx(thCls, 'text-right')}>Reintegros</th>
                      <th className={cx(thCls, 'text-right')}>Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {settlements.map((s) => (
                      <tr key={s.truck.id}>
                        <td className={tdCls}>
                          <div className="font-bold">{s.driverName}</div>
                          <div className="font-mono text-[10px] text-zinc-500">{s.truck.code}</div>
                        </td>
                        <td className={cx(tdCls, 'text-zinc-600')}>{s.employment}</td>
                        <td className={cx(tdCls, 'text-right font-mono')}>{s.trips}</td>
                        <td className={cx(tdCls, 'text-right font-mono')}>{usd(s.settlementUsd)}</td>
                        <td className={cx(tdCls, 'text-right font-mono')}>{usd(s.reimburseUsd)}</td>
                        <td className={cx(tdCls, 'text-right font-mono font-extrabold')}>{usd(s.totalUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ---------- RENTABILIDAD ---------- */}
      {tab === 'profit' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="p-4 xl:col-span-5">
            <div className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">Margen neto promedio</div>
            <div className={cx('mt-1 text-3xl font-extrabold', marginColor(avgMarginPct))}>{num(avgMarginPct, 1)}%</div>
            <div className="text-xs text-zinc-500">
              {usd(totalNetDelivered)} netos sobre {usd(totalTariffDelivered)} facturables · {deliveredTrips.length} viajes entregados
            </div>
            <div className="mt-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-[11px] text-zinc-500">
              Neto = tarifa − combustible y peajes − chofer − costos operativos de flota propia (amortización, seguro,
              mantenimiento y cubiertas, USD {FLEET_COST_PER_KM_USD.toLocaleString('es-AR')}/km).
            </div>

            <div className="mt-5 flex gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-0.5">
              {(
                [
                  ['client', 'Por cliente'],
                  ['truck', 'Por camión'],
                  ['route', 'Por ruta'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setRankBy(k)}
                  className={cx('flex-1 rounded-lg px-2 py-1 text-[11px] font-bold', rankBy === k ? 'bg-white text-[#B71E23] shadow-sm' : 'text-zinc-500')}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-3">
              {ranking.map((r) => (
                <div key={r.key}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-semibold text-zinc-700" title={r.label}>
                      {r.label}
                    </span>
                    <span className="shrink-0 font-mono font-bold">{usd(r.net)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <div className={cx('h-full rounded-full', marginBar(r.pct))} style={{ width: `${Math.max(3, (Math.abs(r.net) / maxNet) * 100)}%` }} />
                    </div>
                    <span className={cx('w-12 shrink-0 text-right font-mono text-[11px] font-bold', marginColor(r.pct))}>{num(r.pct, 1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 xl:col-span-7">
            <div className="mb-3 text-xs font-extrabold uppercase tracking-wider text-zinc-500">Margen por viaje</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className={thCls}>Viaje</th>
                    <th className={thCls}>Cliente</th>
                    <th className={cx(thCls, 'text-right')}>Tarifa</th>
                    <th className={cx(thCls, 'text-right')}>Neto</th>
                    <th className={cx(thCls, 'text-right')}>Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {profitTrips.map(({ t, f, projected }) => (
                    <tr key={t.id} className={cx(projected && 'text-zinc-400')}>
                      <td className={tdCls}>
                        <span className="font-mono font-bold">{t.code}</span>
                        {projected && <span className="ml-1.5 text-[10px] font-bold text-[#F2851D]">proyectado</span>}
                      </td>
                      <td className={tdCls}>{getClient(state, t.clientId)?.name}</td>
                      <td className={cx(tdCls, 'text-right font-mono')}>{usd(t.agreedTariffUsd)}</td>
                      <td className={cx(tdCls, 'text-right font-mono font-bold')}>{usd(f.netUsd)}</td>
                      <td className={cx(tdCls, 'text-right font-mono font-extrabold', !projected && marginColor(f.marginPct))}>{num(f.marginPct, 1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <Modal
        open={Boolean(photo)}
        onClose={() => setPhoto(null)}
        eyebrow="Comprobante de gasto"
        title={photo ? `${photo.category} · ${tripCode(photo.tripId)}` : ''}
        footer={
          <Button variant="secondary" onClick={() => setPhoto(null)}>
            Cerrar
          </Button>
        }
      >
        {photo && (
          <div className="space-y-3">
            {photo.photoDataUrl && (
              <img src={photo.photoDataUrl} alt="Ticket" className="max-h-[60vh] w-full rounded-xl border border-zinc-200 object-contain" />
            )}
            <div className="text-xs text-zinc-600">
              {photo.driverName} · {photo.note} · {photo.location} · {when(photo.createdAt)}
            </div>
            <div className="font-mono text-sm font-bold text-[#231F20]">
              {ars(photo.amountArs)} <span className="text-zinc-500">≈ {usd(photo.amountUsd)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

function ActionStat({
  icon,
  value,
  label,
  onClick,
  highlight,
  danger,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  onClick: () => void;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50">
      <span
        className={cx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          danger ? 'bg-red-50 text-red-600' : highlight ? 'bg-[#B71E23] text-white' : 'bg-zinc-100 text-zinc-600'
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-lg font-extrabold leading-tight">{value}</span>
        <span className={cx('block truncate text-[11px] font-semibold', danger ? 'text-red-600' : 'text-zinc-500')}>{label}</span>
      </span>
    </button>
  );
}
