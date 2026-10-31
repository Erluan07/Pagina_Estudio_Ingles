// Utilidades pequeñas: DOM, fechas, texto.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Hyperscript mínimo: h('div', {class:'x', onclick: fn}, 'texto', [hijos]) */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---- Fechas (siempre como 'YYYY-MM-DD' en hora local) ----
const pad = (n) => String(n).padStart(2, '0');
export function dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); }
export function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return dateStr(d); }
export function diffDays(a, b) { return Math.round((parseDate(a) - parseDate(b)) / 86400000); }
export function fmtDate(s, opts) {
  return parseDate(s).toLocaleDateString('es-ES', opts || { weekday: 'short', day: 'numeric', month: 'short' });
}
let simulatedToday = null;
export function setSimulatedToday(s) { simulatedToday = s; }
export function today() { return simulatedToday || dateStr(new Date()); }

export function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${pad(m)}:${pad(s)}`;
}
export function countWords(t) { return (t.trim().match(/[A-Za-z0-9'’-]+/g) || []).length; }
export function normalize(s) { return s.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim(); }
export function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
export function round1(x) { return Math.round(x * 10) / 10; }
export function roundHalf(x) { return Math.round(x * 2) / 2; }
export function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

export const SKILLS = ['reading', 'listening', 'writing', 'speaking'];
export const SKILL_ES = { reading: 'Reading (lectura)', listening: 'Listening (comprensión auditiva)', writing: 'Writing (escritura)', speaking: 'Speaking (expresión oral)' };
export const SKILL_SHORT = { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' };

const jsonCache = new Map();
export async function fetchJSON(path) {
  if (jsonCache.has(path)) return jsonCache.get(path);
  const r = await fetch(path);
  if (!r.ok) throw new Error(`No se pudo cargar ${path} (${r.status})`);
  const data = await r.json();
  jsonCache.set(path, data);
  return data;
}
const textCache = new Map();
export async function fetchText(path) {
  if (textCache.has(path)) return textCache.get(path);
  const r = await fetch(path);
  if (!r.ok) throw new Error(`No se pudo cargar ${path} (${r.status})`);
  const t = await r.text();
  textCache.set(path, t);
  return t;
}
