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

  // Proyección frente a las dos metas
  const T = S.targets();
  const ov = S.overallBand(), proj = S.projection();
  const projCard = h('div', { class: 'card' }, h('h2', null, 'Puntaje estimado y proyección'));
  if (ov.value === null) projCard.append(h('p', null, 'Aún no hay datos. Haz el ', h('a', { href: '#/diagnostico' }, 'diagnóstico'), ' y tus primeras sesiones.'));
  else {
    projCard.append(h('p', null, h('strong', { style: 'font-size:1.4rem' }, `Banda global estimada hoy: ${ov.value}`), ov.complete ? '' : ' (parcial: faltan habilidades por medir)', ` — ${bandText(ov.value)}`));
    projCard.append(h('p', null, proj ? `Proyección lineal al ${fmtDate(s.settings.examDate, { day: 'numeric', month: 'long' })}: ${proj.value} (tendencia ${proj.slopePerWeek >= 0 ? '+' : ''}${proj.slopePerWeek} bandas/semana, ${proj.points} mediciones). ` : 'Proyección disponible cuando haya al menos 3 días con datos de las 4 habilidades. '));
    const ref = proj ? proj.value : ov.value;
    projCard.append(h('div', { class: `notice ${ref >= T.objective.total ? 'good' : ref >= T.minimum.total ? 'info' : 'bad'}` },
      ref >= T.objective.total ? `Vas en el objetivo (${T.objective.total}), que cubre tanto el intake de febrero como el de septiembre de 2027. Mantén la constancia.`
        : ref >= T.minimum.total ? `Alcanzas el mínimo de febrero 2027 (${T.minimum.total}) pero no el objetivo de septiembre 2027 (${T.objective.total}). Prioriza tus habilidades más bajas.`
          : `Por debajo del mínimo (${T.minimum.total}). No te desanimes: refuerza las habilidades más bajas y usa el banco de errores a diario.`));
    projCard.append(h('table', { class: 'simple' }, h('thead', null, h('tr', null, ['', 'Banda actual', `Mínimo feb-2027`, 'Objetivo (sep-2027)', 'Estado'].map((t) => h('th', null, t)))),
      h('tbody', null, [['total', 'Total (promedio)', ov.value], ...SKILLS.map((k) => [k, SKILL_SHORT[k], S.skillBand(k)])].map(([k, label, b]) => h('tr', null,
        h('td', null, label), h('td', null, b ?? '–'), h('td', null, T.minimum[k]), h('td', null, T.objective[k]),
        h('td', null, b === null ? '–' : b >= T.objective[k] ? h('span', { class: 'pill good' }, 'objetivo') : b >= T.minimum[k] ? h('span', { class: 'pill warn' }, 'mínimo') : h('span', { class: 'pill bad' }, 'por debajo')))))));
  }
  projCard.append(h('p', { class: 'small muted' }, 'Estimación aproximada: la precisión en este material (no calibrado como el examen real) se convierte a banda con una tabla basada en la equivalencia de ETS, y Writing/Speaking usan tu autoevaluación. Confirma tu intake y la fecha límite de resultados en la página de tu programa (ver «Sobre el examen»).'));
  root.append(projCard);

  // Gráfica por habilidad
  const series = Object.fromEntries(SKILLS.map((k) => [k, S.skillSeries(k)]));
  series.overall = S.overallSeries();
  const gc = h('div', { class: 'card' }, h('h2', null, 'Banda estimada por habilidad en el tiempo'));
  gc.append(lineChart(series, { goals: [{ value: T.objective.total, label: 'Objetivo', color: 'var(--good)' }, { value: T.minimum.total, label: 'Mínimo feb-27', color: 'var(--warn)' }], startDate: addDays(plan.meta.start, -2), endDate: plan.meta.exam }), chartLegend());
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
