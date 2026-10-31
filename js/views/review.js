// Repaso espaciado: vocabulario y banco de errores.
import { h, today, SKILLS, SKILL_SHORT, fmtDate } from '../util.js';
import * as store from '../store.js';
import { schedule, isDue, isLearned } from '../srs.js';
import { createQuestionSet, QTYPE_ES } from '../quiz.js';
import { createPlayer } from '../audio.js';

function tabs(active, skill) {
  const t = [['vocab', 'Vocabulario'], ['errores', 'Preguntas falladas'], ['banco', 'Banco de errores']];
  return h('div', { class: 'btn-row', role: 'tablist' }, t.map(([k, l]) => h('a', { class: `btn ${active === k ? '' : 'btn-secondary'}`, href: `#/repaso?tab=${k}${skill ? '&skill=' + skill : ''}`, role: 'tab', 'aria-selected': active === k }, l)));
}

export async function viewReview(_p, q) {
  const tab = q.get('tab') || 'vocab';
  const skill = q.get('skill') || '';
  const root = h('div', null, h('h1', null, 'Repaso'), tabs(tab, skill));
  if (tab === 'vocab') root.append(vocabReview());
  else if (tab === 'errores') root.append(errorReview(skill));
  else root.append(errorBank(skill));
  return root;
}

function vocabReview() {
  const s = store.get(), t = today();
  const due = Object.values(s.vocab).filter((e) => isDue(e, t)).sort((a, b) => a.box - b.box);
  const wrap = h('div');
  const total = Object.keys(s.vocab).length;
  wrap.append(h('p', { class: 'muted' }, `${total} palabras en tu repaso · ${Object.values(s.vocab).filter(isLearned).length} aprendidas · ${due.length} para hoy.`));
  if (!due.length) {
    wrap.append(h('div', { class: 'notice good' }, total ? '¡Nada pendiente hoy! Vuelve mañana.' : 'Todavía no tienes palabras. Se añaden cuando haces el calentamiento de vocabulario de cada día.'));
    return wrap;
  }
  const batch = due.slice(0, 20);
  let i = 0;
  const area = h('div', { class: 'card', 'aria-live': 'polite' });
  const prog = h('div', { class: 'small muted' });
  const next = () => {
    if (i >= batch.length) { area.replaceChildren(h('div', { class: 'notice good' }, `Repaso terminado (${batch.length} tarjetas).` + (due.length > batch.length ? ' Quedan más: recarga la página para otro lote.' : ''))); prog.textContent = ''; return; }
    const c = batch[i];
    prog.textContent = `Tarjeta ${i + 1} de ${batch.length} · caja ${c.box}`;
    const back = h('div', { hidden: true }, h('p', null, c.def), h('p', null, h('strong', null, 'ES: '), c.es), h('p', { class: 'muted' }, h('em', null, c.ex)));
    const grade = h('div', { class: 'btn-row', hidden: true, style: 'justify-content:center' }, [['again', 'Otra vez'], ['hard', 'Difícil'], ['good', 'Bien'], ['easy', 'Fácil']].map(([g, l]) => h('button', { class: 'btn ' + (g === 'good' ? '' : 'btn-secondary'), type: 'button', onclick: () => { store.update((st) => schedule(st.vocab[c.w], g, today())); i++; next(); } }, l)));
    const rev = h('button', { class: 'btn', type: 'button', onclick: () => { back.hidden = false; grade.hidden = false; rev.hidden = true; } }, 'Mostrar significado');
    area.replaceChildren(h('div', { class: 'flash' }, h('div', { class: 'word' }, c.w), h('div', { class: 'muted' }, c.pos), back), h('div', { class: 'btn-row', style: 'justify-content:center' }, rev), grade);
    rev.focus();
  };
  next();
  wrap.append(prog, area);
  return wrap;
}

function errorList(skill) {
  return Object.values(store.get().errors).filter((e) => !skill || e.skill === skill);
}

function errorReview(skill) {
  const t = today();
  const wrap = h('div');
  wrap.append(h('div', { class: 'btn-row' }, h('span', { class: 'small muted' }, 'Filtrar: '), h('a', { class: 'btn btn-small btn-secondary', href: '#/repaso?tab=errores' }, 'Todas'), SKILLS.map((k) => h('a', { class: 'btn btn-small btn-secondary', href: `#/repaso?tab=errores&skill=${k}` }, SKILL_SHORT[k]))));
  const due = errorList(skill).filter((e) => !e.resolved && isDue(e, t));
  if (!due.length) { wrap.append(h('div', { class: 'notice good' }, 'No hay preguntas falladas pendientes de repaso hoy. Las que falles en tus quizzes aparecerán aquí a 1, 2, 4, 8… días.')); return wrap; }
  const batch = due.slice(0, 10);
  let i = 0;
  const area = h('div');
  const prog = h('p', { class: 'muted' });
  const next = () => {
    if (i >= batch.length) { area.replaceChildren(h('div', { class: 'notice good' }, `Repaso de errores terminado (${batch.length}).`)); prog.textContent = ''; return; }
    const e = batch[i];
    prog.textContent = `Pregunta ${i + 1} de ${batch.length} · origen: ${e.day ? 'día ' + e.day : 'diagnóstico/simulacro'} · ${QTYPE_ES[e.qtype] || e.qtype}`;
    const card = h('div', { class: 'card' });
    const c = e.ctx || {};
    if (c.passage) card.append(h('details', { class: 'reveal', open: true }, h('summary', null, c.title || 'Texto'), h('div', { class: 'passage' }, c.passage.split(/\n\n+/).map((p) => h('p', null, p)))));
    let player = null;
    if (c.audio) { player = createPlayer(c.audio, { maxPlays: Infinity }); card.append(player.el); }
    const qs = createQuestionSet([e.item], { skill: e.skill, day: e.day, kind: 'review', fresh: true, onDone: ({ pts, max }) => {
      if (player) player.reveal();
      const ok = pts === max;
      store.update((st) => { const x = st.errors[e.id]; schedule(x, ok ? 'good' : 'again', today()); if (ok && x.box >= 4) x.resolved = true; });
      card.append(h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: () => { i++; next(); } }, i + 1 < batch.length ? 'Siguiente' : 'Terminar')));
    } });
    card.append(qs.el);
    area.replaceChildren(card);
  };
  next();
  wrap.append(prog, area);
  return wrap;
}

function errorBank(skill) {
  const list = errorList(skill).sort((a, b) => (a.resolved - b.resolved) || a.due.localeCompare(b.due));
  const wrap = h('div');
  wrap.append(h('div', { class: 'btn-row' }, h('span', { class: 'small muted' }, 'Filtrar: '), h('a', { class: 'btn btn-small btn-secondary', href: '#/repaso?tab=banco' }, 'Todas'), SKILLS.map((k) => h('a', { class: 'btn btn-small btn-secondary', href: `#/repaso?tab=banco&skill=${k}` }, SKILL_SHORT[k]))));
  if (!list.length) { wrap.append(h('p', { class: 'muted' }, 'Tu banco de errores está vacío. Cada pregunta que falles se guardará aquí con su explicación.')); return wrap; }
  const byType = {};
  list.forEach((e) => { byType[e.qtype] = (byType[e.qtype] || 0) + 1; });
  wrap.append(h('p', null, `${list.length} pregunta(s). Más frecuentes: `, Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${QTYPE_ES[k] || k} (${n})`).join(' · ')));
  wrap.append(h('table', { class: 'simple' }, h('thead', null, h('tr', null, ['Pregunta', 'Tipo', 'Origen', 'Próximo repaso', 'Estado'].map((x) => h('th', null, x)))),
    h('tbody', null, list.map((e) => h('tr', null,
      h('td', null, (e.item.q || e.item.context || e.item.text || e.id).slice(0, 70)), h('td', null, QTYPE_ES[e.qtype] || e.qtype), h('td', null, e.day ? `Día ${e.day}` : 'Diag./simulacro'),
      h('td', null, e.resolved ? '–' : fmtDate(e.due)), h('td', null, e.resolved ? h('span', { class: 'pill good' }, 'resuelto') : h('span', { class: 'pill warn' }, `caja ${e.box}`)))))));
  return wrap;
}
