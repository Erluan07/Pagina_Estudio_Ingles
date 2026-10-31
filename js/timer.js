// Cronómetro de sesión: acumula minutos en el día actual (minutesByDate).
import { $, today, fmtClock } from './util.js';
import * as store from './store.js';

let running = false, last = 0, session = 0, flushAcc = 0, tick = null;

export function initTimer() {
  const disp = $('#timer-display'), btn = $('#timer-toggle');
  function flush() {
    if (flushAcc <= 0) return;
    const mins = flushAcc / 60; flushAcc = 0;
    store.update((s) => { s.minutesByDate[today()] = Math.round(((s.minutesByDate[today()] || 0) + mins) * 100) / 100; });
  }
  function step() {
    const now = Date.now(), dt = (now - last) / 1000; last = now;
    session += dt; flushAcc += dt; disp.textContent = fmtClock(session);
    if (flushAcc >= 15) flush();
  }
  function start() { running = true; last = Date.now(); tick = setInterval(step, 1000); btn.textContent = '⏸ Pausar'; btn.setAttribute('aria-pressed', 'true'); }
  function pause() { if (running) step(); running = false; clearInterval(tick); flush(); btn.textContent = '▶ Reanudar'; btn.setAttribute('aria-pressed', 'false'); }
  btn.addEventListener('click', () => (running ? pause() : start()));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (running) { step(); flush(); } } else last = Date.now(); });
  window.addEventListener('pagehide', () => { if (running) step(); flush(); });
}
export const sessionMinutes = () => Math.round(session / 60);
export const isRunning = () => running;
