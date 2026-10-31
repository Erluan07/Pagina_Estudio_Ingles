// Estado de la app en localStorage (con respaldo en memoria si el navegador lo bloquea).
const KEY = 'toefl-twente-v1';
export const DEFAULTS = () => ({
  v: 1,
  settings: { theme: 'auto', mode: 90, startDate: '2026-11-01', examDate: '2027-01-15', goal: 4.5, goalSafe: 5.0, examAudio: false, targets: { objective: { total: 5, reading: 5, listening: 5, writing: 5, speaking: 4.5 }, minimum: { total: 4.5, reading: 4.5, listening: 4.5, writing: 4.5, speaking: 4 } } },
  diagnostic: { reading: null, listening: null, writing: null, speaking: null },
  days: {},
  minutesByDate: {},
  attempts: [],
  evals: [],
  vocab: {},
  errors: {},
  answers: {},
  drafts: {},
  mocks: {},
});

let state = null;
let memoryFallback = null;
const listeners = new Set();

function read() {
  try { return localStorage.getItem(KEY); } catch (e) { return memoryFallback; }
}
function write(txt) {
  try { localStorage.setItem(KEY, txt); } catch (e) { memoryFallback = txt; }
}

export function load() {
  const raw = read();
  state = DEFAULTS();
  if (raw) {
    try { merge(state, JSON.parse(raw)); } catch (e) { console.warn('Estado corrupto, se ignora', e); }
  }
  return state;
}

function merge(base, incoming) {
  // Fusión superficial por claves conocidas para tolerar versiones antiguas.
  for (const k of Object.keys(base)) {
    if (incoming[k] === undefined) continue;
    if (k === 'settings' || k === 'diagnostic') base[k] = { ...base[k], ...incoming[k] };
    else base[k] = incoming[k];
  }
}

export function get() { if (!state) load(); return state; }
export function save() { write(JSON.stringify(state)); listeners.forEach((f) => f(state)); }
export function update(fn) { fn(get()); save(); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function exportJSON() {
  return JSON.stringify({ app: 'toefl-twente', exportedAt: new Date().toISOString(), data: get() }, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  const data = parsed && parsed.app === 'toefl-twente' ? parsed.data : parsed;
  if (!data || typeof data !== 'object' || data.v !== 1 || typeof data.days !== 'object' || typeof data.vocab !== 'object') {
    throw new Error('El archivo no parece un respaldo válido de esta app.');
  }
  const fresh = DEFAULTS();
  merge(fresh, data);
  state = fresh;
  save();
}

export function reset() { state = DEFAULTS(); save(); }
