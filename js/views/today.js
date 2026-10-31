// Vistas: Hoy, Plan y Día.
import { h, today, fmtDate, SKILL_SHORT, SKILLS, fetchJSON, fetchText, clamp, diffDays } from '../util.js';
import * as store from '../store.js';
import { renderMarkdown } from '../md.js';
import * as P from '../plan.js';
import * as S from '../stats.js';
import { createQuestionSet } from '../quiz.js';
import { renderBlock, vocabBlock, writingBlock, speakingBlock, authenticBlock, videoBlock } from '../practice.js';
import { sessionMinutes } from '../timer.js';
import { isDue } from '../srs.js';

const SKILL_CLASS = (d) => (['reading', 'listening', 'writing', 'speaking'].includes(d.skill) ? d.skill : d.type === 'rest' ? 'rest' : d.type.startsWith('mock') ? 'mock' : d.skill);
const SKILL_LABEL = { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking', mixed: 'Mixto', review: 'Repaso', mock: 'Simulacro', rest: 'Descanso' };
const pillFor = (d) => h('span', { class: `pill ${['reading', 'listening', 'writing', 'speaking'].includes(d.skill) ? d.skill : ''}` }, SKILL_LABEL[d.skill] || d.skill);

export function dueCounts() {
  const s = store.get(), t = today();
  const vocab = Object.values(s.vocab).filter((e) => isDue(e, t)).length;
  const errors = Object.values(s.errors).filter((e) => !e.resolved && isDue(e, t)).length;
  return { vocab, errors };
}

function statTile(num, lbl) { return h('div', { class: 'stat' }, h('div', { class: 'num' }, num), h('div', { class: 'lbl' }, lbl)); }

// ---------------- HOY ----------------
export async function viewToday() {
  const plan = await P.loadPlan();
  const s = store.get(), t = today();
  const d = P.dayOnDate(t);
  const root = h('div');
  const left = P.daysToExam();
  root.append(h('h1', null, 'Hoy'));
  root.append(h('p', { class: 'muted' }, `${fmtDate(t, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · `, left > 0 ? `faltan ${left} días para el examen (${fmtDate(s.settings.examDate, { day: 'numeric', month: 'long', year: 'numeric' })})` : left === 0 ? '¡Hoy es el examen!' : 'el examen ya pasó'));

  const diagDone = Object.values(s.diagnostic).filter(Boolean).length;
  if (diagDone < 4) {
    root.append(h('div', { class: 'notice info' }, h('strong', null, diagDone === 0 ? 'Empieza por aquí: el diagnóstico. ' : `Diagnóstico: ${diagDone}/4 partes. `),
      'Son ~50 minutos en 4 partes (puedes hacerlas en días distintos). La app mide tu nivel por habilidad y ajusta el tiempo de refuerzo; el plan no enseña gramática básica, y si ya dominas una mini-lección puedes marcarla como vista y pasar a la práctica. ', h('a', { href: '#/diagnostico' }, 'Ir al diagnóstico →')));
  }

  if (!d) {
    if (t < plan.meta.start) root.append(h('div', { class: 'card' }, h('h2', null, 'El plan empieza el ' + fmtDate(plan.meta.start, { day: 'numeric', month: 'long' })), h('p', null, `Faltan ${diffDays(plan.meta.start, t)} día(s). Mientras tanto haz el diagnóstico y echa un vistazo a la `, h('a', { href: '#/plan' }, 'vista del plan'), ' o adelanta el Día 1.'), h('a', { class: 'btn', href: '#/dia/1' }, 'Adelantar Día 1')));
    else root.append(h('div', { class: 'card' }, h('h2', null, 'El plan terminó'), h('p', null, left >= 0 ? 'Repasa tu banco de errores y descansa.' : 'Esperamos que haya ido muy bien. Puedes revisar tu progreso.'), h('a', { class: 'btn', href: '#/progreso' }, 'Ver progreso')));
  } else {
    const done = P.isDone(d.n);
    root.append(h('div', { class: 'card' }, h('div', { class: 'btn-row', style: 'margin:0 0 6px;align-items:center' }, h('span', { class: 'pill' }, `Día ${d.n} de ${plan.meta.total}`), pillFor(d), done ? h('span', { class: 'pill good' }, '✔ completado') : null, h('span', { class: 'pill' }, `${d.minutes} min`)),
      h('h2', null, d.title), h('p', null, d.focus), h('p', { class: 'small muted' }, d.phase + ' · semana ' + d.week + (d.status === 'skeleton' ? ' · contenido detallado pendiente (sesión guiada genérica)' : '')),
      h('a', { class: 'btn', href: `#/dia/${d.n}` }, done ? 'Ver / repetir sesión' : 'Empezar la sesión de hoy')));
  }

  // Atrasados
  const back = P.backlog();
  if (back.length) {
    root.append(h('div', { class: 'card' }, h('h2', null, `Días atrasados (${back.length})`), h('p', { class: 'muted' }, 'Puedes recuperarlos sin perder el hilo; empieza por el más antiguo.'),
      h('div', { class: 'days' }, back.slice(0, 8).map((x) => h('a', { class: `daycell ${SKILL_CLASS(x)} missed`, href: `#/dia/${x.n}` }, h('div', { class: 'd' }, `Día ${x.n}`), h('div', null, x.title), h('div', { class: 'tag' }, fmtDate(x.date)))))
      , back.length > 8 ? h('p', { class: 'small' }, `… y ${back.length - 8} más en el `, h('a', { href: '#/plan' }, 'plan'), '.') : null));
  }

  // Repasos pendientes
  const due = dueCounts();
  if (due.vocab + due.errors > 0) root.append(h('div', { class: 'card' }, h('h2', null, 'Repaso espaciado pendiente'), h('p', null, `${due.vocab} palabra(s) y ${due.errors} pregunta(s) fallada(s) te esperan (≈ ${Math.ceil((due.vocab * 0.5 + due.errors * 1.5))} min).`), h('a', { class: 'btn', href: '#/repaso' }, 'Hacer el repaso')));

  const pr = P.progressPct(), st = S.streak(), lw = S.learnedWords();
  root.append(h('h2', null, 'Tu progreso'), h('div', { class: 'grid' },
    statTile(`${st.current} 🔥`, `racha de días (mejor: ${st.best})`), statTile(Math.round(S.totalMinutes()), 'minutos estudiados'),
    statTile(`${pr.pct.toFixed(0)} %`, `del plan (${pr.done}/${pr.total} días)`), statTile(`${lw.learned}/${lw.total}`, 'palabras aprendidas / vistas')),
    h('p', null, h('a', { href: '#/progreso' }, 'Ver panel completo →')));
  return root;
}

// ---------------- PLAN ----------------
export async function viewPlan() {
  const plan = await P.loadPlan();
  const root = h('div', null, h('h1', null, 'Plan de 75 días'),
    h('p', { class: 'muted' }, `${fmtDate(plan.meta.start, { day: 'numeric', month: 'long' })} → ${fmtDate(plan.meta.end, { day: 'numeric', month: 'long', year: 'numeric' })}. Examen: ${fmtDate(plan.meta.exam, { day: 'numeric', month: 'long', year: 'numeric' })}. Cada semana rota Reading, Listening, Writing y Speaking; el día 7 es repaso + mini-simulacro y cada dos semanas hay un simulacro largo.`));
  const full = plan.days.filter((d) => d.status === 'full').length;
  root.append(h('div', { class: 'notice info' }, `Contenido detallado listo para ${full} de ${plan.days.length} días. Los demás tienen tema y sesión guiada (esqueleto) y se irán completando.`));
  root.append(h('div', { class: 'legend' }, [['reading', 'Reading'], ['listening', 'Listening'], ['writing', 'Writing'], ['speaking', 'Speaking']].map(([k, l]) => h('span', null, h('i', { style: `background:var(--c-${k})` }), l)), h('span', null, '✔ verde = completado · rojo = atrasado · borde azul = hoy')));
  const weeks = [...new Set(plan.days.map((d) => d.week))];
  for (const w of weeks) {
    const ds = plan.days.filter((d) => d.week === w);
    root.append(h('section', { class: 'week' }, h('h2', null, `Semana ${w} `, h('small', null, ds[0].phase)),
      h('div', { class: 'days' }, ds.map((d) => {
        const st = P.statusOf(d);
        return h('a', { class: `daycell ${SKILL_CLASS(d)} ${st === 'done' ? 'done' : st === 'today' ? 'today' : st === 'missed' ? 'missed' : ''}`, href: `#/dia/${d.n}`, 'aria-label': `Día ${d.n}, ${fmtDate(d.date)}: ${d.title}. ${st === 'done' ? 'Completado' : st === 'missed' ? 'Atrasado' : st === 'today' ? 'Hoy' : ''}` },
          h('div', { class: 'd' }, `${st === 'done' ? '✔ ' : ''}Día ${d.n}`, h('span', { class: 'muted' }, ` · ${fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}`)),
          h('div', null, d.title), h('div', { class: 'tag' }, `${SKILL_LABEL[d.skill]} · ${d.minutes} min${d.status === 'skeleton' ? ' · esqueleto' : ''}`));
      }))));
  }
  return root;
}

// ---------------- DÍA ----------------
const MODE_REFUERZO = { 60: 0, 90: 10, 120: 25 };

function stepEl({ id, title, minutes, optional, open }, build, dayN) {
  const s = store.get();
  const isDoneNow = () => !!(s.days[dayN] && s.days[dayN].steps && s.days[dayN].steps[id]);
  const d = h('details', { class: 'step' + (isDoneNow() ? ' done' : ''), id: 'step-' + id });
  if (open) d.open = true;
  const sum = h('summary', null, h('span', { class: 'check', 'aria-hidden': 'true' }, '✓'), title, optional ? h('span', { class: 'pill' }, 'opcional') : null, h('span', { class: 'mins' }, `${minutes} min`));
  const body = h('div', { class: 'step-body' });
  let built = false;
  const ensure = async () => {
    if (built) return; built = true;
    body.replaceChildren(h('p', { class: 'muted' }, 'Cargando…'));
    try { body.replaceChildren(await build((stepId) => markStep(dayN, stepId || id, d))); } catch (e) { body.replaceChildren(h('div', { class: 'notice bad' }, e.message)); }
  };
  d.append(sum, body);
  d.addEventListener('toggle', () => { if (d.open) ensure(); });
  if (open) ensure();
  return d;
}

function markStep(n, id, el) {
  store.update((s) => { const dd = (s.days[n] ||= { done: false, steps: {} }); (dd.steps ||= {})[id] = true; });
  if (el) el.classList.add('done');
  const nodes = document.querySelectorAll(`#step-${CSS.escape(id)}`); nodes.forEach((x) => x.classList.add('done'));
}

function refuerzo(day, prompts, resources, mode) {
  return async () => {
    const wrap = h('div');
    const diag = Object.values(store.get().diagnostic).filter(Boolean).length;
    if (!S.weakestSkills().length) {
      wrap.append(h('div', { class: 'notice info' }, 'Aún no hay datos para personalizar el refuerzo. Haz el ', h('a', { href: '#/diagnostico' }, 'diagnóstico'), ' (o completa algunos quizzes) y aquí verás tu perfil.'));
      return wrap;
    }
    const weights = S.skillWeights();
    const minutes = MODE_REFUERZO[mode];
    wrap.append(h('p', null, `Reparto sugerido de tu tiempo de refuerzo (${minutes || 10} min) según tu perfil actual:`),
      h('table', { class: 'simple' }, h('thead', null, h('tr', null, ['Habilidad', 'Banda estimada', 'Peso', 'Minutos'].map((x) => h('th', null, x)))),
        h('tbody', null, SKILLS.map((k) => h('tr', null, h('td', null, SKILL_SHORT[k]), h('td', null, S.skillBand(k) ?? '–'), h('td', null, `${Math.round(weights[k] * 100)} %`), h('td', null, Math.round((minutes || 10) * weights[k])))))));
    const weakest = S.weakestSkills().filter((k) => k !== day.skill)[0] || S.weakestSkills()[0];
    wrap.append(h('h3', null, `Tarea de refuerzo: ${SKILL_SHORT[weakest]} (tu punto más débil${weakest === day.skill ? '' : ' fuera de la habilidad de hoy'})`));
    const idx = (day.n * 7) % 9973;
    if (weakest === 'writing' && prompts.writing.length) {
      const p = prompts.writing[idx % prompts.writing.length];
      wrap.append(await renderBlock({ ...p, kind: 'writing', id: `rf-${p.id}` }, { day: day.n, skill: 'writing', kind: 'practice' }));
    } else if (weakest === 'speaking' && prompts.speaking.length) {
      const p = prompts.speaking[idx % prompts.speaking.length];
      wrap.append(await renderBlock({ ...p, kind: 'speaking', task: 'interview', id: `rf-${p.id}` }, { day: day.n, skill: 'speaking', kind: 'practice' }));
    } else {
      const r = resources.authentic[idx % resources.authentic.length];
      wrap.append(authenticBlock({ id: `rf-${r.id}`, resource: r, steps: r.steps }, { day: day.n, skill: weakest }));
      wrap.append(h('p', null, h('a', { href: `#/repaso?skill=${weakest}` }, `Practicar tus errores de ${SKILL_SHORT[weakest]} →`)));
    }
    return wrap;
  };
}

export async function viewDay(parts) {
  const plan = await P.loadPlan();
  const n = clamp(parseInt(parts[0], 10) || 1, 1, plan.days.length);
  const d = plan.days[n - 1];
  const s = store.get();
  const mode = s.settings.mode;
  const [prompts, resources, vids] = await Promise.all([fetchJSON('data/prompts.json'), fetchJSON('data/resources.json'), fetchJSON('data/videos.json')]);
  let content = null;
  if (d.status === 'full') content = await P.loadDay(n);

  const root = h('div');
  root.append(h('p', { class: 'small' }, n > 1 ? h('a', { href: `#/dia/${n - 1}` }, '← Día ' + (n - 1)) : '', n > 1 && n < plan.days.length ? ' · ' : '', n < plan.days.length ? h('a', { href: `#/dia/${n + 1}` }, 'Día ' + (n + 1) + ' →') : '', ' · ', h('a', { href: '#/plan' }, 'Plan')));
  root.append(h('h1', null, `Día ${n}: ${d.title}`));
  root.append(h('div', { class: 'btn-row', style: 'margin-top:0' }, pillFor(d), h('span', { class: 'pill' }, fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long' })), h('span', { class: 'pill' }, d.phase), d.status === 'skeleton' ? h('span', { class: 'pill warn' }, 'Esqueleto: contenido pendiente') : h('span', { class: 'pill good' }, 'Contenido completo')));

  if (d.type === 'rest') {
    root.append(await restDay(n));
    return root;
  }

  const objectives = content?.objectives || [d.focus];
  root.append(h('div', { class: 'card' }, h('h2', null, 'Objetivos de hoy'), h('ul', null, objectives.map((o) => h('li', null, o)))));

  // Simulacros
  if (d.mock) {
    const mockExists = !!d.mockReady;
    root.append(h('div', { class: 'card' }, h('h2', null, d.type === 'mock-long' ? 'Simulacro largo' : 'Mini-simulacro'),
      mockExists ? h('p', null, 'Hazlo en un lugar tranquilo, con auriculares, sin pausar. Cada sección tiene su propio temporizador.') : h('div', { class: 'notice' }, 'El contenido de este simulacro aún no está escrito. Mientras tanto, haz un simulacro oficial gratuito de práctica en la página de ETS (ver Recursos) y registra aquí lo que falló.'),
      mockExists ? h('a', { class: 'btn', href: `#/simulacro/${d.mock}` }, 'Abrir simulacro') : h('a', { class: 'btn btn-secondary', href: '#/recursos' }, 'Ir a Recursos')));
  }

  const steps = h('div', { class: 'steps' });
  const R = (extra) => ({ day: n, skill: d.skill, kind: 'practice', maxPlays: s.settings.examAudio ? 1 : undefined, ...extra });
  const list = [];

  // 1. Calentamiento de vocabulario
  if (content?.vocab) {
    list.push({ id: 'warmup', title: `Calentamiento: vocabulario académico${content.vocab.theme ? ' · ' + content.vocab.theme : ''}`, minutes: 10, build: async (done) => vocabBlock(content.vocab.words, { day: n, onDone: () => done('warmup') }) });
  } else {
    list.push({ id: 'warmup', title: 'Calentamiento: vocabulario', minutes: 10, build: async (done) => h('div', null,
      h('p', null, 'Esta sesión aún no trae lista de palabras propia. Haz esto en su lugar (10 min):'),
      h('ol', null, h('li', null, 'Repasa las tarjetas pendientes del repaso espaciado: ', h('a', { href: '#/repaso' }, 'Repaso →')), h('li', null, `Elige 10 palabras nuevas de la Academic Word List (por ejemplo, la sublista ${Math.min(10, Math.ceil(n / 8))}) y escribe una oración propia con cada una.`)),
      h('button', { class: 'btn', type: 'button', onclick: () => done('warmup') }, 'Marcar como hecho')) });
  }

  // 2. Mini-lección (+ videos)
  list.push({ id: 'lesson', title: 'Mini-lección', minutes: 15, build: async (done) => {
    const box = h('div');
    const band = ['reading', 'listening', 'writing', 'speaking'].includes(d.skill) ? S.skillBand(d.skill) : null;
    if (band !== null && band >= 5) box.append(h('div', { class: 'notice good' }, `Tu nivel estimado en ${SKILL_SHORT[d.skill]} ya es alto (banda ${band}). Si el tema te resulta familiar, ojea la lección, márcala como vista y ve directo a la práctica.`));
    if (content?.lesson) box.append(h('div', { class: 'md', html: renderMarkdown(await fetchText(content.lesson)) }));
    else box.append(h('div', { class: 'md' }, h('p', null, h('strong', null, 'Tema: '), d.focus), h('p', null, 'La lección escrita de este día aún no está disponible. Mientras tanto, mira un video sobre el tema y toma notas de 3 estrategias clave.')));
    const vb = content?.videos || { ids: [], search: `TOEFL iBT 2026 ${d.title}` };
    box.append(h('h3', null, 'Video recomendado'), await videoBlock(vb));
    box.append(h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: () => done('lesson') }, 'Marcar lección como vista')));
    return box;
  } });

  // 3. Práctica aplicada
  if (content?.practice?.length) {
    content.practice.forEach((b, i) => list.push({ id: `practice-${b.id || i}`, title: `Práctica: ${b.title}`, minutes: b.minutes || 20, build: async (done) => renderBlock({ ...b, skill: b.skill || d.skill }, R({ onDone: () => done(`practice-${b.id || i}`) })) }));
  } else if (d.mock) {
    // el simulacro ya es la práctica
  } else {
    list.push({ id: 'practice-generic', title: `Práctica guiada de ${SKILL_LABEL[d.skill]}`, minutes: 30, build: refuerzoGeneric(d, prompts, resources) });
  }

  // 4. Mini-quiz
  if (content?.quiz?.length) {
    list.push({ id: 'quiz', title: 'Mini-quiz estilo TOEFL', minutes: 10, build: async (done) => createQuestionSet(content.quiz, { skill: d.skill, day: n, kind: 'quiz', ctx: { title: 'Mini-quiz del día ' + n }, onDone: () => done('quiz') }).el });
  }

  // 5. Refuerzo personalizado (según el perfil del diagnóstico)
  const rfMin = MODE_REFUERZO[mode];
  list.push({ id: 'refuerzo', title: 'Refuerzo personalizado (según tu perfil)', minutes: rfMin || 10, optional: mode === 60, build: async (done) => { const el = await refuerzo(d, prompts, resources, mode)(); el.append(h('div', { class: 'btn-row' }, h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => done('refuerzo') }, 'Marcar refuerzo como hecho'))); return el; } });

  // 6. Repaso de errores
  const due = dueCounts();
  list.push({ id: 'review', title: 'Revisión de errores y repaso espaciado', minutes: 8, build: async (done) => h('div', null,
    h('p', null, `Pendientes hoy: ${due.vocab} palabras y ${due.errors} preguntas falladas.`),
    h('p', { class: 'muted' }, 'Revisar los errores el mismo día y luego a 1, 2, 4, 8… días es lo que más fija el aprendizaje.'),
    h('div', { class: 'btn-row' }, h('a', { class: 'btn', href: '#/repaso' }, 'Ir al repaso'), h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => done('review') }, 'Marcar como hecho'))) });

  const total = list.filter((x) => !x.optional).reduce((a, x) => a + x.minutes, 0);
  root.append(h('p', { class: 'muted' }, `Duración estimada en tu modo de ${mode} min: ≈ ${Math.max(total, 30)} min ` , h('span', { class: 'small' }, '(cámbialo en '), h('a', { href: '#/ajustes' }, 'Ajustes'), h('span', { class: 'small' }, ').')));
  const firstOpen = list.find((x) => !(s.days[n]?.steps?.[x.id]));
  list.forEach((x) => steps.append(stepEl({ ...x, open: firstOpen && firstOpen.id === x.id }, x.build, n)));
  root.append(steps);

  // Cierre del día
  const logged = Math.round(s.minutesByDate[today()] || 0);
  const minInput = h('input', { type: 'number', id: 'min-input', min: 0, max: 480, value: Math.max(sessionMinutes(), d.minutes), 'aria-describedby': 'min-hint' });
  const finishMsg = h('div', { role: 'status', 'aria-live': 'polite' });
  const already = P.isDone(n);
  root.append(h('div', { class: 'card' }, h('h2', null, already ? '✔ Día completado' : 'Cerrar la sesión'),
    h('p', { id: 'min-hint', class: 'small muted' }, `Cronómetro hoy: ${logged} min registrados. Si no usaste el cronómetro, indica los minutos que estudiaste.`),
    h('label', { for: 'min-input' }, 'Minutos estudiados en esta sesión: '), minInput,
    h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: () => {
      const entered = clamp(Number(minInput.value) || 0, 0, 480);
      store.update((st) => {
        const dd = (st.days[n] ||= { done: false, steps: {} });
        dd.done = true; dd.completedAt = today(); dd.minutes = entered;
        const cur = st.minutesByDate[today()] || 0;
        if (entered > cur) st.minutesByDate[today()] = entered;
      });
      finishMsg.replaceChildren(h('div', { class: 'notice good' }, `¡Día ${n} completado! Racha actual: ${S.streak().current} día(s). `, n < plan.days.length ? h('a', { href: `#/dia/${n + 1}` }, 'Ir al día siguiente →') : ''));
    } }, already ? 'Actualizar minutos' : 'Marcar día como completado')), finishMsg));
  return root;
}

function refuerzoGeneric(d, prompts, resources) {
  return async (done) => {
    const wrap = h('div', null, h('div', { class: 'notice' }, 'Este día todavía no tiene su contenido específico. Esta es una práctica guiada genérica con material del banco general:'));
    const idx = d.n * 5;
    if (d.skill === 'writing' || (d.skill === 'mixed' && d.n % 2)) {
      const p = prompts.writing[idx % prompts.writing.length];
      wrap.append(await renderBlock({ ...p, kind: 'writing', id: `g-${p.id}` }, { day: d.n, skill: 'writing', kind: 'practice', onDone: () => done('practice-generic') }));
    } else if (d.skill === 'speaking') {
      const p = prompts.speaking[idx % prompts.speaking.length];
      wrap.append(await renderBlock({ ...p, kind: 'speaking', task: 'interview', id: `g-${p.id}` }, { day: d.n, skill: 'speaking', kind: 'practice', onDone: () => done('practice-generic') }));
    } else {
      const r = resources.authentic[idx % resources.authentic.length];
      wrap.append(authenticBlock({ id: `g-${r.id}`, resource: r, steps: r.steps }, { day: d.n, skill: d.skill, onDone: () => done('practice-generic') }));
    }
    return wrap;
  };
}

async function restDay(n) {
  const tips = await fetchText('data/lessons/exam-day.md');
  return h('div', null, h('div', { class: 'notice good' }, 'Hoy descansa: nada de estudio nuevo. Repasar 15 minutos de vocabulario es opcional.'),
    h('div', { class: 'card md', html: renderMarkdown(tips) }),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: () => { store.update((st) => { st.days[n] = { done: true, steps: {}, completedAt: today(), minutes: 0 }; }); window.toefl.toast('¡Todo listo! Mucho éxito mañana.'); } }, 'Marcar día de descanso como hecho')));
}
