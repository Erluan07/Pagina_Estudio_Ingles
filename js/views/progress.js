// Panel de progreso.
import { h, today, fmtDate, SKILLS, SKILL_SHORT, SKILL_ES, addDays, diffDays, round1 } from '../util.js';
import * as store from '../store.js';
import * as S from '../stats.js';
import * as P from '../plan.js';
import { lineChart, chartLegend, barList, SKILL_COLOR } from '../charts.js';
import { QTYPE_ES } from '../quiz.js';
import { bandText } from './diag.js';

const tile = (num, lbl, extra) => h('div', { class: 'stat' }, h('div', { class: 'num' }, num), h('div', { class: 'lbl' }, lbl), extra || null);

export async function viewProgress() {
  const plan = await P.loadPlan();
  const s = store.get();
  const root = h('div', null, h('h1', null, 'Panel de progreso'));
  const st = S.streak(), pr = P.progressPct(), lw = S.learnedWords();
  const errs = Object.values(s.errors);
  root.append(h('div', { class: 'grid' },
    tile(`${st.current} 🔥`, `racha actual (mejor: ${st.best})`),
    tile(Math.round(S.totalMinutes()), 'minutos estudiados', h('div', { class: 'small muted' }, `${(S.totalMinutes() / 60).toFixed(1)} h`)),
    tile(`${pr.pct.toFixed(0)} %`, `plan completado (${pr.done}/${pr.total})`, h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': Math.round(pr.pct), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Plan completado' }, h('span', { style: `width:${pr.pct}%` }))),
    tile(`${lw.learned}`, `palabras aprendidas (de ${lw.total} vistas)`, h('div', { class: 'small muted' }, 'Aprendida = 3 repasos correctos seguidos')),
    tile(errs.filter((e) => !e.resolved).length, `errores en el banco (${errs.filter((e) => e.resolved).length} resueltos)`)));

  // Proyección
  const goal = s.settings.goal, safe = s.settings.goalSafe;
  const ov = S.overallBand(), proj = S.projection();
  const projCard = h('div', { class: 'card' }, h('h2', null, 'Puntaje estimado y proyección'));
  if (ov.value === null) projCard.append(h('p', null, 'Aún no hay datos. Haz el ', h('a', { href: '#/diagnostico' }, 'diagnóstico'), ' y tus primeras sesiones.'));
  else {
    projCard.append(h('p', null, h('strong', { style: 'font-size:1.4rem' }, `Banda global estimada hoy: ${ov.value}`), ov.complete ? '' : ' (parcial: faltan habilidades por medir)', ` — ${bandText(ov.value)}`));
    projCard.append(h('p', null, proj ? `Proyección lineal al ${fmtDate(s.settings.examDate, { day: 'numeric', month: 'long' })}: ${proj.value} (tendencia ${proj.slopePerWeek >= 0 ? '+' : ''}${proj.slopePerWeek} bandas/semana, ${proj.points} mediciones). ` : 'Proyección disponible cuando haya al menos 3 días con datos de las 4 habilidades. ',
      h('strong', null, `Meta mínima Twente: ${goal} · margen recomendado: ${safe}.`)));
    const ref = proj ? proj.value : ov.value;
    projCard.append(h('div', { class: `notice ${ref >= safe ? 'good' : ref >= goal ? 'info' : 'bad'}` }, ref >= safe ? 'Vas por encima del margen recomendado. Mantén la constancia y los simulacros.' : ref >= goal ? 'Estás en la meta mínima pero sin margen. Prioriza tus habilidades más bajas.' : `Por debajo de la meta mínima (${goal}). No te desanimes: refuerza las habilidades más bajas y usa el banco de errores a diario.`));
  }
  projCard.append(h('p', { class: 'small muted' }, 'Importante: es una estimación aproximada basada en tu acierto en este material (no oficial) y en tu autoevaluación en Writing/Speaking. ETS reporta en escala 1-6 y los requisitos de Twente deben confirmarse en su sitio (ver «Sobre el examen»).'));
  root.append(projCard);

  // Gráfica por habilidad
  const series = Object.fromEntries(SKILLS.map((k) => [k, S.skillSeries(k)]));
  series.overall = S.overallSeries();
  const gc = h('div', { class: 'card' }, h('h2', null, 'Banda estimada por habilidad en el tiempo'));
  gc.append(lineChart(series, { goal, startDate: addDays(plan.meta.start, -2), endDate: plan.meta.exam }), chartLegend());
  gc.append(h('p', { class: 'small muted' }, 'Cada punto es el promedio del día (acierto en tests y autoevaluaciones).'));
  gc.append(h('table', { class: 'simple' }, h('thead', null, h('tr', null, ['Habilidad', 'Banda actual', 'Acierto acumulado'].map((t) => h('th', null, t)))),
    h('tbody', null, SKILLS.map((k) => { const a = S.accuracyBySkill()[k]; return h('tr', null, h('td', null, SKILL_ES[k]), h('td', null, S.skillBand(k) ?? '–'), h('td', null, a.max ? `${Math.round((100 * a.pts) / a.max)} % (${a.pts}/${a.max})` : 'sin tests')); }))));
  root.append(gc);

  // Precisión por tipo
  const types = S.accuracyByType();
  const tc = h('div', { class: 'card' }, h('h2', null, 'Precisión por tipo de pregunta'));
  if (!types.length) tc.append(h('p', { class: 'muted' }, 'Aparecerá cuando respondas tus primeros quizzes.'));
  else tc.append(barList(types.map((t) => ({ label: `${QTYPE_ES[t.qtype] || t.qtype} · ${SKILL_SHORT[t.skill]}`, pct: (100 * t.pts) / t.max, text: `${Math.round((100 * t.pts) / t.max)} % (${t.max})`, color: SKILL_COLOR[t.skill] }))), h('p', { class: 'small muted' }, 'Ordenado de menor a mayor acierto: lo de arriba es lo primero a reforzar.'));
  root.append(tc);

  // Calendario de constancia
  const act = S.activeDates();
  const cal = h('div', { class: 'streak-cal', role: 'img', 'aria-label': 'Calendario de constancia del plan' }, plan.days.map((d) => h('span', { class: act.has(d.date) ? 'on' : P.isDone(d.n) ? 'on' : '', title: `Día ${d.n} · ${fmtDate(d.date)}${act.has(d.date) || P.isDone(d.n) ? ' · estudiado' : ''}` })));
  root.append(h('div', { class: 'card' }, h('h2', null, 'Constancia'), cal, h('p', { class: 'small muted' }, 'Cada casilla es un día del plan (verde = estudiaste ≥ 10 min o completaste la sesión).')));

  // Minutos por semana
  const wk = plan.days.reduce((a, d) => { (a[d.week] ||= 0); a[d.week] += s.minutesByDate[d.date] || 0; return a; }, {});
  root.append(h('div', { class: 'card' }, h('h2', null, 'Minutos por semana'), barList(Object.entries(wk).map(([w, m]) => ({ label: `Semana ${w}`, pct: Math.min(100, (m / 630) * 100), text: `${Math.round(m)} min` }))), h('p', { class: 'small muted' }, 'Barra completa = 630 min (90 min/día).')));

  // Simulacros
  const mocks = Object.entries(s.mocks);
  if (mocks.length) root.append(h('div', { class: 'card' }, h('h2', null, 'Simulacros'), h('table', { class: 'simple' }, h('thead', null, h('tr', null, ['Simulacro', 'Fecha', 'Banda global estimada'].map((t) => h('th', null, t)))), h('tbody', null, mocks.map(([id, m]) => h('tr', null, h('td', null, id), h('td', null, fmtDate(m.date)), h('td', null, m.overall ?? '–')))))));
  return root;
}
