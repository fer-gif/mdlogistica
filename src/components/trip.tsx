import React from 'react';
import { FileText, Printer } from 'lucide-react';
import { Trip } from '../types';
import { when } from '../lib/format';
import { DocContext, printTripDocument, tripDocuments } from '../lib/documents';

export const shortPlace = (s?: string) => s?.split(',')[0] ?? '';

/** Últimos eventos del viaje, del más reciente al más viejo. */
export function TripTimeline({ trip, limit = 4, title = 'Últimas novedades' }: { trip: Trip; limit?: number; title?: string }) {
  if (trip.timeline.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{title}</div>
      <ol className="space-y-1.5">
        {[...trip.timeline]
          .sort((a, b) => b.at - a.at)
          .slice(0, limit)
          .map((ev) => (
            <li key={ev.id} className="flex gap-2 text-xs">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#B71E23]" />
              <span className="min-w-0">
                <span className="font-bold">{ev.title}</span>{' '}
                <span className="font-mono text-[10px] text-zinc-400">{when(ev.at)}</span>
                <span className="block truncate text-[11px] text-zinc-500">{ev.detail}</span>
              </span>
            </li>
          ))}
      </ol>
    </div>
  );
}

/** Documentos imprimibles disponibles para el viaje. */
export function TripDocButtons({ ctx, emptyText = 'La documentación se genera al asignar la unidad.' }: { ctx: DocContext; emptyText?: string }) {
  const docs = tripDocuments(ctx).filter((d) => d.available);
  return (
    <div className="flex flex-wrap gap-1.5">
      {docs.length === 0 && <span className="text-[11px] text-zinc-400">{emptyText}</span>}
      {docs.map((d) => (
        <button
          key={d.key}
          type="button"
          onClick={() => printTripDocument(d.key, ctx)}
          title={`${d.label} · ${d.code}`}
          className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-[11px] font-bold hover:border-[#B71E23] hover:text-[#B71E23]"
        >
          {d.key === 'factura' ? <FileText className="h-3 w-3" /> : <Printer className="h-3 w-3" />} {d.short}
        </button>
      ))}
    </div>
  );
}
