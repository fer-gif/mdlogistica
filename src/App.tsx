import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Building2,
  CheckCircle2,
  Compass,
  Gauge,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Smartphone,
  X,
} from 'lucide-react';
import { DemoUser, PanelId, SystemNotification } from './types';
import { DEMO_USERS } from './data/seed';
import { DemoProvider, useDemo } from './state/DemoContext';
import { audienceFor, SIM_SPEEDS, SimSpeed } from './state/store';
import { AdminPanel, AdminTab } from './components/AdminPanel';
import { DriverAppPanel } from './components/DriverAppPanel';
import { ClientPortalPanel } from './components/ClientPortalPanel';
import { LoginScreen } from './components/LoginScreen';
import { cx } from './components/ui';
import { when } from './lib/format';
import mdLogo from '../logo/logo.png';

const SESSION_KEY = 'md_logistica_session';
const NOTICE_KEY = 'md_logistica_notice_hidden';

// La sesión vive en sessionStorage: cada pestaña tiene su propio usuario (admin, chofer o cliente)
// y sobrevive a la recarga, mientras que los datos de la demo se comparten entre pestañas.
function readSession(): DemoUser | null {
  try {
    const name = sessionStorage.getItem(SESSION_KEY);
    return DEMO_USERS.find((u) => u.username === name) ?? null;
  } catch {
    return null;
  }
}

export function App() {
  const [user, setUser] = useState<DemoUser | null>(readSession);

  const login = (u: DemoUser) => {
    try {
      sessionStorage.setItem(SESSION_KEY, u.username);
    } catch {
      /* sin almacenamiento */
    }
    setUser(u);
  };
  const logout = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* sin almacenamiento */
    }
    setUser(null);
  };

  return (
    <DemoProvider simulate={Boolean(user)}>
      {user ? <Shell user={user} onLogout={logout} /> : <LoginScreen onLoginSuccess={login} />}
    </DemoProvider>
  );
}

/** Paneles de la barra superior. Finanzas vive como pestaña dentro de Administración. */
type NavPanel = Exclude<PanelId, 'finance'>;

const PANEL_META: Record<NavPanel, { label: string; icon: React.ReactNode }> = {
  admin: { label: 'Administración', icon: <LayoutDashboard className="h-4 w-4" /> },
  driver: { label: 'App del Chofer', icon: <Smartphone className="h-4 w-4" /> },
  client: { label: 'Portal de Clientes', icon: <Building2 className="h-4 w-4" /> },
};

function allowedPanels(role: DemoUser['role']): NavPanel[] {
  switch (role) {
    case 'admin':
      return ['admin', 'driver', 'client'];
    case 'driver':
      return ['driver'];
    case 'client':
      return ['client'];
  }
}

function Shell({ user, onLogout }: { user: DemoUser; onLogout: () => void }) {
  const { state } = useDemo();
  const panels = allowedPanels(user.role);
  const [active, setActive] = useState<NavPanel>(panels[0]);
  const [adminTab, setAdminTab] = useState<AdminTab>('trips');
  const [selectedTruckId, setSelectedTruckId] = useState('truck-104');
  const [previewTruckId, setPreviewTruckId] = useState('truck-104');
  const [previewClientId, setPreviewClientId] = useState('cli-arcor');
  const [showNotice, setShowNotice] = useState(() => {
    try {
      return sessionStorage.getItem(NOTICE_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const hideNotice = () => {
    setShowNotice(false);
    try {
      sessionStorage.setItem(NOTICE_KEY, '1');
    } catch {
      /* sin almacenamiento */
    }
  };

  const myAudience = audienceFor(user.role, user.role === 'driver' ? user.truckId : user.clientId);
  const relevant = React.useCallback(
    (n: SystemNotification) => (user.role === 'admin' ? true : n.audience.includes(myAudience)),
    [user.role, myAudience]
  );

  /** Navega a un panel; 'finance' abre la pestaña Finanzas de Administración. */
  const navigate = (p: PanelId, tab?: AdminTab) => {
    const panel: NavPanel = p === 'finance' ? 'admin' : p;
    if (!panels.includes(panel)) return;
    setActive(panel);
    if (p === 'finance') setAdminTab('finance');
    else if (panel === 'admin' && tab) setAdminTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pendingTrips = state.trips.filter((t) => t.stage === 'pending_assignment').length;
  const badges: Partial<Record<NavPanel, number>> = { admin: active === 'admin' ? 0 : pendingTrips };


  return (
    <div className="flex min-h-screen flex-col bg-[#F5F6F8] text-[#231F20]">
      <header className="sticky top-0 z-[900] border-b border-zinc-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={mdLogo} alt="MD Logística" className="h-10 w-auto object-contain" />
            <div className="hidden h-7 items-center gap-1 sm:flex">
              <span className="h-full w-[3px] rounded-full bg-[#FFF000]" />
              <span className="h-full w-[3px] rounded-full bg-[#F2851D]" />
            </div>
            <div className="hidden leading-tight md:block">
              <div className="text-sm font-extrabold tracking-tight">Plataforma de gestión logística</div>
              <div className="text-[11px] font-semibold text-zinc-500">Paso de los Libres · Corredor AR ↔ BR</div>
            </div>
          </div>

          {panels.length > 1 && (
            <nav className="order-3 flex w-full gap-1 overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-100 p-1 lg:order-none lg:w-auto">
              {panels.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => navigate(p)}
                  className={cx(
                    'flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold transition',
                    active === p ? 'bg-[#B71E23] text-white shadow-sm' : 'text-zinc-600 hover:bg-white hover:text-[#231F20]'
                  )}
                >
                  {PANEL_META[p].icon}
                  <span>{PANEL_META[p].label}</span>
                  {badges[p] ? (
                    <span
                      className={cx(
                        'rounded-full px-1.5 text-[10px] font-black',
                        active === p ? 'bg-[#FFF000] text-[#231F20]' : 'bg-[#F2851D] text-white'
                      )}
                    >
                      {badges[p]}
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-1.5">
            <NotificationBell filter={relevant} />
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-xs font-extrabold">{user.displayName}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {user.role === 'admin'
                  ? 'Administración'
                  : user.role === 'driver'
                  ? 'Chofer'
                  : 'Cliente'}
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs font-bold text-zinc-700 transition hover:border-[#B71E23] hover:text-[#B71E23]"
              title="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {showNotice && (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-[1400px] items-start justify-between gap-3 px-4 py-2 text-[11px] text-amber-900 sm:px-6 sm:text-xs">
            <p>
              <span className="font-extrabold">Prototipo de demostración con datos simulados.</span> El sistema final
              suma el GPS real de su flota, la conexión real con ARCA/AFIP y SEFAZ, usuarios propios, servidores
              seguros y soporte.
            </p>
            <button type="button" onClick={hideNotice} className="shrink-0 rounded p-0.5 text-amber-700 hover:text-amber-950" title="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
        {active === 'admin' && (
          <AdminPanel
            tab={adminTab}
            onTabChange={(t) => {
              setAdminTab(t);
              window.scrollTo({ top: 0 });
            }}
            selectedTruckId={selectedTruckId}
            setSelectedTruckId={setSelectedTruckId}
            onNavigatePanel={navigate}
            onPreviewDriver={setPreviewTruckId}
            onPreviewClient={setPreviewClientId}
          />
        )}
        {active === 'driver' && (
          <DriverAppPanel
            truckId={user.role === 'driver' ? user.truckId! : previewTruckId}
            showTruckPicker={user.role === 'admin'}
            onChangeTruck={setPreviewTruckId}
            onNavigatePanel={user.role === 'admin' ? (p) => navigate(p, p === 'admin' ? 'tracking' : undefined) : undefined}
          />
        )}
        {active === 'client' && (
          <ClientPortalPanel
            clientId={user.role === 'client' ? user.clientId! : previewClientId}
            showClientPicker={user.role === 'admin'}
            onChangeClient={setPreviewClientId}
            onNavigatePanel={user.role === 'admin' ? (p) => navigate(p, p === 'admin' ? 'trips' : undefined) : undefined}
          />
        )}
      </main>

      <footer className="mt-6 border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-4 px-4 py-5 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-3.5">
            <img src={mdLogo} alt="MD Logística" className="h-10 w-auto object-contain" />
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#F2851D]">
                Su satisfacción, es nuestro éxito.
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">
                Demo funcional desarrollada por{' '}
                <a
                  href="https://agenciamuove.com"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-[#231F20] underline decoration-[#B71E23]"
                >
                  Agencia Muove
                </a>
                .
              </p>
            </div>
          </div>
          <a
            href="https://wa.me/5491178249821?text=Hola%20equipo%20de%20Muove%2C%20estuvimos%20viendo%20la%20demo%20de%20MD%20Log%C3%ADstica%20y%20queremos%20conversar%20sobre%20la%20propuesta."
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#B71E23] px-4 py-2.5 text-xs font-extrabold text-white shadow transition hover:bg-[#96171B]"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Hablar con Agencia Muove</span>
          </a>
        </div>
      </footer>

      <ToastStack filter={relevant} />
      {user.role === 'admin' && <DemoControls onNavigate={navigate} />}
    </div>
  );
}

function NotificationBell({ filter }: { filter: (n: SystemNotification) => boolean }) {
  const { state } = useDemo();
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(() => Date.now() - 60 * 60 * 1000);
  const ref = useRef<HTMLDivElement>(null);
  const items = useMemo(() => state.notifications.filter(filter).slice(0, 40), [state.notifications, filter]);
  const unread = items.filter((n) => n.at > seenAt).length;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setSeenAt(Date.now());
        }}
        className="relative rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-zinc-700 transition hover:border-[#B71E23] hover:text-[#B71E23]"
        title="Notificaciones"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#B71E23] px-1 text-[9px] font-black text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-[1000] mt-2 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
          <div className="border-b border-zinc-100 px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-zinc-500">
            Notificaciones
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 && <div className="p-4 text-xs text-zinc-500">Sin novedades.</div>}
            {items.map((n) => (
              <div key={n.id} className="border-b border-zinc-100 px-4 py-3 last:border-0">
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="font-bold text-[#B71E23]">{n.channelBadge}</span>
                  <span className="font-mono text-zinc-400">{when(n.at)}</span>
                </div>
                <div className="mt-0.5 text-xs font-bold text-[#231F20]">{n.title}</div>
                <div className="text-[11px] leading-relaxed text-zinc-500">{n.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToastStack({ filter }: { filter: (n: SystemNotification) => boolean }) {
  const { state } = useDemo();
  const [toasts, setToasts] = useState<SystemNotification[]>([]);
  const lastIdRef = useRef<string | undefined>(state.notifications[0]?.id);

  useEffect(() => {
    const list = state.notifications;
    if (list.length === 0) return;
    const fresh: SystemNotification[] = [];
    for (const n of list) {
      if (n.id === lastIdRef.current) break;
      fresh.push(n);
    }
    lastIdRef.current = list[0].id;
    // Solo avisos recientes: al ponerse al día con otra pestaña o reiniciar la demo no se muestran eventos viejos.
    const recent = Date.now() - 20000;
    const show = fresh.filter((n) => n.toast && filter(n) && n.at > recent);
    if (show.length) setToasts((prev) => [...show.reverse(), ...prev].slice(0, 3));
  }, [state.notifications, filter]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts((prev) => prev.slice(0, -1)), 5500);
    return () => clearTimeout(t);
  }, [toasts]);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[1300] flex w-[360px] max-w-[calc(100vw-2.5rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="md-slide-in pointer-events-auto rounded-2xl border border-[#CE2329]/50 bg-[#181D26]/95 p-3.5 text-white shadow-2xl backdrop-blur"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#F2851D]" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#F2851D]">{t.channelBadge}</div>
              <div className="text-xs font-extrabold">{t.title}</div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-300">{t.detail}</p>
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const TOUR_STEPS: { p: PanelId; tab?: AdminTab; t: string }[] = [
  { p: 'client', t: 'Pedí un viaje desde el Portal de Clientes' },
  { p: 'admin', tab: 'trips', t: 'Asignale la unidad en Administración › Viajes' },
  { p: 'driver', t: 'Iniciá el viaje desde el celular del chofer' },
  { p: 'client', t: 'Seguí el % de cumplimiento desde el portal' },
  { p: 'finance', t: 'Facturá en 1 clic en Administración › Finanzas' },
];

function DemoControls({ onNavigate }: { onNavigate: (p: PanelId, tab?: AdminTab) => void }) {
  const { state, dispatch } = useDemo();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="fixed bottom-5 left-5 z-[1250]">
      {open && (
        <div className="md-slide-in mb-2 w-[290px] rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#B71E23]">Controles de demo</div>
              <div className="text-xs text-zinc-500">No forman parte del sistema final.</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 space-y-3 text-xs">
            <div>
              <div className="mb-1 flex items-center gap-1.5 font-bold text-zinc-600">
                <Compass className="h-3.5 w-3.5" /> Recorrido sugerido
              </div>
              <ol className="space-y-1">
                {TOUR_STEPS.map((s, i) => (
                  <li key={s.t}>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate(s.p, s.tab);
                        setOpen(false);
                      }}
                      className="flex w-full gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-zinc-50"
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#B71E23] text-[9px] font-black text-white">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-zinc-700">{s.t}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2">
              <span className="font-bold">Simulación GPS</span>
              <button
                type="button"
                onClick={() => dispatch({ type: 'SET_SIM', running: !state.sim.running })}
                className={cx(
                  'flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold',
                  state.sim.running ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-700'
                )}
              >
                {state.sim.running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {state.sim.running ? 'En marcha' : 'Pausada'}
              </button>
            </div>

            <div>
              <div className="mb-1 flex items-center gap-1.5 font-bold text-zinc-600">
                <Gauge className="h-3.5 w-3.5" /> Velocidad del tiempo
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(SIM_SPEEDS) as SimSpeed[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => dispatch({ type: 'SET_SIM', speed: k })}
                    className={cx(
                      'rounded-lg border px-2 py-1.5 text-[11px] font-bold',
                      state.sim.speed === k ? 'border-[#B71E23] bg-[#FEF2F2] text-[#B71E23]' : 'border-zinc-200 text-zinc-600'
                    )}
                  >
                    {k === 'real' ? 'Real' : k === 'normal' ? 'x150' : 'x600'}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                En x150 un viaje Paso de los Libres → Pilar se recorre en ~3 minutos.
              </p>
            </div>

            {confirmReset ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <div className="font-bold text-red-800">¿Volver la demo a su estado inicial?</div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'RESET' });
                      setConfirmReset(false);
                      setOpen(false);
                    }}
                    className="rounded-lg bg-red-600 px-3 py-1.5 font-bold text-white"
                  >
                    Sí, reiniciar
                  </button>
                  <button type="button" onClick={() => setConfirmReset(false)} className="rounded-lg px-3 py-1.5 font-bold text-zinc-600">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 font-bold text-zinc-700 hover:border-[#B71E23] hover:text-[#B71E23]"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reiniciar datos de la demo
              </button>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-zinc-300 bg-white/95 px-3.5 py-2 text-xs font-extrabold text-[#231F20] shadow-lg backdrop-blur hover:border-[#B71E23]"
        title="Controles de la demostración"
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-[#B71E23]" />
        Demo
        {!state.sim.running && <span className="rounded-full bg-zinc-200 px-1.5 text-[10px]">pausa</span>}
      </button>
    </div>
  );
}

export default App;
