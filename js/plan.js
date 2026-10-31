// Acceso al plan de 75 días y a su estado.
import { fetchJSON, today, diffDays } from './util.js';
import * as store from './store.js';

let plan = null;
export async function loadPlan() { if (!plan) plan = await fetchJSON('data/plan.json'); return plan; }
export const pad = (n) => String(n).padStart(2, '0');

export async function loadDay(n) { return fetchJSON(`data/days/d${pad(n)}.json`); }

/** Día del plan que corresponde a una fecha (o null si está fuera del rango). */
export function dayOnDate(date) { return plan.days.find((d) => d.date === date) || null; }

export function isDone(n) { return !!(store.get().days[n] && store.get().days[n].done); }

/** 'done' | 'today' | 'missed' | 'future' */
export function statusOf(d) {
  if (isDone(d.n)) return 'done';
  const t = today();
  if (d.date === t) return 'today';
  return d.date < t ? 'missed' : 'future';
}

export function progressPct() {
  const done = plan.days.filter((d) => isDone(d.n)).length;
  return { done, total: plan.days.length, pct: (100 * done) / plan.days.length };
}

/** Primer día pendiente de hoy o anterior (para «Recuperar días atrasados»). */
export function backlog() { const t = today(); return plan.days.filter((d) => d.date < t && !isDone(d.n)); }

export function daysToExam() { return diffDays(store.get().settings.examDate, today()); }
