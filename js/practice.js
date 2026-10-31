// Bloques de práctica reutilizables: lectura, escucha, escritura, speaking, material auténtico, vocabulario, video.
import { h, today, countWords, clamp, roundHalf, fmtClock, fetchJSON, mean } from './util.js';
import * as store from './store.js';
import { renderMarkdown } from './md.js';
import { createQuestionSet } from './quiz.js';
import { createPlayer } from './audio.js';
import { createRecorder } from './recorder.js';
import { newEntry, schedule } from './srs.js';

const md = (src, cls = 'md') => h('div', { class: cls, html: renderMarkdown(src) });

// ---------- Texto largo / pasajes ----------
function passageEl(b) {
  const paras = b.passage.split(/\n\n+/);
  const cls = b.subtype === 'daily' ? 'passage daily' : 'passage';
  if (b.subtype === 'daily') return h('div', { class: cls, role: 'region', 'aria-label': 'Texto' }, b.passage);
  return h('div', { class: cls, role: 'region', 'aria-label': 'Pasaje de lectura', tabindex: 0 }, b.title ? h('h4', null, b.title) : null, paras.map((p) => h('p', null, p)));
}

/** kind: 'questions' | 'reading' | 'listening' */
export function questionsBlock(b, ctx) {
  const wrap = h('div');
  if (b.intro) wrap.append(md(b.intro));
  let player = null;
  if (b.passage) wrap.append(passageEl(b));
  if (b.audio) {
    player = createPlayer(b.audio, { maxPlays: ctx.maxPlays });
    wrap.append(player.el);
    if (b.noteTaking !== false) {
      const key = 'n:' + b.id;
      const ta = h('textarea', { id: 'notes-' + b.id, rows: 5, placeholder: 'Toma notas mientras escuchas (palabras clave, números, causas, contrastes)…', 'aria-label': 'Tus notas' });
      ta.value = store.get().drafts[key] || '';
      ta.addEventListener('input', () => store.update((s) => { s.drafts[key] = ta.value; }));
      wrap.append(h('label', { for: 'notes-' + b.id, class: 'small muted' }, 'Notas (se guardan en tu navegador):'), ta);
    }
  }
  const qctx = { title: b.title, passage: b.passage, subtype: b.subtype, audio: b.audio };
  const qs = createQuestionSet(b.items, {
    skill: b.skill || ctx.skill, day: ctx.day, kind: ctx.kind, ctx: qctx, maxPlays: ctx.maxPlays, fresh: ctx.fresh,
    onDone: (sum) => { if (player) player.reveal(); ctx.onDone && ctx.onDone(b.id, sum); },
  });
  wrap.append(qs.el);
  return wrap;
}

// ---------- Escritura ----------
const CONNECTORS = ['however', 'therefore', 'for example', 'for instance', 'in addition', 'moreover', 'furthermore', 'although', 'while', 'because', 'since', 'as a result', 'on the other hand', 'in contrast', 'first', 'second', 'finally', 'in conclusion', 'such as', 'despite', 'whereas', 'consequently', 'thus'];

export const WRITING_RUBRIC = [
  ['task', 'Cumple la tarea', 'Responde a todos los puntos del prompt, con ideas relevantes y desarrolladas.'],
  ['org', 'Organización y coherencia', 'Orden lógico, párrafos o bloques claros y conectores que guían al lector.'],
  ['gram', 'Gramática y precisión', 'Oraciones variadas y correctas; los errores no dificultan la comprensión.'],
  ['vocab', 'Vocabulario y registro', 'Palabras precisas y tono adecuado (formal/neutral) al destinatario.'],
];
export const SPEAKING_RUBRIC = [
  ['clarity', 'Claridad y pronunciación', 'Se entiende sin esfuerzo; acentuación y entonación naturales.'],
  ['fluency', 'Fluidez y ritmo', 'Pocas pausas y muletillas; ritmo constante.'],
  ['develop', 'Desarrollo del tema', 'Respuesta directa + razón + ejemplo; aprovecha el tiempo.'],
  ['lang', 'Gramática y vocabulario', 'Estructuras variadas y vocabulario preciso con pocos errores.'],
];
const DESCRIPTORS = ['0 · No lo hice / vacío', '1 · Muy limitado', '2 · Limitado', '3 · Adecuado con fallos', '4 · Bueno', '5 · Muy bueno'];

function rubricForm(rubric, onSave, saved) {
  const selects = rubric.map(([k, label, desc]) => {
    const sel = h('select', { id: 'rb-' + k + Math.random().toString(36).slice(2, 6), 'aria-label': label }, DESCRIPTORS.map((d, i) => h('option', { value: i, selected: saved ? saved[k] === i : i === 3 }, d)));
    return { k, sel, label, desc };
  });
  const out = h('div', { role: 'status', 'aria-live': 'polite' });
  const form = h('div', { class: 'rubric' }, selects.map((r) => h('div', { class: 'row' }, h('div', null, h('strong', null, r.label), h('small', null, r.desc)), r.sel)),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: () => {
      const scores = {}; selects.forEach((r) => { scores[r.k] = Number(r.sel.value); });
      const avg = mean(Object.values(scores));
      onSave(scores, avg);
      out.replaceChildren(h('div', { class: 'notice good' }, `Autoevaluación guardada: promedio ${avg.toFixed(1)}/5 → banda estimada ${clamp(roundHalf(1 + avg), 1, 6)}. Sé honesto/a: tendemos a calificarnos por encima; compara con la respuesta modelo.`));
    } }, 'Guardar autoevaluación')), out);
  return form;
}

function saveEval(ctx, skill, taskId, scores, avg) {
  store.update((s) => {
    s.evals = s.evals.filter((e) => e.task !== taskId);
    s.evals.push({ date: today(), day: ctx.day ?? null, skill, task: taskId, avg, band: clamp(roundHalf(1 + avg), 1, 6), scores, kind: ctx.kind || 'practice' });
    s.answers['eval:' + taskId] = { ans: scores, pts: 0, max: 0 };
  });
}

export function textMetrics(text) {
  const words = text.trim().match(/[A-Za-z'’-]+/g) || [];
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter((x) => x.trim()).length;
  const lower = text.toLowerCase();
  const conn = CONNECTORS.filter((c) => new RegExp('\\b' + c + '\\b').test(lower));
  const freq = {};
  words.forEach((w) => { const k = w.toLowerCase(); if (k.length > 4) freq[k] = (freq[k] || 0) + 1; });
  const repeated = Object.entries(freq).filter(([, n]) => n >= 4).map(([w, n]) => `${w} (${n})`);
  const uniq = new Set(words.map((w) => w.toLowerCase())).size;
  return { words: words.length, sentences, avg: sentences ? words.length / sentences : 0, conn, repeated, ttr: words.length ? uniq / words.length : 0 };
}

export function writingBlock(b, ctx) {
  const key = 'w:' + b.id;
  const wrap = h('div');
  wrap.append(h('div', { class: 'card' }, md(b.prompt)));
  if (b.vocab) wrap.append(h('details', { class: 'reveal' }, h('summary', null, 'Vocabulario y frases útiles'), md(b.vocab)));
  if (b.template) wrap.append(h('details', { class: 'reveal' }, h('summary', null, 'Plantilla / estructura sugerida'), md(b.template)));
  const ta = h('textarea', { id: 'ta-' + b.id, rows: 10, 'aria-label': 'Tu respuesta en inglés', placeholder: 'Write your response here…', spellcheck: 'true', lang: 'en' });
  ta.value = store.get().drafts[key] || '';
  const count = h('span', { class: 'small muted', 'aria-live': 'polite' });
  const upd = () => { const n = countWords(ta.value); count.textContent = `${n} palabras` + (b.minWords ? ` (objetivo: ${b.minWords}+)` : ''); };
  let saveT;
  ta.addEventListener('input', () => { upd(); clearTimeout(saveT); saveT = setTimeout(() => store.update((s) => { s.drafts[key] = ta.value; }), 400); });
  upd();
  const minutes = b.minutes || 10;
  let left = minutes * 60, tm = null;
  const clock = h('span', { class: 'timer-display', role: 'timer' }, fmtClock(left));
  const startT = h('button', { class: 'btn btn-secondary btn-small', type: 'button' }, `⏱ Temporizador ${minutes} min`);
  startT.addEventListener('click', () => {
    if (tm) { clearInterval(tm); tm = null; startT.textContent = '⏱ Reanudar'; return; }
    startT.textContent = '⏸ Pausar';
    tm = setInterval(() => { left--; clock.textContent = fmtClock(left); if (left <= 0) { clearInterval(tm); tm = null; startT.textContent = 'Tiempo terminado'; } }, 1000);
  });
  const after = h('div', { hidden: true });
  const doneBtn = h('button', { class: 'btn', type: 'button' }, 'Terminé: ver análisis y respuesta modelo');
  doneBtn.addEventListener('click', () => {
    if (countWords(ta.value) < 5) { after.hidden = false; after.replaceChildren(h('div', { class: 'notice' }, 'Escribe primero tu respuesta (aunque sea corta) para poder compararla con el modelo.')); return; }
    if (tm) { clearInterval(tm); tm = null; }
    const m = textMetrics(ta.value);
    const warn = [];
    if (b.minWords && m.words < b.minWords) warn.push(`Tu texto tiene ${m.words} palabras; el objetivo era ${b.minWords}+.`);
    if (m.avg && m.avg < 8) warn.push('Tus oraciones son muy cortas; combina ideas con conectores.');
    if (m.avg > 28) warn.push('Tus oraciones son muy largas; divídelas para ganar claridad.');
    if (m.conn.length < 2 && m.words > 40) warn.push('Usaste pocos conectores (however, for example, because…).');
    if (m.repeated.length) warn.push('Palabras repetidas: ' + m.repeated.join(', ') + ' — busca sinónimos.');
    after.hidden = false;
    after.replaceChildren(
      h('div', { class: 'card' }, h('h3', null, 'Análisis automático (aproximado)'),
        h('p', null, `Palabras: ${m.words} · Oraciones: ${m.sentences} · Promedio: ${m.avg.toFixed(1)} palabras/oración · Variedad léxica: ${(m.ttr * 100).toFixed(0)} % · Conectores detectados: ${m.conn.length ? m.conn.join(', ') : 'ninguno'}.`),
        warn.length ? h('ul', null, warn.map((w) => h('li', null, w))) : h('p', { class: 'muted' }, 'Sin alertas automáticas. Esto no revisa gramática: usa la lista de verificación.')),
      b.checklist ? h('div', { class: 'card' }, h('h3', null, 'Lista de verificación'), h('ul', { class: 'checklist' }, b.checklist.map((c, i) => h('li', null, h('label', null, h('input', { type: 'checkbox', id: `${b.id}-c${i}` }), ' ', c))))) : null,
      b.model ? h('details', { class: 'reveal', open: true }, h('summary', null, 'Respuesta modelo (compara estructura, no copies frases)'), md(b.model, 'md'), b.modelNotes ? md(b.modelNotes) : null) : null,
      h('div', { class: 'card' }, h('h3', null, 'Autoevaluación con rúbrica'), rubricForm(WRITING_RUBRIC, (scores, avg) => { saveEval(ctx, 'writing', b.id, scores, avg); ctx.onDone && ctx.onDone(b.id, { avg }); }, (store.get().answers['eval:' + b.id] || {}).ans)));
  });
  wrap.append(h('div', { class: 'btn-row' }, startT, clock, count), ta, h('div', { class: 'btn-row' }, doneBtn), after);
  return wrap;
}

// ---------- Speaking ----------
export function speakingBlock(b, ctx) {
  const wrap = h('div');
  if (b.intro) wrap.append(md(b.intro));
  if (b.task === 'repeat') {
    const scores = {};
    const out = h('div', { role: 'status', 'aria-live': 'polite' });
    const maxPlays = ctx.maxPlays || 2;
    b.items.forEach((it, i) => {
      const player = createPlayer(it.audio, { maxPlays });
      const rec = createRecorder({ prepSeconds: 0, speakSeconds: it.seconds || 12, label: `Oración ${i + 1}: repite exactamente lo que oíste` });
      const reveal = h('div', { class: 'expl', hidden: true });
      const radios = ['Todas las palabras', 'Casi (me faltó/cambié 1-2)', 'No'].map((t, j) => h('label', { class: 'opt' }, h('input', { type: 'radio', name: `rp-${b.id}-${i}`, value: [1, .5, 0][j], onchange: (e) => { scores[i] = Number(e.target.value); reveal.hidden = false; reveal.replaceChildren(h('strong', null, 'Texto: '), `“${it.text}” `, it.tip || ''); } }), h('span', null, t)));
      wrap.append(h('div', { class: 'card' }, h('h3', null, `Oración ${i + 1}`), player.el, rec.el, h('fieldset', { class: 'q' }, h('legend', null, '¿Repetiste todas las palabras en el mismo orden?'), radios), reveal));
    });
    wrap.append(h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: () => {
      const n = b.items.length;
      if (Object.keys(scores).length < n) { out.replaceChildren(h('div', { class: 'notice' }, 'Califica todas las oraciones antes de guardar.')); return; }
      const pts = Object.values(scores).reduce((a, c) => a + c, 0);
      store.update((s) => {
        if (!s.answers['sp:' + b.id]) {
          s.attempts.push({ date: today(), day: ctx.day ?? null, skill: 'speaking', qtype: 'listen-repeat', pts, max: n, kind: ctx.kind || 'practice', itemId: b.id });
          s.answers['sp:' + b.id] = { ans: scores, pts, max: n };
        }
      });
      out.replaceChildren(h('div', { class: 'notice good' }, `Guardado: ${pts}/${n} en Listen and Repeat.`));
      ctx.onDone && ctx.onDone(b.id, { pts, max: n });
    } }, 'Guardar resultado')), out);
    return wrap;
  }
  // interview / free
  (b.questions || []).forEach((q, i) => {
    const card = h('div', { class: 'card' }, h('h3', null, `Pregunta ${i + 1}`), q.audio ? createPlayer(q.audio, { maxPlays: 3 }).el : null, h('p', null, h('strong', null, q.q)));
    if (q.hint) card.append(h('p', { class: 'small muted' }, q.hint));
    card.append(createRecorder({ prepSeconds: q.prep ?? b.prep ?? 0, speakSeconds: q.seconds || b.seconds || 45, label: 'Tu respuesta' }).el);
    if (q.model) card.append(h('details', { class: 'reveal' }, h('summary', null, 'Ver respuesta modelo (después de grabar la tuya)'), md(q.model)));
    wrap.append(card);
  });
  if (b.checklist) wrap.append(h('div', { class: 'card' }, h('h3', null, 'Lista de verificación'), h('ul', { class: 'checklist' }, b.checklist.map((c, i) => h('li', null, h('label', null, h('input', { type: 'checkbox' }), ' ', c))))));
  wrap.append(h('div', { class: 'card' }, h('h3', null, 'Autoevaluación con rúbrica'), rubricForm(SPEAKING_RUBRIC, (scores, avg) => { saveEval(ctx, 'speaking', b.id, scores, avg); ctx.onDone && ctx.onDone(b.id, { avg }); }, (store.get().answers['eval:' + b.id] || {}).ans)));
  return wrap;
}

// ---------- Material auténtico ----------
export function authenticBlock(b, ctx) {
  const key = 'a:' + b.id;
  const wrap = h('div');
  wrap.append(h('div', { class: 'card' }, h('h3', null, b.resource.name), b.resource.note ? h('p', { class: 'muted' }, b.resource.note) : null,
    h('p', null, h('a', { href: b.resource.url, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir recurso ↗'), b.resource.verified === false ? h('span', { class: 'pill warn', style: 'margin-left:8px' }, 'URL de portada; busca el episodio indicado') : null),
    h('ol', null, (b.steps || []).map((s) => h('li', null, s)))));
  const notes = h('textarea', { rows: 5, 'aria-label': 'Notas', placeholder: 'Notes: key ideas, numbers, examples…' });
  const sum = h('textarea', { rows: 4, 'aria-label': 'Resumen', placeholder: 'Summary (2-3 sentences in your own words)…' });
  const saved = store.get().drafts[key] || {};
  notes.value = saved.notes || ''; sum.value = saved.sum || '';
  const persist = () => store.update((s) => { s.drafts[key] = { notes: notes.value, sum: sum.value }; });
  notes.addEventListener('input', persist); sum.addEventListener('input', persist);
  wrap.append(h('label', { class: 'small muted' }, 'Tus notas'), notes, h('label', { class: 'small muted' }, 'Tu resumen (usa tus propias palabras)'), sum,
    h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: () => ctx.onDone && ctx.onDone(b.id, {}) }, 'Marcar como hecho')));
  return wrap;
}

// ---------- Video ----------
export async function videoBlock(b) {
  const vids = await fetchJSON('data/videos.json');
  const wrap = h('div');
  for (const ref of b.ids || []) {
    const v = vids.find((x) => x.id === ref);
    if (!v) continue;
    wrap.append(videoCard(v));
  }
  if (b.search) wrap.append(h('p', { class: 'small' }, 'Más: ', h('a', { href: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(b.search), target: '_blank', rel: 'noopener noreferrer' }, `buscar «${b.search}» en YouTube ↗`)));
  return wrap;
}

export function videoCard(v) {
  const frame = h('div', { class: 'frame' });
  const load = () => {
    frame.replaceChildren(h('iframe', { src: `https://www.youtube-nocookie.com/embed/${v.yt}?rel=0`, title: v.title, allow: 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin' }));
  };
  frame.append(h('div', { class: 'facade' }, h('button', { class: 'btn', type: 'button', onclick: load }, '▶ Cargar video (youtube-nocookie)')));
  return h('div', { class: 'vid' }, h('strong', null, v.title),
    h('div', { class: 'small muted' }, v.channel ? `Canal: ${v.channel}. ` : '', v.note || ''),
    frame,
    h('div', { class: 'small' }, h('a', { href: `https://www.youtube.com/watch?v=${v.yt}`, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir en YouTube ↗'), ' · ', h('a', { href: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(v.search || v.title), target: '_blank', rel: 'noopener noreferrer' }, 'Buscar similares ↗')));
}

// ---------- Vocabulario (tarjetas) ----------
/** words: [[w,pos,def,es,ex], ...] ; day: número. Añade las palabras al repaso espaciado. */
export function vocabBlock(words, ctx) {
  const wrap = h('div');
  const cards = words.map(([w, pos, def, es, ex]) => ({ w, pos, def, es, ex }));
  let i = 0;
  const area = h('div', { class: 'card', 'aria-live': 'polite' });
  const prog = h('div', { class: 'small muted' });
  const table = h('details', { class: 'reveal' }, h('summary', null, 'Ver lista completa'), h('table', { class: 'simple' },
    h('thead', null, h('tr', null, ['Palabra', 'Significado', 'ES', 'Ejemplo'].map((t) => h('th', null, t)))),
    h('tbody', null, cards.map((c) => h('tr', null, h('td', null, h('strong', null, c.w), ' ', h('span', { class: 'muted' }, c.pos)), h('td', null, c.def), h('td', null, c.es), h('td', null, c.ex))))));
  function speak(txt) { if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.lang = 'en-US'; u.rate = .9; window.speechSynthesis.speak(u); } }
  function show() {
    if (i >= cards.length) {
      area.replaceChildren(h('div', { class: 'notice good' }, `Listo: ${cards.length} palabras añadidas a tu repaso espaciado. Volverán a aparecer en «Repaso» según cuánto te cuesten.`));
      prog.textContent = '';
      ctx.onDone && ctx.onDone('vocab', {});
      return;
    }
    const c = cards[i];
    prog.textContent = `Tarjeta ${i + 1} de ${cards.length}`;
    const back = h('div', { hidden: true }, h('p', null, c.def), h('p', null, h('strong', null, 'ES: '), c.es), h('p', { class: 'muted' }, h('em', null, c.ex)));
    const grade = h('div', { class: 'btn-row', hidden: true }, [['again', 'No la conocía'], ['hard', 'Dudé'], ['good', 'La sabía']].map(([g, t]) => h('button', { class: 'btn ' + (g === 'good' ? '' : 'btn-secondary'), type: 'button', onclick: () => {
      store.update((s) => {
        const t0 = today();
        const e = s.vocab[c.w] || { ...c, day: ctx.day ?? null, ...newEntry(t0) };
        s.vocab[c.w] = { ...e, ...c };
        schedule(s.vocab[c.w], g, t0);
      });
      i++; show();
    } }, t)));
    const reveal = h('button', { class: 'btn', type: 'button', onclick: () => { back.hidden = false; grade.hidden = false; reveal.hidden = true; grade.querySelector('button').focus(); } }, 'Mostrar significado');
    area.replaceChildren(h('div', { class: 'flash' }, h('div', { class: 'word' }, c.w), h('div', { class: 'muted' }, c.pos), back),
      h('div', { class: 'btn-row', style: 'justify-content:center' }, h('button', { class: 'btn btn-ghost btn-small', type: 'button', onclick: () => speak(c.w) }, '🔊 Pronunciar'), reveal), grade);
    reveal.focus();
  }
  show();
  wrap.append(prog, area, table);
  return wrap;
}

export async function renderBlock(b, ctx) {
  switch (b.kind) {
    case 'questions': case 'reading': case 'listening': return questionsBlock(b, ctx);
    case 'writing': return writingBlock(b, ctx);
    case 'speaking': return speakingBlock(b, ctx);
    case 'authentic': return authenticBlock(b, ctx);
    case 'video': return videoBlock(b);
    default: return h('p', null, 'Bloque desconocido: ' + b.kind);
  }
}
