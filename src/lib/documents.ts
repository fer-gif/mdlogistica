import { ClientAccount, RouteCorridor, Trip, TruckUnit, DriverProfile } from '../types';
import { dateShort, hhmm, usd, USD_ARS_RATE, ars } from './format';
import mdLogo from '../../logo/logo.png';

export type TripDocKey = 'carta_porte' | 'hoja_ruta' | 'crt' | 'mic_dta' | 'remito' | 'factura';

export interface TripDoc {
  key: TripDocKey;
  label: string;
  short: string;
  code: string;
  available: boolean;
  pendingNote: string;
}

export interface DocContext {
  trip: Trip;
  corridor?: RouteCorridor;
  client?: ClientAccount;
  truck?: TruckUnit;
  driver?: DriverProfile;
}

/** Legajo documental del viaje, derivado de su estado (nunca queda desincronizado). */
export function tripDocuments({ trip, corridor, client }: DocContext): TripDoc[] {
  const num = trip.code.replace('VIA-', '');
  const assigned = trip.stage !== 'pending_assignment';
  const docs: TripDoc[] = [
    {
      key: 'carta_porte',
      label: 'Carta de Porte',
      short: 'Carta de Porte',
      code: trip.cartaPorteNumber,
      available: true,
      pendingNote: '',
    },
    {
      key: 'hoja_ruta',
      label: 'Hoja de Ruta Digital',
      short: 'Hoja de Ruta',
      code: `HR-${num}-MD`,
      available: assigned,
      pendingNote: 'Se genera al asignar unidad',
    },
  ];
  if (corridor?.international) {
    docs.push(
      {
        key: 'crt',
        label: 'CRT · Conocimiento de Transporte Internacional',
        short: 'CRT',
        code: `AR.0471.${num}`,
        available: assigned,
        pendingNote: 'Se genera al asignar unidad',
      },
      {
        key: 'mic_dta',
        label: 'MIC/DTA · Manifiesto Internacional de Carga',
        short: 'MIC/DTA',
        code: `26AR0471${num}M`,
        available: assigned,
        pendingNote: 'Se genera al asignar unidad',
      }
    );
  }
  docs.push({
    key: 'remito',
    label: 'Remito Conformado (POD)',
    short: 'Remito',
    code: trip.delivery?.remitoNumber ?? 'Pendiente',
    available: Boolean(trip.delivery),
    pendingNote: 'Se sube al entregar',
  });
  const isBr = client?.country === 'BR';
  docs.push({
    key: 'factura',
    label: isBr ? 'CT-e · Conhecimento de Transporte Eletrônico' : 'Factura Electrónica',
    short: isBr ? 'CT-e' : 'Factura',
    code: trip.invoice?.number ?? 'Pendiente',
    available: Boolean(trip.invoice),
    pendingNote: 'Se emite al facturar',
  });
  return docs;
}

const esc = (s: string | number | undefined) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function row(label: string, value: string | number | undefined) {
  return `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`;
}

export function printTripDocument(key: TripDocKey, ctx: DocContext) {
  const { trip, corridor, client, truck, driver } = ctx;
  const docs = tripDocuments(ctx);
  const doc = docs.find((d) => d.key === key);
  if (!doc) return;

  const logoUrl = new URL(mdLogo, window.location.href).href;
  const issued = trip.invoice?.issuedAt ?? trip.delivery?.signedAt ?? trip.acceptedAt ?? trip.createdAt;

  const parties = `
    <div class="grid">
      <div class="box"><h3>Transportista</h3>
        <p><b>MD Logística S.R.L.</b><br/>CUIT 30-71234567-8 · Permiso Internacional 0471<br/>RN 117 · Paso de los Libres, Corrientes</p></div>
      <div class="box"><h3>${key === 'factura' ? 'Cliente' : 'Dador de carga'}</h3>
        <p><b>${esc(client?.name)}</b><br/>${esc(client?.taxId)}<br/>${esc(client?.contactName)}</p></div>
    </div>`;

  const tripTable = `
    <table>
      ${row('Viaje', trip.code)}
      ${row('Origen', corridor?.origin)}
      ${row('Destino', corridor?.destination)}
      ${row('Recorrido', corridor ? `${corridor.name} · ${corridor.totalKm} km` : '')}
      ${row('Mercadería', trip.cargoDescription)}
      ${row('Modalidad', trip.modality)}
      ${row('Peso / Bultos', `${trip.weightTons} tn · ${trip.palletsCount} pallets`)}
      ${truck ? row('Unidad', `${truck.code} · ${truck.brand} ${truck.model} · Tractor ${truck.tractorPlate} / Semi ${truck.trailerPlate}`) : ''}
      ${driver ? row('Chofer', `${driver.name} · DNI ${driver.dni}`) : ''}
      ${truck && trip.stage !== 'pending_assignment' ? row('Precinto', truck.cargoSeal) : ''}
    </table>`;

  let body = '';
  if (key === 'factura' && trip.invoice) {
    const inv = trip.invoice;
    const isCte = inv.kind === 'CTE';
    const net = isCte ? inv.amountUsd : inv.amountUsd / 1.21;
    const iva = isCte ? 0 : inv.amountUsd - net;
    body = `
      ${parties}
      <table>
        ${row(isCte ? 'Número CT-e' : 'Comprobante', inv.number)}
        ${row('Fecha de emisión', `${dateShort(inv.issuedAt)} ${hhmm(inv.issuedAt)}`)}
        ${row('Vencimiento', dateShort(inv.dueAt))}
        ${row('Concepto', `Servicio de transporte ${trip.code} · ${corridor?.origin} → ${corridor?.destination}`)}
      </table>
      <table class="totals">
        ${isCte ? '' : row('Importe neto gravado', usd(net, 2))}
        ${isCte ? '' : row('IVA 21%', usd(iva, 2))}
        ${row('Total', usd(inv.amountUsd, 2))}
        ${row('Equivalente referencia', `${ars(inv.amountUsd * USD_ARS_RATE)} (TC ${USD_ARS_RATE})`)}
      </table>
      <div class="auth"><b>${isCte ? 'Chave de acesso SEFAZ' : 'CAE ARCA/AFIP'}:</b> ${esc(inv.authCode)}<br/>
      ${isCte ? 'Autorizado o uso do CT-e · Protocolo SEFAZ-RS' : `Vto. CAE: ${dateShort(inv.issuedAt + 10 * 86400000)}`}</div>`;
  } else if (key === 'remito' && trip.delivery) {
    const d = trip.delivery;
    body = `
      ${parties}
      ${tripTable}
      <table>
        ${row('Remito', d.remitoNumber)}
        ${row('Recibido por', `${d.receiverName} · DNI ${d.receiverDni}`)}
        ${row('Fecha y hora de conformidad', `${dateShort(d.signedAt)} ${hhmm(d.signedAt)}`)}
      </table>
      ${d.photoDataUrl ? `<div class="photo"><h3>Foto del remito firmado (App del Chofer)</h3><img src="${d.photoDataUrl}"/></div>` : '<div class="sign">Firma y sello de recepción registrados digitalmente desde la App del Chofer.</div>'}`;
  } else if (key === 'mic_dta' || key === 'crt') {
    body = `
      ${parties}
      ${tripTable}
      <table>
        ${row(key === 'crt' ? 'N° CRT' : 'N° MIC/DTA', doc.code)}
        ${row('Aduana de partida', 'Paso de los Libres (AR) · 041')}
        ${row('Aduana de destino', 'Uruguaiana (BR) · 1017700')}
        ${row('País de destino', 'Brasil')}
        ${row('Ruta / Paso fronterizo', 'Puente Internacional Agustín P. Justo – Getúlio Vargas')}
      </table>
      <div class="sign">Documento emitido según Acuerdo sobre Transporte Internacional Terrestre (ATIT) · MERCOSUR.</div>`;
  } else {
    body = `
      ${parties}
      ${tripTable}
      <table>
        ${row(key === 'hoja_ruta' ? 'Hoja de ruta' : 'Carta de porte', doc.code)}
        ${row('Fecha', `${dateShort(issued)} ${hhmm(issued)}`)}
        ${key === 'hoja_ruta' && corridor ? row('Puntos de control', corridor.checkpoints.map((c) => `${c.label} (km ${c.km})`).join(' → ')) : ''}
      </table>`;
  }

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<title>${esc(doc.label)} ${esc(doc.code)}</title>
<style>
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#231F20;margin:0;padding:32px;background:#f4f4f5}
  .page{max-width:780px;margin:0 auto;background:#fff;padding:36px 40px;border:1px solid #e4e4e7}
  header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #B71E23;padding-bottom:14px;margin-bottom:20px}
  header img{height:58px} header .t{text-align:right} header h1{margin:0;font-size:18px} header .code{font-family:monospace;font-size:14px;color:#B71E23;font-weight:bold}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
  .box{border:1px solid #e4e4e7;border-radius:8px;padding:10px 12px} .box h3,.photo h3{margin:0 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#71717a} .box p{margin:0;font-size:13px;line-height:1.5}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px} th{text-align:left;width:34%;color:#52525b;font-weight:600;padding:7px 8px;border-bottom:1px solid #f0f0f0;background:#fafafa} td{padding:7px 8px;border-bottom:1px solid #f0f0f0}
  .totals td{font-family:monospace;font-weight:bold;text-align:right}
  .auth{border:1px dashed #B71E23;border-radius:8px;padding:10px 12px;font-family:monospace;font-size:12px;background:#FEF2F2}
  .sign{font-size:12px;color:#52525b;border-top:1px solid #e4e4e7;padding-top:10px}
  .photo img{max-width:100%;max-height:360px;border:1px solid #e4e4e7;border-radius:6px;margin-top:6px}
  footer{margin-top:22px;font-size:10px;color:#a1a1aa;text-align:center}
  .bar{max-width:780px;margin:0 auto 12px;display:flex;justify-content:flex-end;gap:8px}
  .bar button{background:#B71E23;color:#fff;border:0;border-radius:8px;padding:9px 16px;font-weight:bold;cursor:pointer}
  @media print{body{background:#fff;padding:0}.page{border:0}.bar{display:none}}
</style></head><body>
<div class="bar"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>
<div class="page">
  <header><img src="${logoUrl}" alt="MD Logística"/><div class="t"><h1>${esc(doc.label)}</h1><div class="code">${esc(doc.code)}</div></div></header>
  ${body}
  <footer>Documento generado por la Plataforma MD Logística · Demostración comercial · ${dateShort(Date.now())}</footer>
</div></body></html>`;

  const w = window.open('', '_blank');
  if (!w) {
    alert('El navegador bloqueó la ventana emergente. Habilitá las ventanas emergentes para ver el documento.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
