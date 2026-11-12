import React, { useState } from 'react';
import { Building2, ExternalLink, Mail, Phone, Plus } from 'lucide-react';
import { ClientAccount } from '../../types';
import { useDemo } from '../../state/DemoContext';
import { invoiceStatus } from '../../state/store';
import { usd } from '../../lib/format';
import { Button, cx, Detail, ExpandableRow, Field, inputCls, Modal } from '../ui';
import type { AdminTabProps } from '../AdminPanel';

export const ClientsTab: React.FC<AdminTabProps> = ({ onPreviewClient, onNavigatePanel, goTab }) => {
  const { state } = useDemo();
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">
          {state.clients.length} clientes · datos fiscales, tarifas, viajes y saldo de cada uno.
        </p>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Nuevo cliente
        </Button>
      </div>

      <div className="space-y-2">
        {state.clients.map((c) => {
          const trips = state.trips.filter((t) => t.clientId === c.id);
          const active = trips.filter((t) => t.stage !== 'delivered' && t.stage !== 'pending_assignment').length;
          const pending = trips.filter((t) => t.stage === 'pending_assignment').length;
          const delivered = trips.filter((t) => t.stage === 'delivered').length;
          const invoiced = trips.reduce((s, t) => s + (t.invoice?.amountUsd ?? 0), 0);
          const owed = trips
            .filter((t) => ['emitida', 'vencida'].includes(invoiceStatus(t)))
            .reduce((s, t) => s + (t.invoice?.amountUsd ?? 0), 0);
          const overdue = trips.filter((t) => invoiceStatus(t) === 'vencida').reduce((s, t) => s + (t.invoice?.amountUsd ?? 0), 0);
          return (
            <ExpandableRow
              key={c.id}
              open={openId === c.id}
              onToggle={() => setOpenId(openId === c.id ? null : c.id)}
              summary={
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <div className="flex w-56 min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FEF2F2] text-[#B71E23]">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold">{c.name}</span>
                      <span className="block truncate font-mono text-[10px] text-zinc-500">
                        {c.taxId} · {c.country === 'AR' ? 'AR' : 'BR'}
                      </span>
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-bold text-zinc-700">{active} en curso</span>
                    {pending > 0 && (
                      <span className="rounded-full bg-[#FFF7ED] px-2 py-0.5 font-bold text-[#C25E08]">{pending} por asignar</span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-extrabold">{usd(owed)}</div>
                    <div className={cx('text-[10px] font-semibold', overdue > 0 ? 'text-red-600' : 'text-zinc-400')}>
                      {overdue > 0 ? `${usd(overdue)} vencido` : 'saldo a cobrar'}
                    </div>
                  </div>
                </div>
              }
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Detail label="Contacto" value={c.contactName} />
                  <Detail
                    label="Email"
                    value={
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {c.email}
                      </span>
                    }
                  />
                  <Detail
                    label="Teléfono"
                    value={
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </span>
                    }
                  />
                  <Detail label="País" value={c.country === 'AR' ? 'Argentina · Factura ARCA' : 'Brasil · CT-e SEFAZ'} />
                  <Detail label="Tarifa preferencial" value={`USD ${c.ratePerKmUsd.toFixed(2)} / km`} />
                  <Detail label="Condición de pago" value={`${c.paymentTermsDays} días`} />
                  <Detail label="Viajes entregados" value={delivered} />
                  <Detail label="Facturado histórico" value={usd(invoiced)} />
                </div>
                <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 pt-3">
                  {pending > 0 && (
                    <Button size="sm" variant="secondary" onClick={() => goTab('trips')}>
                      Asignar sus viajes
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      onPreviewClient(c.id);
                      onNavigatePanel('client');
                    }}
                  >
                    Ver su portal <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </ExpandableRow>
          );
        })}
      </div>

      <NewClientModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
};

function NewClientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useDemo();
  const empty: Omit<ClientAccount, 'id'> = {
    name: '',
    taxId: 'CUIT ',
    country: 'AR',
    contactName: '',
    email: '',
    phone: '+54 9 ',
    ratePerKmUsd: 3.5,
    paymentTermsDays: 30,
  };
  const [f, setF] = useState(empty);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    dispatch({ type: 'CREATE_CLIENT', client: { ...f, name: f.name.trim() } });
    setF(empty);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Módulo de clientes"
      title="Alta de cliente dador de carga"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="new-client-form">
            Guardar cliente
          </Button>
        </>
      }
    >
      <form id="new-client-form" onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Razón social" className="sm:col-span-2">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} required />
        </Field>
        <Field label="País">
          <select
            value={f.country}
            onChange={(e) => {
              const country = e.target.value as 'AR' | 'BR';
              setF({ ...f, country, taxId: country === 'AR' ? 'CUIT ' : 'CNPJ ' });
            }}
            className={inputCls}
          >
            <option value="AR">Argentina (Factura ARCA)</option>
            <option value="BR">Brasil (CT-e SEFAZ)</option>
          </select>
        </Field>
        <Field label={f.country === 'AR' ? 'CUIT' : 'CNPJ'}>
          <input value={f.taxId} onChange={(e) => setF({ ...f, taxId: e.target.value })} className={inputCls} required />
        </Field>
        <Field label="Contacto">
          <input value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} className={inputCls} placeholder="Nombre · Área" />
        </Field>
        <Field label="Email">
          <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Teléfono">
          <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tarifa USD/km">
            <input
              type="number"
              step="0.05"
              value={f.ratePerKmUsd}
              onChange={(e) => setF({ ...f, ratePerKmUsd: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
          <Field label="Plazo de pago (días)">
            <input
              type="number"
              value={f.paymentTermsDays}
              onChange={(e) => setF({ ...f, paymentTermsDays: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
