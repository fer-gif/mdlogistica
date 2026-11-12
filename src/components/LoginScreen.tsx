import React, { useState } from 'react';
import { AlertCircle, Building2, Eye, EyeOff, LayoutDashboard, Lock, Smartphone, User } from 'lucide-react';
import mdLogo from '../../logo/logo.png';
import seguimientoBg from '../../imagenes/seguimiento.jpg';
import { DemoUser } from '../types';
import { DEMO_USERS } from '../data/seed';
import { cx } from './ui';

interface LoginScreenProps {
  onLoginSuccess: (user: DemoUser) => void;
}

const ROLE_INFO: Record<DemoUser['role'], { label: string; icon: React.ReactNode; desc: string }> = {
  admin: {
    label: 'Administración',
    icon: <LayoutDashboard className="h-5 w-5" />,
    desc: 'Viajes, mapa, finanzas y flota. Incluye la vista del chofer y del cliente.',
  },
  driver: { label: 'Chofer', icon: <Smartphone className="h-5 w-5" />, desc: 'App del chofer de la unidad MD-104.' },
  client: { label: 'Cliente', icon: <Building2 className="h-5 w-5" />, desc: 'Portal de seguimiento de Arcor S.A.I.C.' },
};

const fieldCls =
  'flex items-center gap-3 rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 focus-within:border-[#B71E23] focus-within:ring-2 focus-within:ring-[#B71E23]/15';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState(DEMO_USERS[0].username);
  const [password, setPassword] = useState(DEMO_USERS[0].password);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = DEMO_USERS.find((u) => u.username === username.trim().toLowerCase());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const user = DEMO_USERS.find((u) => u.username === username.trim().toLowerCase());
    if (!user || user.password !== password) {
      setError('Usuario o contraseña incorrectos.');
      return;
    }
    setLoading(true);
    setTimeout(() => onLoginSuccess(user), 350);
  };

  const fill = (u: DemoUser) => {
    setUsername(u.username);
    setPassword(u.password);
    setError(null);
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0B101B] px-4 py-10">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${seguimientoBg})` }} />
      <div className="absolute inset-0 bg-[#0B101B]/85 backdrop-blur-[2px]" />

      <div className="relative z-10 w-full max-w-[400px] rounded-3xl bg-white px-7 pb-6 pt-7 shadow-[0_24px_64px_rgba(0,0,0,0.5)]">
        <div className="flex select-none flex-col items-center">
          <img src={mdLogo} alt="MD Logística" className="h-24 w-auto object-contain" />
          <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Plataforma de gestión logística</div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <div className="mb-1.5 text-xs font-extrabold text-[#231F20]">Ingresar como</div>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Rol de demostración">
              {DEMO_USERS.map((u) => {
                const info = ROLE_INFO[u.role];
                const active = selected?.username === u.username;
                return (
                  <button
                    key={u.username}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => fill(u)}
                    className={cx(
                      'flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-extrabold transition',
                      active
                        ? 'border-[#B71E23] bg-[#FEF2F2] text-[#B71E23]'
                        : 'border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-[#231F20]'
                    )}
                  >
                    {info.icon}
                    {info.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 min-h-[2rem] text-[11px] leading-snug text-zinc-500">
              {selected ? ROLE_INFO[selected.role].desc : 'Elegí un rol o ingresá tus datos.'}
            </p>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-extrabold text-[#231F20]">Usuario</span>
              <span className={fieldCls}>
                <User className="h-4 w-4 shrink-0 text-zinc-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingresá tu usuario"
                  className="w-full bg-transparent text-sm font-semibold text-[#231F20] placeholder-zinc-400 focus:outline-none"
                  autoComplete="username"
                  required
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-extrabold text-[#231F20]">Contraseña</span>
              <span className={fieldCls}>
                <Lock className="h-4 w-4 shrink-0 text-zinc-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent text-sm font-semibold text-[#231F20] placeholder-zinc-400 focus:outline-none"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-zinc-400 transition hover:text-[#231F20]"
                  tabIndex={-1}
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#B71E23] py-3 text-sm font-extrabold text-white transition hover:bg-[#96171B] active:scale-[0.99] disabled:opacity-70"
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] text-zinc-400">Demostración con datos simulados</p>
      </div>
    </div>
  );
};
