// Cálculos de progreso: bandas estimadas por habilidad, rachas, proyección.
// IMPORTANTE: son estimaciones orientativas; no equivalen a un puntaje oficial de ETS.
import { SKILLS, clamp, roundHalf, round1, mean, today, addDays, diffDays } from './util.js';
import * as store from './store.js';
import { isLearned } from './srs.js';

/** Precisión (0-1) -> banda 1-6 (aprox. lineal). */
export function bandFromAcc(a) { return clamp(roundHalf(1 + 5 * a), 1, 6); }

/** Eventos fechados por habilidad: {date, band, w} (w = peso). */
function events(skill) {
  const s = store.get();
  const byDate = {};
  for (const a of s.attempts) {
    if (a.skill !== skill) continue;
    (byDate[a.date] ||= { pts: 0, max: 0, evals: [] });
    byDate[a.date].pts += a.pts; byDate[a.date].max += a.max;
  }
  for (const e of s.evals) {
    if (e.skill !== skill) continue;
    (byDate[e.date] ||= { pts: 0, max: 0, evals: [] }).evals.push(e.band);
  }
  const out = [];
  for (const [date, v] of Object.entries(byDate)) {
    const bands = [];
    if (v.max > 0) bands.push(bandFromAcc(v.pts / v.max));
    bands.push(...v.evals);
    if (bands.length) out.push({ date, band: mean(bands), n: v.max + v.evals.length });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function skillSeries(skill) { return events(skill).map((e) => ({ date: e.date, band: round1(e.band) })); }

/** Banda estimada actual: media ponderada con más peso a lo reciente. */
export function skillBand(skill) {
  const ev = events(skill);
  if (!ev.length) return null;
  let num = 0, den = 0;
  ev.slice().reverse().forEach((e, i) => { const w = Math.pow(0.8, i); num += e.band * w; den += w; });
  return roundHalf(num / den);
}

export function overallBand() {
  const bands = SKILLS.map(skillBand);
  const have = bands.filter((b) => b !== null);
  if (!have.length) return { value: null, complete: false };
  return { value: roundHalf(mean(have)), complete: have.length === 4 };
}

/** Serie del promedio de las habilidades con dato, por fecha (último valor conocido de cada habilidad). */
export function overallSeries() {
  const evs = Object.fromEntries(SKILLS.map((k) => [k, events(k)]));
  const dates = [...new Set(SKILLS.flatMap((k) => evs[k].map((e) => e.date)))].sort();
  const last = {};
  const out = [];
  for (const d of dates) {
    for (const k of SKILLS) { const e = evs[k].find((x) => x.date === d); if (e) last[k] = e.band; }
    if (Object.keys(last).length === 4) out.push({ date: d, band: round1(mean(Object.values(last))) });
  }
  return out;
}

/** Proyección lineal al día del examen. Devuelve null si faltan datos. */
export function projection() {
  const s = store.get();
  const ser = overallSeries();
  if (ser.length < 3) return null;
  const t0 = ser[0].date;
  const xs = ser.map((p) => diffDays(p.date, t0)), ys = ser.map((p) => p.band);
  const n = xs.length, mx = mean(xs), my = mean(ys);
  let sxx = 0, sxy = 0;
  xs.forEach((x, i) => { sxx += (x - mx) ** 2; sxy += (x - mx) * (ys[i] - my); });
  if (sxx === 0) return null;
  const slope = sxy / sxx, icpt = my - slope * mx;
  const x = diffDays(s.settings.examDate, t0);
  const raw = icpt + slope * x;
  // Prudencia: no se proyecta más de +1.5 sobre el valor actual (las mejoras reales se frenan).
  const cur = ys[ys.length - 1];
  const value = clamp(roundHalf(Math.min(raw, cur + 1.5)), 1, 6);
  return { value, slopePerWeek: round1(slope * 7), points: n };
}

export function accuracyByType() {
  const out = {};
  for (const a of store.get().attempts) {
    const k = `${a.skill}|${a.qtype}`;
    (out[k] ||= { skill: a.skill, qtype: a.qtype, pts: 0, max: 0 });
    out[k].pts += a.pts; out[k].max += a.max;
  }
  return Object.values(out).sort((a, b) => a.pts / a.max - b.pts / b.max);
}

export function accuracyBySkill() {
  const out = Object.fromEntries(SKILLS.map((k) => [k, { pts: 0, max: 0 }]));
  for (const a of store.get().attempts) { if (out[a.skill]) { out[a.skill].pts += a.pts; out[a.skill].max += a.max; } }
  return out;
}

export function activeDates() {
  const s = store.get();
  const set = new Set();
  for (const [d, m] of Object.entries(s.minutesByDate)) if (m >= 10) set.add(d);
  for (const v of Object.values(s.days)) if (v.done && v.completedAt) set.add(v.completedAt);
  return set;
}

export function streak() {
  const set = activeDates();
  let d = today();
  if (!set.has(d)) d = addDays(d, -1); // hoy aún puede completarse
  let n = 0;
  while (set.has(d)) { n++; d = addDays(d, -1); }
  let best = 0, run = 0;
  const sorted = [...set].sort();
  sorted.forEach((x, i) => { run = i > 0 && diffDays(x, sorted[i - 1]) === 1 ? run + 1 : 1; best = Math.max(best, run); });
  return { current: n, best };
}

export function totalMinutes() { return Object.values(store.get().minutesByDate).reduce((a, b) => a + b, 0); }

export function learnedWords() {
  const v = Object.values(store.get().vocab);
  return { learned: v.filter(isLearned).length, total: v.length };
}

/** Pesos por habilidad según la debilidad (banda más baja => más peso). Suma 1. */
export function skillWeights() {
  const w = {};
  let sum = 0;
  for (const k of SKILLS) {
    const b = skillBand(k);
    const val = b === null ? 1 : Math.pow(6.5 - b, 1.4);
    w[k] = val; sum += val;
  }
  for (const k of SKILLS) w[k] = w[k] / sum;
  return w;
}

export function weakestSkills() {
  return SKILLS.map((k) => ({ k, b: skillBand(k) })).filter((x) => x.b !== null).sort((a, b) => a.b - b.b).map((x) => x.k);
}
