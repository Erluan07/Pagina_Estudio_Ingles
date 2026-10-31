// Vistas: Diagnóstico inicial y Simulacros.
import { h, today, fmtDate, SKILLS, SKILL_SHORT, SKILL_ES, fetchJSON, fmtClock, round1, roundHalf, mean } from '../util.js';
import * as store from '../store.js';
import * as S from '../stats.js';
import { renderBlock } from '../practice.js';
import { radar } from '../charts.js';
import { QTYPE_ES } from '../quiz.js';

export const bandText = (b) => b === null || b === undefined ? 'sin datos'
  : b >= 5.5 ? 'avanzado alto (C1-C2)' : b >= 5 ? 'avanzado (C1)' : b >= 4.5 ? 'intermedio alto (B2+)' : b >= 4 ? 'intermedio (B2)' : b >= 3 ? 'intermedio bajo (B1)' : 'básico (A2 o menos)';

function partResult(skill, prefix, kind) {
  const s = store.get();
  const at = s.attempts.filter((a) => a.skill === skill && a.itemId.startsWith(prefix));
  const byType = {};
  let pts = 0, max = 0;
  at.forEach((a) => { pts += a.pts; max += a.max; (byType[a.qtype] ||= { pts: 0, max: 0 }); byType[a.qtype].pts += a.pts; byType[a.qtype].max += a.max; });
  const ev = s.evals.filter((e) => e.task.startsWith(prefix) && e.skill === skill);
  const bands = [];
  if (max) bands.push(S.bandFromAcc(pts / max));
  ev.forEach((e) => bands.push(e.band));
  return { date: today(), pts, max, byType, evalBands: ev.map((e) => e.band), band: bands.length ? roundHalf(mean(bands)) : null };
}

export async function viewDiagnostic(parts) {
  const diag = await fetchJSON('data/diagnostic.json');
  const skill = parts[0];
  const s = store.get();
  if (skill && diag.parts[skill]) return diagnosticPart(diag, skill);
  const root = h('div', null, h('h1', null, 'Test diagnóstico'));
  root.append(h('p', null, diag.intro));
  root.append(h('div', { class: 'notice' }, diag.honesty));
  const done = SKILLS.filter((k) => s.diagnostic[k]);
  root.append(h('div', { class: 'grid' }, SKILLS.map((k) => {
    const p = diag.parts[k], r = s.diagnostic[k];
    return h('div', { class: 'card' }, h('span', { class: `pill ${k}` }, SKILL_SHORT[k]), h('h2', null, `Parte ${SKILLS.indexOf(k) + 1}: ${p.title}`), h('p', { class: 'muted' }, `≈ ${p.minutes} min`),
      r ? h('p', null, h('span', { class: 'pill good' }, '✔ hecha'), ` banda estimada ${r.band ?? '–'}`) : h('p', null, h('span', { class: 'pill' }, 'pendiente')),
      h('a', { class: r ? 'btn btn-secondary' : 'btn', href: `#/diagnostico/${k}` }, r ? 'Ver / rehacer' : 'Empezar'));
  })));
  if (done.length) root.append(profile());
  return root;
}

export function profile() {
  const s = store.get();
  const bands = Object.fromEntries(SKILLS.map((k) => [k, S.skillBand(k)]));
  const w = S.skillWeights();
  const weak = S.weakestSkills();
  const card = h('div', { class: 'card' }, h('h2', null, 'Tu perfil de habilidades'));
  card.append(radar(bands));
  card.append(h('table', { class: 'simple' }, h('thead', null, h('tr', null, ['Habilidad', 'Banda estimada', 'Nivel aproximado', 'Peso en tu plan'].map((t) => h('th', null, t)))),
    h('tbody', null, SKILLS.map((k) => h('tr', null, h('td', null, SKILL_ES[k]), h('td', null, bands[k] ?? '–'), h('td', null, bandText(bands[k])), h('td', null, `${Math.round(w[k] * 100)} %`))))));
  const doneN = SKILLS.filter((k) => s.diagnostic[k]).length;
  if (doneN < 4) card.append(h('div', { class: 'notice' }, `Perfil parcial: ${doneN}/4 partes. Completa las que faltan para ajustar el plan completo.`));
  else {
    const ov = S.overallBand();
    card.append(h('p', null, h('strong', null, `Banda global estimada: ${ov.value} `), `(meta mínima de Twente que verificamos: ${s.settings.goal}; margen de seguridad recomendado: ${s.settings.goalSafe}).`));
    const gap = round1(s.settings.goalSafe - ov.value);
    card.append(h('p', null, gap > 0 ? `Distancia al margen recomendado: ${gap} bandas. ` : 'Ya estás en el nivel meta en esta estimación; el objetivo es consolidar. ', weak.length ? `Tu habilidad más débil es ${SKILL_SHORT[weak[0]]}${weak[1] ? ` y después ${SKILL_SHORT[weak[1]]}` : ''}: recibirán más tiempo de refuerzo en cada sesión diaria.` : ''));
  }
  const byType = Object.values(s.diagnostic).filter(Boolean).flatMap((r) => Object.entries(r.byType || {}));
  const agg = {};
  byType.forEach(([k, v]) => { (agg[k] ||= { pts: 0, max: 0 }); agg[k].pts += v.pts; agg[k].max += v.max; });
  const weakTypes = Object.entries(agg).filter(([, v]) => v.max >= 1).sort((a, b) => a[1].pts / a[1].max - b[1].pts / b[1].max).slice(0, 4);
  if (weakTypes.length) card.append(h('p', null, h('strong', null, 'Tipos de pregunta con menor acierto: '), weakTypes.map(([k, v]) => `${QTYPE_ES[k] || k} (${Math.round((100 * v.pts) / v.max)} %)`).join(' · ')));
  card.append(h('p', { class: 'small muted' }, 'Aviso: estas bandas son estimaciones orientativas a partir de pocas preguntas y, en Writing/Speaking, de tu propia autoevaluación. No sustituyen un puntaje oficial.'));
  card.append(h('a', { class: 'btn', href: '#/hoy' }, 'Ir a la sesión de hoy'));
  return card;
}

async function diagnosticPart(diag, skill) {
  const p = diag.parts[skill];
  const root = h('div', null, h('p', { class: 'small' }, h('a', { href: '#/diagnostico' }, '← Diagnóstico')), h('h1', null, `Diagnóstico · ${p.title}`),
    h('p', { class: 'muted' }, `≈ ${p.minutes} minutos. ${p.intro}`));
  const ctx = { day: null, skill, kind: 'diagnostic', maxPlays: p.maxPlays || 2, onDone: () => {} };
  for (const b of p.blocks) {
    root.append(h('section', { class: 'card' }, h('h2', null, b.title), b.timing ? h('p', { class: 'small muted' }, b.timing) : null, await renderBlock({ ...b, skill }, ctx)));
  }
  const out = h('div', { role: 'status', 'aria-live': 'polite' });
  root.append(h('div', { class: 'card' }, h('h2', null, 'Terminar esta parte'), h('p', null, 'Cuando hayas comprobado tus respuestas (y guardado la autoevaluación en Writing/Speaking), guarda el resultado de la parte.'),
    h('button', { class: 'btn', type: 'button', onclick: () => {
      const r = partResult(skill, p.prefix);
      if (!r.max && !r.evalBands.length) { out.replaceChildren(h('div', { class: 'notice' }, 'Todavía no hay respuestas comprobadas en esta parte.')); return; }
      store.update((st) => { st.diagnostic[skill] = r; });
      const left = SKILLS.filter((k) => !store.get().diagnostic[k]);
      out.replaceChildren(h('div', { class: 'notice good' }, `Parte guardada. Banda estimada en ${SKILL_SHORT[skill]}: ${r.band}. `, left.length ? `Te faltan: ${left.map((k) => SKILL_SHORT[k]).join(', ')}.` : '¡Diagnóstico completo!'), h('a', { class: 'btn', href: '#/diagnostico' }, 'Ver perfil'));
    } }, 'Guardar resultado de la parte'), out));
  return root;
}

// ---------------- Simulacro ----------------
export async function viewMock(parts) {
  const id = parts[0];
  const mock = await fetchJSON(`data/mocks/${id}.json`);
  const prefix = `mk-${id}-`;
  const root = h('div');
  let idx = -1, tm = null;

  const clearTimer = () => { if (tm) { clearInterval(tm); tm = null; } };

  function intro() {
    clearTimer();
    root.replaceChildren(h('p', { class: 'small' }, h('a', { href: '#/plan' }, '← Plan')), h('h1', null, mock.title),
      h('p', null, mock.intro),
      h('table', { class: 'simple' }, h('thead', null, h('tr', null, ['Sección', 'Tiempo', 'Contenido'].map((t) => h('th', null, t)))),
        h('tbody', null, mock.sections.map((sec) => h('tr', null, h('td', null, sec.title), h('td', null, `${sec.minutes} min`), h('td', null, sec.what))))),
      h('div', { class: 'notice' }, 'Reglas: audio con una sola reproducción, sin ayudas, sin pausar. Cada sección tiene temporizador; al llegar a 0 se califica automáticamente lo que tengas.'),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: () => next() }, 'Empezar el simulacro')));
  }

  async function next() {
    idx++;
    if (idx >= mock.sections.length) return summary();
    const sec = mock.sections[idx];
    const body = h('div');
    const clock = h('span', { class: 'timer-display', role: 'timer', 'aria-label': 'Tiempo restante de la sección' });
    let left = sec.minutes * 60;
    clock.textContent = fmtClock(left);
    const finish = h('button', { class: 'btn', type: 'button' }, idx < mock.sections.length - 1 ? 'Terminar sección y continuar' : 'Terminar simulacro');
    const gradeAll = () => { body.querySelectorAll('.qset').forEach((q) => { const b = q.querySelector('.btn-row button'); if (b && !b.hidden) { b.click(); if (!b.hidden) b.click(); } }); };
    root.replaceChildren(h('h1', null, `${mock.title} · ${sec.title}`), h('div', { class: 'btn-row', style: 'align-items:center' }, h('span', { class: `pill ${sec.skill}` }, SKILL_SHORT[sec.skill]), 'Tiempo: ', clock), body,
      h('div', { class: 'card' }, h('p', null, 'Al terminar, comprueba todas tus respuestas (o se calificarán al cerrar la sección).'), finish));
    tm = setInterval(() => { left--; clock.textContent = fmtClock(left); if (left <= 0) { clearTimer(); gradeAll(); body.prepend(h('div', { class: 'notice bad' }, 'Tiempo agotado: se calificó lo que tenías. Pulsa «Terminar sección» para continuar.')); } }, 1000);
    finish.addEventListener('click', () => { gradeAll(); clearTimer(); next(); });
    for (const b of sec.blocks) body.append(h('section', { class: 'card' }, b.title ? h('h2', null, b.title) : null, await renderBlock({ ...b, skill: sec.skill }, { day: mock.day || null, skill: sec.skill, kind: 'mock', maxPlays: 1 })));
  }

  function summary() {
    clearTimer();
    const res = {};
    const sb = [];
    for (const k of SKILLS) {
      const r = partResult(k, prefix);
      if (r.band !== null) { res[k] = r; sb.push(r.band); }
    }
    store.update((st) => { st.mocks[id] = { date: today(), bySkill: Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { pts: v.pts, max: v.max, band: v.band }])), overall: sb.length ? roundHalf(mean(sb)) : null }; });
    root.replaceChildren(h('h1', null, 'Resultado del simulacro'),
      h('div', { class: 'card' }, h('table', { class: 'simple' }, h('thead', null, h('tr', null, ['Habilidad', 'Aciertos', 'Banda estimada'].map((t) => h('th', null, t)))),
        h('tbody', null, Object.entries(res).map(([k, v]) => h('tr', null, h('td', null, SKILL_SHORT[k]), h('td', null, v.max ? `${v.pts}/${v.max}` : 'autoevaluación'), h('td', null, v.band)))))),
      sb.length ? h('p', null, h('strong', null, `Banda global estimada del simulacro: ${roundHalf(mean(sb))}`), ' (orientativa; ver «Sobre el examen» para el significado de la escala).') : null,
      h('div', { class: 'notice info' }, 'Siguiente paso: revisa tus errores del simulacro en el banco de errores y anota 2-3 ajustes concretos para la próxima semana.'),
      h('div', { class: 'btn-row' }, h('a', { class: 'btn', href: '#/repaso?tab=errores' }, 'Revisar errores'), h('a', { class: 'btn btn-secondary', href: '#/progreso' }, 'Ver progreso')));
  }

  intro();
  return root;
}
