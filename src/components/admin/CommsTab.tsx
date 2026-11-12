import React, { useMemo, useState } from 'react';
import { CheckCheck, Clock, Megaphone, Send, Zap } from 'lucide-react';
import { useDemo } from '../../state/DemoContext';
import { driverNameOf } from '../../state/store';
import { when } from '../../lib/format';
import { Button, Card, Collapsible, cx, Field, inputCls, SectionHeader, useShowMore } from '../ui';
import type { AdminTabProps } from '../AdminPanel';

const RULES = [
  { id: 'r1', event: 'Unidad asignada al viaje', to: 'Chofer + Cliente', channel: 'App + Portal + email' },
  { id: 'r2', event: 'Ingreso / salida de aduana', to: 'Admin + Cliente', channel: 'Portal + push' },
  { id: 'r3', event: 'Unidad a menos de 60 km de destino', to: 'Cliente', channel: 'Portal + WhatsApp' },
  { id: 'r4', event: 'Arribo a destino y remito conformado', to: 'Admin + Cliente + Finanzas', channel: 'Panel + email' },
  { id: 'r5', event: 'Licencia, VTV o seguro por vencer (30 días)', to: 'Chofer + Admin', channel: 'App + email' },
  { id: 'r6', event: 'Factura vencida sin cobrar', to: 'Finanzas', channel: 'Panel + email' },
];

export const CommsTab: React.FC<AdminTabProps> = () => {
  const { state, dispatch } = useDemo();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [everyone, setEveryone] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [rules, setRules] = useState<Record<string, boolean>>(() => Object.fromEntries(RULES.map((r) => [r.id, true])));
  const [channelFilter, setChannelFilter] = useState('todos');

  const channels = useMemo(
    () => Array.from(new Set(state.notifications.map((n) => n.channelBadge.split('→')[0].trim()))),
    [state.notifications]
  );
  const log = state.notifications.filter((n) => channelFilter === 'todos' || n.channelBadge.startsWith(channelFilter));
  const logList = useShowMore(log, 8);
  const sentList = useShowMore(state.messages, 3);
  const activeRules = Object.values(rules).filter(Boolean).length;

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    if (!everyone && selected.length === 0) return;
    dispatch({ type: 'SEND_MESSAGE', title: title.trim(), body: body.trim(), truckIds: everyone ? [] : selected });
    setTitle('');
    setBody('');
    setSelected([]);
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-5">
        <Card className="p-5">
          <SectionHeader
            icon={<Megaphone className="h-4 w-4 text-[#B71E23]" />}
            title="Comunicado a la flota"
            subtitle="Llega como notificación a la App del Chofer y queda registrado quién lo leyó."
          />
          <form onSubmit={send} className="mt-4 space-y-3">
            <Field label="Asunto">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Ej.: Corte en RN 14 km 420" required />
            </Field>
            <Field label="Mensaje">
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className={inputCls} required />
            </Field>
            <div>
              <div className="mb-1 text-[11px] font-bold text-zinc-600">Destinatarios</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEveryone(true)}
                  className={cx('rounded-lg border px-3 py-1.5 text-xs font-bold', everyone ? 'border-[#B71E23] bg-[#FEF2F2] text-[#B71E23]' : 'border-zinc-200')}
                >
                  Toda la flota
                </button>
                <button
                  type="button"
                  onClick={() => setEveryone(false)}
                  className={cx('rounded-lg border px-3 py-1.5 text-xs font-bold', !everyone ? 'border-[#B71E23] bg-[#FEF2F2] text-[#B71E23]' : 'border-zinc-200')}
                >
                  Selección
                </button>
              </div>
              {!everyone && (
                <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {state.trucks.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px]">
                      <input
                        type="checkbox"
                        className="accent-[#B71E23]"
                        checked={selected.includes(t.id)}
                        onChange={() => setSelected((s) => (s.includes(t.id) ? s.filter((x) => x !== t.id) : [...s, t.id]))}
                      />
                      <span className="truncate font-semibold">
                        {t.code} · {driverNameOf(state, t)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={!everyone && selected.length === 0}>
              <Send className="h-3.5 w-3.5" /> Enviar comunicado
            </Button>
          </form>
        </Card>

        <Collapsible
          icon={<Zap className="h-4 w-4 text-[#F2851D]" />}
          title="Avisos automáticos"
          aside={`${activeRules} de ${RULES.length} activos`}
        >
          <p className="mb-2 text-[11px] text-zinc-500">Qué avisa el sistema, a quién y por qué canal.</p>
          <div className="space-y-2">
            {RULES.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3 py-2.5">
                <div className="min-w-0 text-xs">
                  <div className="font-bold">{r.event}</div>
                  <div className="text-[11px] text-zinc-500">
                    {r.to} · {r.channel}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={rules[r.id]}
                  onClick={() => setRules((p) => ({ ...p, [r.id]: !p[r.id] }))}
                  className={cx('relative h-5 w-9 shrink-0 rounded-full transition', rules[r.id] ? 'bg-emerald-500' : 'bg-zinc-300')}
                >
                  <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', rules[r.id] ? 'left-[18px]' : 'left-0.5')} />
                </button>
              </div>
            ))}
          </div>
        </Collapsible>
      </div>

      <div className="space-y-4 lg:col-span-7">
        <Card className="p-5">
          <div className="mb-3 text-xs font-extrabold uppercase tracking-wider text-zinc-500">Comunicados enviados</div>
          <div className="space-y-2">
            {sentList.visible.map((m) => {
              const recipients = m.truckIds.length ? m.truckIds : state.trucks.map((t) => t.id);
              const read = recipients.filter((id) => m.readBy.includes(id)).length;
              return (
                <div key={m.id} className="rounded-xl border border-zinc-200 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">{m.title}</span>
                    <span className="font-mono text-[10px] text-zinc-400">{when(m.at)}</span>
                  </div>
                  <p className="mt-1 text-zinc-600">{m.body}</p>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500">
                    <CheckCheck className={cx('h-3.5 w-3.5', read === recipients.length ? 'text-emerald-600' : 'text-zinc-400')} />
                    Leído por {read} de {recipients.length} · {m.truckIds.length ? 'selección' : 'toda la flota'}
                  </div>
                </div>
              );
            })}
          </div>
          {sentList.toggle}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">Registro de avisos ({log.length})</div>
            <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="rounded-lg border border-zinc-200 px-2 py-1 text-xs">
              <option value="todos">Todos los orígenes</option>
              {channels.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="divide-y divide-zinc-100">
            {logList.visible.map((n) => (
              <div key={n.id} className="py-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{n.title}</span>
                  <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-zinc-400">
                    <Clock className="h-3 w-3" /> {when(n.at)}
                  </span>
                </div>
                <div className="text-zinc-500">{n.detail}</div>
                <div className="mt-0.5 text-[10px] font-bold text-[#B71E23]">{n.channelBadge}</div>
              </div>
            ))}
          </div>
          {logList.toggle}
        </Card>
      </div>
    </div>
  );
};
