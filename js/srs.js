// Repaso espaciado tipo Leitner (cajas 0-7). Se usa para vocabulario y preguntas falladas.
import { addDays } from './util.js';

export const INTERVALS = [0, 1, 2, 4, 8, 16, 32, 64];

/** Crea una entrada SRS nueva, pendiente hoy. */
export function newEntry(today) { return { box: 0, due: today, seen: 0, lapses: 0, added: today }; }

/** grade: 'again' | 'hard' | 'good' | 'easy' */
export function schedule(entry, grade, today) {
  entry.seen = (entry.seen || 0) + 1;
  if (grade === 'again') { entry.box = 1; entry.lapses = (entry.lapses || 0) + 1; entry.due = addDays(today, 1); }
  else if (grade === 'hard') { entry.box = Math.max(1, entry.box); entry.due = addDays(today, Math.max(1, INTERVALS[entry.box] >> 1)); }
  else if (grade === 'good') { entry.box = Math.min(7, entry.box + 1); entry.due = addDays(today, INTERVALS[entry.box]); }
  else { entry.box = Math.min(7, entry.box + 2); entry.due = addDays(today, INTERVALS[entry.box]); }
  entry.last = today;
  return entry;
}

export function isDue(entry, today) { return entry.due <= today; }
/** Una palabra se considera "aprendida" a partir de la caja 3 (≈ 3 repasos correctos seguidos). */
export function isLearned(entry) { return entry.box >= 3; }
