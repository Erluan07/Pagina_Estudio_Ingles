// Gráficas SVG sin dependencias.
import { h, SKILLS, SKILL_SHORT, parseDate, fmtDate } from './util.js';

const NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs, text) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
}
export const SKILL_COLOR = { reading: 'var(--c-reading)', listening: 'var(--c-listening)', writing: 'var(--c-writing)', speaking: 'var(--c-speaking)', overall: 'var(--text)' };

/**
 * Líneas de banda (1-6) en el tiempo.
 * series: { reading:[{date,band}], ..., overall:[...] }; goal: número (línea horizontal).
 */
export function lineChart(series, { goals = [], startDate, endDate } = {}) {
  const W = 640, H = 300, L = 38, R = 12, T = 12, B = 30;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Evolución de la banda estimada por habilidad' });
  const all = Object.values(series).flat();
  const t0 = parseDate(startDate || (all.length ? all.map((p) => p.date).sort()[0] : '2026-11-01')).getTime();
  const t1 = parseDate(endDate || (all.length ? all.map((p) => p.date).sort().slice(-1)[0] : '2027-01-15')).getTime();
  const span = Math.max(t1 - t0, 86400000);
  const x = (d) => L + ((parseDate(d).getTime() - t0) / span) * (W - L - R);
  const y = (b) => T + (1 - (b - 1) / 5) * (H - T - B);
  for (let b = 1; b <= 6; b++) {
    svg.append(s('line', { x1: L, x2: W - R, y1: y(b), y2: y(b), class: 'grid-line' }));
    svg.append(s('text', { x: L - 8, y: y(b) + 4, 'text-anchor': 'end' }, String(b)));
  }
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const t = new Date(t0 + (span * i) / ticks);
    const label = t.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    svg.append(s('text', { x: L + ((W - L - R) * i) / ticks, y: H - 8, 'text-anchor': i === 0 ? 'start' : i === ticks ? 'end' : 'middle' }, label));
  }
  goals.forEach(({ value, label, color }, i) => {
    svg.append(s('line', { x1: L, x2: W - R, y1: y(value), y2: y(value), stroke: color, 'stroke-width': 2, 'stroke-dasharray': '6 4' }));
    svg.append(s('text', { x: W - R, y: y(value) + (i ? 14 : -5), 'text-anchor': 'end', style: `fill:${color};font-weight:600` }, `${label} ${value}`));
  });
  for (const key of [...SKILLS, 'overall']) {
    const pts = series[key] || [];
    if (!pts.length) continue;
    const color = SKILL_COLOR[key];
    if (pts.length > 1) svg.append(s('polyline', { points: pts.map((p) => `${x(p.date)},${y(p.band)}`).join(' '), fill: 'none', stroke: color, 'stroke-width': key === 'overall' ? 3 : 2, 'stroke-dasharray': key === 'overall' ? '' : '' }));
    for (const p of pts) {
      const c = s('circle', { cx: x(p.date), cy: y(p.band), r: key === 'overall' ? 4.5 : 3.5, fill: color });
      c.append(s('title', {}, `${key === 'overall' ? 'Promedio' : SKILL_SHORT[key]} · ${fmtDate(p.date)} · banda ${p.band}`));
      svg.append(c);
    }
  }
  return svg;
}

export function chartLegend() {
  const items = [...SKILLS.map((k) => [k, SKILL_SHORT[k]]), ['overall', 'Promedio']];
  return h('div', { class: 'legend' }, items.map(([k, label]) => h('span', null, h('i', { style: `background:${SKILL_COLOR[k]}` }), label)));
}

/** Barras horizontales: rows [{label, pct, text}] */
export function barList(rows) {
  return h('div', { class: 'bars' }, rows.map((r) => h('div', { class: 'bar-row' },
    h('span', null, r.label),
    h('div', { class: 'track', role: 'img', 'aria-label': `${r.label}: ${r.text}` }, h('div', { class: 'fill', style: `width:${Math.round(r.pct)}%;${r.color ? `background:${r.color}` : ''}` })),
    h('span', { class: 'muted small' }, r.text))));
}

/** Gráfica de radar simple (4 ejes) para el perfil de habilidades. */
export function radar(bands) {
  const size = 260, c = size / 2, rad = 90;
  const svg = s('svg', { viewBox: `0 0 ${size} ${size}`, class: 'chart', style: 'max-width:300px;margin:auto', role: 'img', 'aria-label': 'Perfil de habilidades: ' + SKILLS.map((k) => `${SKILL_SHORT[k]} ${bands[k] ?? 'sin dato'}`).join(', ') });
  const pt = (i, v) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 4; const r = ((v - 0) / 6) * rad; return [c + r * Math.cos(a), c + r * Math.sin(a)]; };
  for (const lvl of [2, 4, 6]) svg.append(s('polygon', { points: [0, 1, 2, 3].map((i) => pt(i, lvl).join(',')).join(' '), fill: 'none', class: 'grid-line', stroke: 'var(--border)' }));
  SKILLS.forEach((k, i) => {
    const [x, y] = pt(i, 6.9);
    svg.append(s('line', { x1: c, y1: c, x2: pt(i, 6)[0], y2: pt(i, 6)[1], stroke: 'var(--border)' }));
    svg.append(s('text', { x, y: y + 4, 'text-anchor': 'middle' }, `${SKILL_SHORT[k]} ${bands[k] ?? '–'}`));
  });
  const poly = SKILLS.map((k, i) => pt(i, bands[k] ?? 0).join(',')).join(' ');
  svg.append(s('polygon', { points: poly, fill: 'var(--primary)', 'fill-opacity': .25, stroke: 'var(--primary)', 'stroke-width': 2 }));
  return svg;
}
