/**
 * formalQuote.ts — Cotización FORMAL (ciclo 41): un mismo contenido para el PDF, WhatsApp y el correo.
 *
 * El PDF ya no es «imprimir la página» (salían botones, «Editar detalles», el tema oscuro y varias hojas):
 * se genera un documento A4 propio, siempre claro, de UNA página, con encabezado del emisor, número,
 * fechas de emisión y validez, tabla de conceptos, ajustes, total, entrega, forma de pago, alcance,
 * configuración, condiciones y contacto. Se imprime desde un iframe oculto (Guardar como PDF).
 */
export type FormalLang = 'es' | 'en';
export type FormalQuote = {
  lang: FormalLang; id: string; date: Date; validDays: number;
  currency: 'COP' | 'USD';
  main: { name: string; code: string; tier: string; tierLabel: string; min: number; max: number };
  extras: { name: string; code: string; tier: string; min: number; max: number }[];
  adjustments: string[];
  total: { min: number; max: number };
  delivery: [number, number] | null;
  payment: string | null;
  rounds: string;
  includes: string[];
  config: [string, string][];
  url: string;
  issuer: { name: string; role: string; email: string; phone: string; web: string };
};

const money = (q: FormalQuote, n: number) => new Intl.NumberFormat(q.currency === 'COP' ? 'es-CO' : 'en-US', { style: 'currency', currency: q.currency, maximumFractionDigits: 0 }).format(n);
const dateStr = (q: FormalQuote, d: Date) => d.toLocaleDateString(q.lang === 'es' ? 'es-CO' : 'en-US', { day: '2-digit', month: 'long', year: 'numeric' });
/** «$ 400.000» si el rango es un único valor; si no, «$ 400.000 – $ 520.000». */
const rng = (q: FormalQuote, a: number, b: number) => (Math.round(a) === Math.round(b) ? money(q, a) : `${money(q, a)} – ${money(q, b)}`);
const shortUrl = (u: string) => u.replace(/^https?:\/\//, '').replace(/[?#].*$/, '').replace(/\/$/, '');
const validUntil = (q: FormalQuote) => new Date(q.date.getTime() + q.validDays * 86400000);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const phoneFmt = (p: string) => (p.startsWith('57') && p.length === 12 ? `+57 ${p.slice(2, 5)} ${p.slice(5, 8)} ${p.slice(8)}` : `+${p}`);

const T = {
  es: { title: 'Cotización', no: 'N.º', issued: 'Emitida', valid: 'Válida hasta', project: 'Proyecto', concept: 'Concepto', code: 'Código', level: 'Nivel', range: 'Inversión estimada',
    adj: 'Ajustes aplicados', total: 'Total estimado del proyecto', delivery: 'Entrega', days: 'días hábiles', payment: 'Forma de pago', rounds: 'Revisiones', includes: 'Alcance incluido',
    config: 'Configuración', terms: 'Condiciones', market: { COP: 'Contrato nacional (Colombia) · valores en pesos colombianos', USD: 'Contrato internacional · valores en dólares estadounidenses' },
    t1: 'Rango estimado según la configuración indicada; el valor final se confirma en la propuesta formal, tras revisar referencias y archivos.',
    t2: 'Los tiempos se cuentan en días hábiles desde la aprobación y el pago acordado.', t3: 'Los archivos CAD, modelos y materiales del cliente no se publican sin su autorización.',
    online: 'Ver y ajustar esta cotización en línea', contact: 'Contacto', ref: 'ref.',
    accept: 'Aceptación del cliente', sign: 'Nombre y firma', dateL: 'Fecha', issuerSign: 'Emisor' },
  en: { title: 'Quote', no: 'No.', issued: 'Issued', valid: 'Valid until', project: 'Project', concept: 'Item', code: 'Code', level: 'Level', range: 'Estimated investment',
    adj: 'Applied adjustments', total: 'Estimated project total', delivery: 'Delivery', days: 'business days', payment: 'Payment terms', rounds: 'Revisions', includes: 'Included scope',
    config: 'Configuration', terms: 'Terms', market: { COP: 'Domestic contract (Colombia) · amounts in Colombian pesos', USD: 'International contract · amounts in US dollars' },
    t1: 'Estimated range for the stated configuration; the final amount is confirmed in the formal proposal after reviewing references and files.',
    t2: 'Timelines are counted in business days from approval and the agreed payment.', t3: "Client CAD files, models and materials are never published without authorization.",
    online: 'View and adjust this quote online', contact: 'Contact', ref: 'ref.',
    accept: 'Client acceptance', sign: 'Name and signature', dateL: 'Date', issuerSign: 'Issuer' },
};

/** Texto formal para WhatsApp (negritas con *) o correo (sin marcas). */
export function formalText(q: FormalQuote, channel: 'whatsapp' | 'email' = 'whatsapp') {
  const t = T[q.lang], b = (s: string) => (channel === 'whatsapp' ? `*${s}*` : s.toUpperCase());
  const L: string[] = [];
  L.push(`${b(`${t.title} ${t.no} ${q.id}`)} — ${q.issuer.name}`);
  L.push(`${t.issued}: ${dateStr(q, q.date)} · ${t.valid}: ${dateStr(q, validUntil(q))}`);
  L.push('');
  L.push(`${b(t.project)}: ${q.main.name} (${q.main.code}) · ${t.level} ${q.main.tier} — ${q.main.tierLabel}`);
  L.push(`  ${rng(q, q.main.min, q.main.max)}`);
  for (const e of q.extras) L.push(`+ ${e.name} (${e.code}) · ${t.level} ${e.tier}: ${rng(q, e.min, e.max)}`);
  if (q.adjustments.length) L.push(`${t.adj}: ${q.adjustments.join(' · ')}`);
  L.push('');
  L.push(`${b(t.total)}: ${rng(q, q.total.min, q.total.max)} ${q.currency}`);
  L.push(t.market[q.currency]);
  if (q.delivery) L.push(`${t.delivery}: ${q.delivery[0]}–${q.delivery[1]} ${t.days}`);
  if (q.payment) L.push(`${t.payment}: ${q.payment}`);
  L.push(`${t.rounds}: ${q.rounds}`);
  if (q.includes.length) { L.push(''); L.push(`${b(t.includes)}:`); q.includes.forEach((x) => L.push(`• ${x}`)); }
  if (q.config.length) { L.push(''); L.push(`${b(t.config)}:`); q.config.forEach(([k, v]) => L.push(`• ${k}: ${v}`)); }
  L.push(''); L.push(t.t1);
  L.push(`${t.online}: ${q.url}`);
  L.push(''); L.push(`${q.issuer.name} · ${q.issuer.role}`); L.push(`${q.issuer.email} · ${phoneFmt(q.issuer.phone)}`);
  return L.join('\n');
}

/** Documento A4 de una página (siempre claro). */
export function formalHtml(q: FormalQuote) {
  const t = T[q.lang], r2 = (a: number, b: number) => esc(rng(q, a, b));
  const rows = [{ name: q.main.name, code: q.main.code, tier: `${q.main.tier} · ${q.main.tierLabel}`, min: q.main.min, max: q.main.max }, ...q.extras.map((e) => ({ name: e.name, code: e.code, tier: e.tier, min: e.min, max: e.max }))];
  const col2 = (items: string[]) => `<ul class="two">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  return `<!doctype html><html lang="${q.lang}"><head><meta charset="utf-8"><title>${esc(`${t.title}-${q.id}-${q.issuer.name.replace(/\s+/g, '')}`)}</title>
<style>
@page { size: A4; margin: 14mm 15mm 12mm; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; color: #15171c; font: 9.6pt/1.42 "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.doc { width: 100%; display: flex; flex-direction: column; }
@media screen { body { padding: 14mm 15mm 12mm; } .doc { min-height: calc(297mm - 26mm); } }
@media print { .doc { min-height: calc(297mm - 28mm); } }
.end { margin-top: auto; }
.sign { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 0 22px; margin: 22px 0 4px; }
.sign div { border-top: 1px solid #15171c; padding-top: 4px; font-size: 7.6pt; letter-spacing: .1em; text-transform: uppercase; color: #5b6170; height: 34px; }
.sign-h { font-size: 7.6pt; letter-spacing: .16em; text-transform: uppercase; color: #5b6170; font-weight: 600; margin: 18px 0 26px; }
header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 10px; border-bottom: 2px solid #15171c; }
.brand b { display: block; font-size: 17pt; letter-spacing: -.02em; font-weight: 700; }
.brand span { color: #5b6170; font-size: 8.6pt; }
.meta { text-align: right; font-size: 8.6pt; color: #5b6170; }
.meta h1 { margin: 0 0 3px; font-size: 15pt; letter-spacing: .14em; text-transform: uppercase; color: #15171c; }
.meta strong { color: #c4400d; font-weight: 700; }
.accent { height: 3px; width: 64px; background: #c4400d; margin: 10px 0 14px; }
h2 { font-size: 7.6pt; letter-spacing: .16em; text-transform: uppercase; color: #5b6170; margin: 14px 0 6px; font-weight: 600; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 7.6pt; letter-spacing: .1em; text-transform: uppercase; color: #5b6170; font-weight: 600; border-bottom: 1px solid #c9cdd5; padding: 5px 6px; }
td { padding: 7px 6px; border-bottom: 1px solid #e4e7ec; vertical-align: top; }
td.num, th.num { text-align: right; white-space: nowrap; }
.code { color: #5b6170; font-family: "SFMono-Regular", Consolas, monospace; font-size: 8.4pt; }
.adj { color: #5b6170; font-size: 8.6pt; padding: 6px 6px 0; }
.total { display: flex; justify-content: space-between; align-items: baseline; margin-top: 10px; padding: 12px 14px; background: #f4f5f7; border-left: 3px solid #c4400d; }
.total span { font-size: 8pt; letter-spacing: .12em; text-transform: uppercase; color: #5b6170; font-weight: 600; }
.total b { font-size: 15.5pt; letter-spacing: -.01em; }
.total small { display: block; text-align: right; color: #5b6170; font-size: 8pt; margin-top: 2px; }
.facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; margin-top: 12px; border: 1px solid #e4e7ec; }
.facts div { padding: 8px 10px; border-right: 1px solid #e4e7ec; }
.facts div:last-child { border-right: 0; }
.facts span { display: block; font-size: 7.4pt; letter-spacing: .12em; text-transform: uppercase; color: #5b6170; font-weight: 600; margin-bottom: 2px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 22px; }
ul.two { margin: 0; padding: 0; list-style: none; columns: 1; }
ul.two li { padding: 2.5px 0 2.5px 14px; position: relative; }
ul.two li::before { content: ''; position: absolute; left: 0; top: 8px; width: 6px; height: 1.5px; background: #c4400d; }
.terms { font-size: 7.8pt; color: #5b6170; }
.terms p { margin: 0 0 3px; }
footer { margin-top: 14px; padding-top: 9px; border-top: 1px solid #c9cdd5; display: flex; justify-content: space-between; gap: 14px; font-size: 8pt; color: #5b6170; }
footer b { color: #15171c; }
footer a { color: #c4400d; text-decoration: none; }
</style></head><body><div class="doc">
<header><div class="brand"><b>${esc(q.issuer.name)}</b><span>${esc(q.issuer.role)}</span></div>
<div class="meta"><h1>${t.title}</h1>${t.no} <strong>${esc(q.id)}</strong><br>${t.issued}: ${esc(dateStr(q, q.date))}<br>${t.valid}: ${esc(dateStr(q, validUntil(q)))}</div></header>
<div class="accent"></div>
<h2>${t.project}</h2>
<table><thead><tr><th>${t.concept}</th><th>${t.code}</th><th>${t.level}</th><th class="num">${t.range}</th></tr></thead><tbody>
${rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="code">${esc(r.code)}</td><td>${esc(r.tier)}</td><td class="num">${r2(r.min, r.max)}</td></tr>`).join('')}
</tbody></table>
${q.adjustments.length ? `<div class="adj">${t.adj}: ${esc(q.adjustments.join(' · '))}</div>` : ''}
<div class="total"><span>${t.total}</span><div><b>${r2(q.total.min, q.total.max)}</b><small>${esc(t.market[q.currency])}</small></div></div>
<div class="facts"><div><span>${t.delivery}</span>${q.delivery ? `${q.delivery[0]}–${q.delivery[1]} ${t.days}` : '—'}</div><div><span>${t.payment}</span>${esc(q.payment ?? '—')}</div><div><span>${t.rounds}</span>${esc(q.rounds)}</div></div>
<div class="grid2">
  <div><h2>${t.includes}</h2>${col2(q.includes.length ? q.includes : ['—'])}</div>
  <div><h2>${t.config}</h2>${col2(q.config.length ? q.config.map(([k, v]) => `${k}: ${v}`) : ['—'])}</div>
</div>
<h2>${t.terms}</h2><div class="terms"><p>${t.t1}</p><p>${t.t2}</p><p>${t.t3}</p></div>
<div class="end"><div class="sign-h">${t.accept}</div>
<div class="sign"><div>${t.sign}</div><div>${t.dateL}</div><div>${t.issuerSign} · ${esc(q.issuer.name)}</div></div>
<footer><div><b>${t.contact}</b><br>${esc(q.issuer.email)} · ${esc(phoneFmt(q.issuer.phone))}<br>${esc(q.issuer.web)}</div><div style="text-align:right">${t.online}<br><a href="${esc(q.url)}">${esc(shortUrl(q.url))}</a> · ${t.ref} ${esc(q.id)}</div></footer></div>
</div></body></html>`;
}

/** Imprime la cotización formal desde un iframe oculto (el diálogo permite «Guardar como PDF»). */
export function printFormal(q: FormalQuote) {
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(f);
  const d = f.contentDocument; if (!d) { f.remove(); return; }
  d.open(); d.write(formalHtml(q)); d.close();
  let done = false;
  const go = () => { if (done) return; done = true; try { f.contentWindow?.focus(); f.contentWindow?.print(); } finally { setTimeout(() => f.remove(), 2000); } };
  f.onload = go; setTimeout(go, 400);
}
