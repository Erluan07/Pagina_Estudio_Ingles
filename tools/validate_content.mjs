// Valida el contenido: JSON bien formado, ids únicos, respuestas dentro de rango, audios/lecciones/videos existentes.
// Uso: node tools/validate_content.mjs      (sale con código 1 si hay errores)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [], warns = [];
const err = (m) => errors.push(m);
const readJSON = (rel) => { try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch (e) { err(`${rel}: JSON inválido (${e.message})`); return null; } };
const exists = (rel) => fs.existsSync(path.join(root, rel));

const ids = new Set();
function checkItem(it, where) {
  if (!it.id) return err(`${where}: pregunta sin id`);
  if (ids.has(it.id)) err(`${where}: id duplicado ${it.id}`);
  ids.add(it.id);
  if (!it.explain && it.type !== 'cloze') err(`${where}/${it.id}: falta explain`);
  if (it.type === 'mcq') {
    if (!Array.isArray(it.options) || it.options.length < 2) err(`${it.id}: opciones insuficientes`);
    if (!Number.isInteger(it.answer) || it.answer < 0 || it.answer >= (it.options || []).length) err(`${it.id}: answer fuera de rango`);
  } else if (it.type === 'multi') {
    if (!Array.isArray(it.answer) || it.answer.some((a) => a < 0 || a >= it.options.length)) err(`${it.id}: answer(s) fuera de rango`);
  } else if (it.type === 'order') {
    const a = it.answer.replace(/[.?!]$/, '').split(/\s+/).map((w) => w.replace(/[.?!]$/, '').toLowerCase()).sort().join('|');
    const b = it.words.map((w) => w.replace(/[.?!]$/, '').toLowerCase()).sort().join('|');
    if (a !== b) err(`${it.id}: las palabras no coinciden con la respuesta (${a} ≠ ${b})`);
  } else if (it.type === 'cloze') {
    if (!/\{\{[^|}]*\|[^}]+\}\}/.test(it.text)) err(`${it.id}: cloze sin huecos`);
  } else err(`${it.id}: tipo desconocido ${it.type}`);
  if (it.audio) checkAudio(it.audio, it.id);
}
function checkAudio(a, where) {
  if (!a.file || !a.segments?.length) return err(`${where}: audio incompleto`);
  if (!exists(a.file)) err(`${where}: falta el archivo ${a.file} (ejecuta tools/generate_audio.py)`);
  a.segments.forEach((s) => { if (!s.voice || !s.text) err(`${where}: segmento sin voz/texto`); });
}
function checkBlock(b, where, vids) {
  if (!b.id) err(`${where}: bloque sin id`);
  if (b.kind !== 'speaking') (b.items || []).forEach((it) => checkItem(it, `${where}/${b.id}`));
  if (b.audio) checkAudio(b.audio, `${where}/${b.id}`);
  (b.items || []).forEach((it) => { if (b.kind === 'speaking' && it.audio) checkAudio(it.audio, `${where}/${b.id}`); });
  if ((b.kind === 'reading') && !b.passage) err(`${where}/${b.id}: reading sin passage`);
  if (b.kind === 'writing' && !b.prompt) err(`${where}/${b.id}: writing sin prompt`);
}

const vids = readJSON('data/videos.json') || [];
const vidIds = new Set(vids.map((v) => v.id));
vids.forEach((v) => { if (!/^[A-Za-z0-9_-]{11}$/.test(v.yt)) err(`videos.json: ID de YouTube con formato raro: ${v.yt}`); });

const plan = readJSON('data/plan.json');
if (plan) {
  if (plan.days.length !== plan.meta.total) err('plan.json: total no coincide');
  plan.days.forEach((d) => {
    const rel = `data/days/d${String(d.n).padStart(2, '0')}.json`;
    if (d.status === 'full' && !exists(rel)) err(`${rel}: el plan dice full pero no existe`);
    if (d.status === 'skeleton' && exists(rel)) err(`${rel}: existe pero el plan dice skeleton (ejecuta node tools/build_plan.mjs)`);
    if (d.status !== 'full') return;
    const day = readJSON(rel); if (!day) return;
    if (day.lesson && !exists(day.lesson)) err(`${rel}: lección inexistente ${day.lesson}`);
    (day.videos?.ids || []).forEach((v) => { if (!vidIds.has(v)) err(`${rel}: video desconocido ${v}`); });
    (day.vocab?.words || []).forEach((w) => { if (w.length !== 5) err(`${rel}: palabra con formato incorrecto ${w[0]}`); });
    (day.practice || []).forEach((b) => checkBlock(b, rel, vidIds));
    (day.quiz || []).forEach((it) => checkItem(it, rel + '/quiz'));
    if (d.mock && exists(`data/mocks/${d.mock}.json`)) { /* validado abajo */ }
  });
}
for (const f of fs.readdirSync(path.join(root, 'data/mocks')).filter((x) => x.endsWith('.json'))) {
  const m = readJSON('data/mocks/' + f); if (!m) continue;
  m.sections.forEach((s) => s.blocks.forEach((b) => checkBlock(b, 'mocks/' + f, vids)));
}
const diag = readJSON('data/diagnostic.json');
if (diag) Object.entries(diag.parts).forEach(([k, p]) => p.blocks.forEach((b) => checkBlock(b, 'diagnostic/' + k, vids)));
readJSON('data/prompts.json'); readJSON('data/resources.json');

console.log(`Preguntas con id: ${ids.size}`);
if (warns.length) console.log('Avisos:\n' + warns.join('\n'));
if (errors.length) { console.error(`\n${errors.length} error(es):\n` + errors.join('\n')); process.exit(1); }
console.log('Contenido válido ✔');
