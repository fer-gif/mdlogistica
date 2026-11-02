/** Tipo de cambio de referencia usado en la demo (ARS por USD). */
export const USD_ARS_RATE = 1180;

export const AVG_TRUCK_SPEED_KMH = 72;

export function usd(n: number, decimals = 0): string {
  return `USD ${n.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function ars(n: number): string {
  return `$ ${Math.round(n).toLocaleString('es-AR')}`;
}

export function num(n: number, decimals = 0): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function hhmm(ts: number): string {
  return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function isSameDay(a: number, b: number) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

/** "Hoy 14:32", "Ayer 09:10" o "12/10 18:00". */
export function when(ts: number): string {
  const now = Date.now();
  if (isSameDay(ts, now)) return `Hoy ${hhmm(ts)}`;
  if (isSameDay(ts, now - 86400000)) return `Ayer ${hhmm(ts)}`;
  if (isSameDay(ts, now + 86400000)) return `Mañana ${hhmm(ts)}`;
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${hhmm(ts)}`;
}

export function dateShort(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function durationHours(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`;
}

/** ETA en hora real según km restantes a velocidad comercial promedio de un camión. */
export function etaFromKm(remainingKm: number): { ts: number; hours: number } {
  const hours = Math.max(0, remainingKm) / AVG_TRUCK_SPEED_KMH;
  return { ts: Date.now() + hours * 3600000, hours };
}

/** Meses hasta el vencimiento de una fecha MM/AAAA (negativo = vencido). */
export function monthsUntil(mmYYYY: string): number {
  const [mm, yyyy] = mmYYYY.split('/').map(Number);
  if (!mm || !yyyy) return 99;
  const now = new Date();
  return (yyyy - now.getFullYear()) * 12 + (mm - (now.getMonth() + 1));
}

export function expiryState(mmYYYY: string): 'ok' | 'soon' | 'expired' {
  const m = monthsUntil(mmYYYY);
  if (m < 0) return 'expired';
  if (m <= 1) return 'soon';
  return 'ok';
}

export function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? '');
          return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(';')
    )
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reduce una imagen a JPEG liviano para guardarla en el navegador. */
export function compressImage(file: File, maxSize = 720, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagen inválida'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas no disponible'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
