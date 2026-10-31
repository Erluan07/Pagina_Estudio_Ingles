// Preguntas autocorregibles: mcq, multi, order (Build a Sentence), cloze (Complete the Words).
import { h, normalize, today } from './util.js';
import * as store from './store.js';
import { newEntry } from './srs.js';
import { createPlayer } from './audio.js';

const LETTERS = 'ABCDEFGH';
let uid = 0;

export const QTYPE_ES = {
  detail: 'Detalle', inference: 'Inferencia', 'main-idea': 'Idea principal', vocab: 'Vocabulario en contexto', purpose: 'Propósito retórico',
  'negative-fact': 'Dato NO mencionado', reference: 'Referencia (pronombres)', insertion: 'Inserción de oración', summary: 'Resumen', paraphrase: 'Paráfrasis',
  'complete-words': 'Complete the Words', 'daily-life': 'Read in Daily Life', 'build-sentence': 'Build a Sentence', 'choose-response': 'Choose a Response',
  'speaker-purpose': 'Propósito del hablante', attitude: 'Actitud / opinión', organization: 'Organización', grammar: 'Gramática', 'note-taking': 'Notas / detalle',
  'listen-repeat': 'Listen and Repeat', connection: 'Relación entre ideas', prediction: 'Predicción', function: 'Función de una frase', vocabulary: 'Vocabulario',
};

function buildQuestion(it, n, opts) {
  const id = it.id;
  const name = `q${++uid}`;
  const el = h('fieldset', { class: 'q', dataset: { id } });
  const legend = h('legend', null, `${n}. `, it.q || it.prompt || '', h('span', { class: 'qtype' }, QTYPE_ES[it.qtype] || it.qtype || ''));
  el.append(legend);
  let player = null;
  if (it.audio) { player = createPlayer(it.audio, { maxPlays: opts.maxPlays }); el.append(player.el); }
  const expl = h('div', { class: 'expl', hidden: true, role: 'status' });
  let api;

  if (it.type === 'mcq' || it.type === 'multi') {
    const multi = it.type === 'multi';
    const answers = multi ? it.answer : [it.answer];
    if (multi) el.append(h('p', { class: 'small muted' }, `Elige ${answers.length} respuestas.`));
    const opts_ = it.options.map((t, i) => {
      const input = h('input', { type: multi ? 'checkbox' : 'radio', name, value: i, id: `${name}-${i}` });
      const label = h('label', { class: 'opt', for: `${name}-${i}` }, input, h('span', null, h('strong', null, LETTERS[i] + '. '), t));
      el.append(label);
      return { input, label };
    });
    api = {
      get: () => opts_.filter((o) => o.input.checked).map((o) => Number(o.input.value)),
      set: (v) => opts_.forEach((o) => { o.input.checked = v.includes(Number(o.input.value)); }),
      lock: () => opts_.forEach((o) => { o.input.disabled = true; }),
      unlock: () => opts_.forEach((o) => { o.input.disabled = false; o.label.classList.remove('right', 'wrong'); o.input.checked = false; }),
      answered: (v) => v.length > 0,
      grade: (v) => {
        const ok = v.length === answers.length && answers.every((a) => v.includes(a));
        opts_.forEach((o, i) => {
          if (answers.includes(i)) o.label.classList.add('right');
          else if (v.includes(i)) o.label.classList.add('wrong');
        });
        return { pts: ok ? 1 : 0, max: 1, shown: `Correcta: ${answers.map((a) => LETTERS[a]).join(', ')}.` };
      },
    };
  } else if (it.type === 'order') {
    if (it.context) el.append(h('p', { class: 'muted' }, it.context));
    const bank = h('div', { class: 'chips', 'aria-label': 'Palabras disponibles' });
    const out = h('div', { class: 'chips answer', 'aria-label': 'Tu oración', 'aria-live': 'polite' });
    let chosen = [];
    const chipsB = it.words.map((w, i) => h('button', { class: 'chip', type: 'button', onclick: () => { if (locked) return; chosen.push(i); redraw(); } }, w));
    let locked = false;
    const redraw = () => {
      bank.replaceChildren(...chipsB);
      chipsB.forEach((b, i) => { b.disabled = chosen.includes(i); });
      out.replaceChildren(...chosen.map((i, pos) => h('button', { class: 'chip', type: 'button', 'aria-label': `Quitar ${it.words[i]}`, onclick: () => { if (locked) return; chosen.splice(pos, 1); redraw(); } }, it.words[i])));
    };
    const reset = h('button', { class: 'btn btn-small btn-ghost', type: 'button', onclick: () => { if (!locked) { chosen = []; redraw(); } } }, 'Borrar');
    el.append(bank, out, reset);
    redraw();
    const accepted = [it.answer, ...(it.accept || [])].map(normalize);
    api = {
      get: () => chosen.map((i) => it.words[i]),
      set: (v) => { chosen = []; const used = new Set(); v.forEach((w) => { const i = it.words.findIndex((x, j) => x === w && !used.has(j)); if (i >= 0) { used.add(i); chosen.push(i); } }); redraw(); },
      lock: () => { locked = true; reset.disabled = true; chipsB.forEach((b) => { b.disabled = true; }); },
      unlock: () => { locked = false; reset.disabled = false; chosen = []; redraw(); out.classList.remove('right', 'wrong'); },
      answered: (v) => v.length > 0,
      grade: (v) => {
        const ok = accepted.includes(normalize(v.join(' ')));
        out.style.borderColor = ok ? 'var(--good)' : 'var(--bad)';
        return { pts: ok ? 1 : 0, max: 1, shown: `Oración correcta: “${it.answer}”` };
      },
    };
  } else if (it.type === 'cloze') {
    const parts = it.text.split(/(\{\{[^}]+\}\})/);
    const blanks = [];
    const box = h('p', { class: 'cloze' });
    parts.forEach((p) => {
      const m = p.match(/^\{\{([^|]*)\|([^}]*)\}\}$/);
      if (!m) { box.append(p); return; }
      const [, pre, rest] = m;
      const input = h('input', { type: 'text', size: Math.max(rest.length, 2) + 1, maxlength: rest.length + 4, autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false', 'aria-label': `Completa la palabra que empieza con ${pre}` });
      blanks.push({ pre, rest, input });
      box.append(h('span', { class: 'pre' }, pre), input);
    });
    el.append(box);
    api = {
      get: () => blanks.map((b) => b.input.value.trim()),
      set: (v) => blanks.forEach((b, i) => { b.input.value = v[i] || ''; }),
      lock: () => blanks.forEach((b) => { b.input.disabled = true; }),
      unlock: () => blanks.forEach((b) => { b.input.disabled = false; b.input.value = ''; b.input.classList.remove('right', 'wrong'); }),
      answered: (v) => v.some((x) => x),
      grade: (v) => {
        let pts = 0;
        blanks.forEach((b, i) => {
          const ok = v[i].toLowerCase() === b.rest.toLowerCase();
          if (ok) pts++;
          b.input.classList.add(ok ? 'right' : 'wrong');
        });
        return { pts, max: blanks.length, shown: 'Respuestas: ' + blanks.map((b) => b.pre + b.rest).join(', ') + '.' };
      },
    };
  } else {
    throw new Error('Tipo de pregunta desconocido: ' + it.type);
  }
  el.append(expl);
  return { it, el, api, expl, player };
}

/** Registra un intento (solo el primero por pregunta cuenta para las estadísticas) y guarda errores. */
function record(it, res, ans, opts) {
  store.update((s) => {
    const first = !s.answers[it.id];
    if (first) {
      s.answers[it.id] = { ans, pts: res.pts, max: res.max };
      s.attempts.push({ date: today(), day: opts.day ?? null, skill: it.skill || opts.skill, qtype: it.qtype || 'other', pts: res.pts, max: res.max, kind: opts.kind || 'quiz', itemId: it.id });
      if (res.pts < res.max) {
        s.errors[it.id] = { id: it.id, item: it, ctx: opts.ctx || null, skill: it.skill || opts.skill, qtype: it.qtype || 'other', day: opts.day ?? null, date: today(), ...newEntry(today()), resolved: false };
      }
    }
  });
}

/**
 * Crea un conjunto de preguntas con botón "Comprobar".
 * opts: { skill, day, kind, ctx, maxPlays, onDone(summary), review(bool) }
 */
export function createQuestionSet(items, opts = {}) {
  const root = h('div', { class: 'qset' });
  const qs = items.map((it, i) => buildQuestion({ ...it, skill: it.skill || opts.skill }, i + 1, opts));
  qs.forEach((q) => root.append(q.el));
  const result = h('div', { role: 'status', 'aria-live': 'polite', class: 'qresult' });
  const submit = h('button', { class: 'btn', type: 'button' }, 'Comprobar respuestas');
  const redo = h('button', { class: 'btn btn-secondary', type: 'button', hidden: true }, 'Volver a intentar (no cuenta en las estadísticas)');
  root.append(h('div', { class: 'btn-row' }, submit, redo), result);

  function doGrade(persist) {
    let pts = 0, max = 0;
    const results = [];
    qs.forEach((q) => {
      const v = q.api.get();
      const res = q.api.grade(v);
      pts += res.pts; max += res.max;
      q.api.lock();
      q.expl.hidden = false;
      q.expl.replaceChildren(h('strong', null, res.pts === res.max ? '✔ Correcto. ' : res.pts > 0 ? '◐ Parcial. ' : '✘ Incorrecto. '), res.shown + ' ', q.it.explain || '');
      if (q.player) q.player.reveal();
      if (persist) record(q.it, res, v, opts);
      results.push({ id: q.it.id, ...res });
    });
    result.replaceChildren(h('div', { class: `notice ${pts === max ? 'good' : pts / max >= .6 ? 'info' : 'bad'}` }, `Resultado: ${pts}/${max} (${Math.round((100 * pts) / max)} %). `, pts < max && opts.kind !== 'review' ? 'Las preguntas falladas se guardaron en tu banco de errores.' : ''));
    submit.hidden = true; redo.hidden = false;
    if (opts.onDone) opts.onDone({ pts, max, results });
    return { pts, max };
  }

  submit.addEventListener('click', () => {
    const unanswered = qs.filter((q) => !q.api.answered(q.api.get())).length;
    if (unanswered && !root.dataset.warned) {
      root.dataset.warned = '1';
      result.replaceChildren(h('div', { class: 'notice' }, `Te faltan ${unanswered} pregunta(s) por responder. Pulsa de nuevo «Comprobar respuestas» para calificar de todos modos.`));
      return;
    }
    doGrade(true);
  });
  redo.addEventListener('click', () => {
    qs.forEach((q) => { q.api.unlock(); q.expl.hidden = true; q.el.querySelectorAll('.opt').forEach((o) => o.classList.remove('right', 'wrong')); });
    result.replaceChildren(); submit.hidden = false; redo.hidden = true; delete root.dataset.warned;
  });

  // Si ya se respondió antes, se muestra el resultado guardado.
  const saved = store.get().answers;
  if (!opts.fresh && qs.length && qs.every((q) => saved[q.it.id])) {
    qs.forEach((q) => q.api.set(saved[q.it.id].ans));
    doGrade(false);
  }
  return { el: root, grade: () => doGrade(true), items: qs };
}
