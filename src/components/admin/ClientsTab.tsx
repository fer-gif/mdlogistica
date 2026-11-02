import React, { useState } from 'react';
import { Building2, ExternalLink, Mail, Phone, Plus } from 'lucide-react';
import { ClientAccount } from '../../types';
import { useDemo } from '../../state/DemoContext';
import { invoiceStatus } from '../../state/store';
import { usd } from '../../lib/format';
import { Button, Card, Field, inputCls, Modal, SectionHeader } from '../ui';
import type { AdminTabProps } from '../AdminPanel';

export const ClientsTab: React.FC<AdminTabProps> = ({ onPreviewClient, onNavigatePanel }) => {
  const { state } = useDemo();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <SectionHeader
          title="Módulo de clientes"
          subtitle="Datos comerciales y fiscales, contactos, tarifas preferenciales, historial de viajes y estado de cuenta en un solo perfil."
          actions={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Nuevo cliente
            </Button>
          }
        />
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
            <Card key={c.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FEF2F2] text-[#B71E23]">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-extrabold">{c.name}</div>
                    <div className="font-mono text-[11px] text-zinc-500">{c.taxId}</div>
                  </div>
                </div>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600">
                  {c.country === 'AR' ? 'Argentina' : 'Brasil'}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-xs text-zinc-600">
                <div className="font-semibold text-[#231F20]">{c.contactName}</div>
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3" /> {c.email}
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3" /> {c.phone}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Mini label="En curso" value={active} />
                <Mini label="Pendientes" value={pending} />
                <Mini label="Entregados" value={delivered} />
              </div>
              <div className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-xs">
                <Row label="Tarifa preferencial" value={`USD ${c.ratePerKmUsd.toFixed(2)} / km`} />
                <Row label="Condición de pago" value={`${c.paymentTermsDays} días`} />
                <Row label="Facturado histórico" value={usd(invoiced)} />
                <Row label="Saldo a cobrar" value={usd(owed)} strong />
                {overdue > 0 && <Row label="Vencido" value={usd(overdue)} danger />}
              </div>
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => {
                  onPreviewClient(c.id);
                  onNavigatePanel('client');
                }}
              >
                Ver su portal <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Card>
          );
        })}
      </div>

      <NewClientModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
};

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-zinc-50 py-2">
      <div className="text-lg font-extrabold leading-none">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase text-zinc-400">{label}</div>
    </div>
  );
}

function Row({ label, value, strong, danger }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className={danger ? 'font-mono font-bold text-red-600' : strong ? 'font-mono font-extrabold' : 'font-mono font-semibold'}>
        {value}
      </span>
    </div>
  );
}

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
