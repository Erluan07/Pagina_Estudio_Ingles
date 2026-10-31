// Punto de entrada: tema, cronómetro de sesión y enrutador por hash.
import { $, $$, h, clear, today, dateStr, setSimulatedToday, toast } from './util.js';
import * as store from './store.js';
import { loadPlan } from './plan.js';
import { initTimer } from './timer.js';
import { viewToday, viewPlan, viewDay } from './views/today.js';
import { viewDiagnostic, viewMock } from './views/diag.js';
import { viewProgress } from './views/progress.js';
import { viewReview } from './views/review.js';
import { viewExam, viewResources, viewSettings } from './views/info.js';

store.load();

// ---- Fecha simulada (para probar el plan en otro día): ?today=YYYY-MM-DD o Ajustes ----
(function initSimDate() {
  const q = new URLSearchParams(location.search).get('today');
  try {
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) sessionStorage.setItem('toefl-sim-today', q);
    if (q === 'off') sessionStorage.removeItem('toefl-sim-today');
    const v = sessionStorage.getItem('toefl-sim-today');
    if (v) setSimulatedToday(v);
  } catch (e) { /* sin sessionStorage */ }
  const banner = $('#sim-banner');
  if (today() !== dateStr(new Date())) { banner.hidden = false; banner.textContent = `Fecha simulada: ${today()} (los datos que guardes llevarán esta fecha). Desactívala en Ajustes.`; }
})();

// ---- Tema ----
function applyTheme() {
  const t = store.get().settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  try { if (t === 'auto') localStorage.removeItem('toefl-theme'); else localStorage.setItem('toefl-theme', t); } catch (e) { /* ignorar */ }
}
applyTheme();
$('#theme-toggle').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  store.update((s) => { s.settings.theme = dark ? 'light' : 'dark'; });
  applyTheme();
});

initTimer();

// ---- Enrutador ----
const routes = {
  '': viewToday, hoy: viewToday, plan: viewPlan, dia: viewDay, diagnostico: viewDiagnostic, simulacro: viewMock,
  progreso: viewProgress, repaso: viewReview, examen: viewExam, recursos: viewResources, ajustes: viewSettings,
};
const main = $('#main');
let navToken = 0;

async function render() {
  const token = ++navToken;
  const parts = location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
  const name = parts[0] || '';
  const view = routes[name] || viewToday;
  $$('#nav a').forEach((a) => { if (a.dataset.route === (name || 'hoy') || (name === 'dia' && a.dataset.route === 'plan') || (name === 'simulacro' && a.dataset.route === 'plan')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  clear(main).append(h('p', { class: 'muted' }, 'Cargando…'));
  try {
    await loadPlan();
    const el = await view(parts.slice(1), new URLSearchParams(location.hash.split('?')[1] || ''));
    if (token !== navToken) return;
    clear(main).append(el);
  } catch (e) {
    console.error(e);
    clear(main).append(h('div', { class: 'notice bad' }, h('strong', null, 'Algo salió mal: '), e.message));
  }
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
  document.title = (main.querySelector('h1')?.textContent || 'Plan') + ' · TOEFL Twente';
}
window.addEventListener('hashchange', render);
render();

// Sin service worker a propósito: el sitio es estático y se actualiza al recargar.
window.toefl = { toast }; // utilidad para depuración manual
