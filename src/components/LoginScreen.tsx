import React, { useState } from 'react';
import { AlertCircle, Building2, Eye, EyeOff, Landmark, LayoutDashboard, Lock, Smartphone, User } from 'lucide-react';
import mdLogo from '../../logo/logo.png';
import seguimientoBg from '../../imagenes/seguimiento.jpg';
import { DemoUser } from '../types';
import { DEMO_USERS } from '../data/seed';
import { cx } from './ui';

interface LoginScreenProps {
  onLoginSuccess: (user: DemoUser) => void;
}

const ROLE_INFO: Record<DemoUser['role'], { label: string; icon: React.ReactNode; desc: string }> = {
  admin: { label: 'Administración', icon: <LayoutDashboard className="h-4 w-4" />, desc: 'Acceso completo a los 4 paneles' },
  finance: { label: 'Finanzas', icon: <Landmark className="h-4 w-4" />, desc: 'Facturación, cobranzas y rentabilidad' },
  driver: { label: 'Chofer', icon: <Smartphone className="h-4 w-4" />, desc: 'App del chofer de la unidad MD-104' },
  client: { label: 'Cliente', icon: <Building2 className="h-4 w-4" />, desc: 'Portal de Arcor S.A.I.C.' },
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('administracion');
  const [password, setPassword] = useState('mdlogistica2026');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const user = DEMO_USERS.find((u) => u.username === username.trim().toLowerCase());
    if (!user || user.password !== password) {
      setError('Usuario o contraseña incorrectos.');
      return;
    }
    setLoading(true);
    setTimeout(() => onLoginSuccess(user), 450);
  };

  const fill = (u: DemoUser) => {
    setUsername(u.username);
    setPassword(u.password);
    setError(null);
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0B101B] px-4 py-10">
      <div
        className="absolute inset-0 scale-[1.02] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${seguimientoBg})` }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, rgba(11,16,27,0.45) 0%, rgba(9,13,22,0.82) 100%)',
        }}
      />

      <div className="relative z-10 grid w-full max-w-[860px] gap-4 md:grid-cols-[400px_1fr]">
        <div className="rounded-3xl border border-white/60 bg-white/85 px-7 pb-6 pt-7 shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="mb-5 flex select-none flex-col items-center">
            <img src={mdLogo} alt="MD Logística" className="h-28 w-auto object-contain sm:h-32" />
            <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
              Plataforma de gestión logística
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="md-user" className="mb-1.5 block text-xs font-extrabold tracking-wide text-[#231F20]">
                Usuario
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-zinc-300/80 bg-white px-3.5 py-3 shadow-sm focus-within:border-[#B71E23] focus-within:ring-2 focus-within:ring-[#B71E23]/20">
                <User className="h-4 w-4 shrink-0 text-zinc-500" />
                <input
                  id="md-user"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingresá tu usuario"
                  className="w-full bg-transparent text-sm font-semibold text-[#231F20] placeholder-zinc-400 focus:outline-none"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="md-pass" className="mb-1.5 block text-xs font-extrabold tracking-wide text-[#231F20]">
                Contraseña
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-zinc-300/80 bg-white px-3.5 py-3 shadow-sm focus-within:border-[#B71E23] focus-within:ring-2 focus-within:ring-[#B71E23]/20">
                <Lock className="h-4 w-4 shrink-0 text-zinc-500" />
                <input
                  id="md-pass"
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
                  className="text-zinc-500 transition hover:text-[#231F20]"
                  tabIndex={-1}
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
              className="w-full rounded-xl bg-gradient-to-r from-[#B71E23] via-[#CE2329] to-[#F2851D] py-3 text-sm font-extrabold text-white shadow-lg shadow-[#B71E23]/30 transition hover:brightness-105 active:scale-[0.99] disabled:opacity-70"
            >
              {loading ? 'Ingresando…' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] font-medium leading-relaxed text-zinc-600">
            Si olvidaste tu contraseña, solicitá al administrador que te otorgue una nueva.
          </p>
        </div>

        <div className="rounded-3xl border border-white/15 bg-[#11161F]/85 p-5 text-white shadow-2xl backdrop-blur-xl">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F2851D]">Accesos de demostración</div>
          <p className="mt-1 text-xs text-zinc-400">
            Cada usuario ve solo lo que le corresponde según su rol. Tocá uno para completar los datos.
          </p>
          <p className="mt-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-zinc-300">
            Prototipo con datos simulados para mostrar el funcionamiento de la plataforma.
          </p>
          <div className="mt-4 space-y-2">
            {DEMO_USERS.map((u) => {
              const info = ROLE_INFO[u.role];
              const active = username === u.username;
              return (
                <button
                  key={u.username}
                  type="button"
                  onClick={() => fill(u)}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition',
                    active ? 'border-[#F2851D] bg-[#B71E23]/25' : 'border-white/10 bg-white/5 hover:border-white/30'
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#B71E23] text-white">
                    {info.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold">{info.label}</span>
                    <span className="block truncate text-[11px] text-zinc-400">{info.desc}</span>
                  </span>
                  <span className="hidden text-right font-mono text-[10px] text-zinc-400 sm:block">
                    {u.username}
                    <br />
                    {u.password}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
