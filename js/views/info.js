// Vistas: Sobre el examen, Recursos y Ajustes.
import { h, fetchText, fetchJSON, today, fmtDate, setSimulatedToday, toast, dateStr } from '../util.js';
import { renderMarkdown } from '../md.js';
import * as store from '../store.js';
import { videoCard } from '../practice.js';

export async function viewExam() {
  const txt = await fetchText('data/exam.md');
  return h('div', null, h('h1', null, 'Sobre el examen'), h('div', { class: 'md', html: renderMarkdown(txt) }));
}

export async function viewResources() {
  const [vids, res] = await Promise.all([fetchJSON('data/videos.json'), fetchJSON('data/resources.json')]);
  const root = h('div', null, h('h1', null, 'Recursos'));
  root.append(h('div', { class: 'notice' }, 'Los videos se incrustan con youtube-nocookie y solo cargan al pulsar el botón. ' + res.note));
  const topics = [...new Set(vids.map((v) => v.topic))];
  root.append(h('h2', null, 'Videos'));
  for (const t of topics) {
    root.append(h('details', { class: 'reveal' }, h('summary', null, t), vids.filter((v) => v.topic === t).map(videoCard)));
  }
  root.append(h('h2', null, 'Material auténtico (podcasts, charlas, lecturas)'));
  root.append(h('div', { class: 'grid' }, res.authentic.map((r) => h('div', { class: 'card' }, h('h3', null, r.name), h('p', { class: 'muted' }, r.note), h('p', null, h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir ↗'), r.verified === false ? h('span', { class: 'pill warn', style: 'margin-left:8px' }, 'no verificado desde el entorno') : null), h('p', { class: 'small' }, r.skills)))));
  root.append(h('h2', null, 'Oficial'));
  root.append(h('ul', null, res.official.map((r) => h('li', null, h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, r.name), ' — ', r.note))));
  return root;
}

export async function viewSettings() {
  const s = store.get();
  const root = h('div', null, h('h1', null, 'Ajustes'));
  const msg = h('div', { role: 'status', 'aria-live': 'polite' });

  root.append(h('div', { class: 'card' }, h('h2', null, 'Sesión de estudio'),
    h('label', { for: 'mode' }, 'Duración de tus sesiones: '),
    h('select', { id: 'mode', onchange: (e) => { store.update((st) => { st.settings.mode = Number(e.target.value); }); toast('Modo guardado'); } }, [60, 90, 120].map((m) => h('option', { value: m, selected: s.settings.mode === m }, `${m} minutos`))),
    h('p', { class: 'small muted' }, 'El modo controla cuánto refuerzo personalizado se añade a la sesión base (60: sin refuerzo; 90: +10 min; 120: +25 min).'),
    h('label', { for: 'theme' }, 'Tema: '),
    h('select', { id: 'theme', onchange: (e) => { store.update((st) => { st.settings.theme = e.target.value; }); const t = e.target.value; if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; try { if (t === 'auto') localStorage.removeItem('toefl-theme'); else localStorage.setItem('toefl-theme', t); } catch (er) {} } }, [['auto', 'Automático (sistema)'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, l]) => h('option', { value: v, selected: s.settings.theme === v }, l)))));

  root.append(h('div', { class: 'card' }, h('h2', null, 'Metas'),
    h('p', null, 'Meta mínima (banda 1-6): ', h('input', { id: 'goal', type: 'number', step: '0.5', min: 1, max: 6, value: s.settings.goal, 'aria-label': 'Meta mínima', onchange: (e) => store.update((st) => { st.settings.goal = Number(e.target.value); }) }), ' · Margen recomendado: ', h('input', { id: 'goalSafe', type: 'number', step: '0.5', min: 1, max: 6, value: s.settings.goalSafe, 'aria-label': 'Margen recomendado', onchange: (e) => store.update((st) => { st.settings.goalSafe = Number(e.target.value); }) })),
    h('p', { class: 'small muted' }, 'Por defecto 4.5 (mínimo general de Twente que encontramos tras enero de 2026) y 5.0 de margen. Verifica el requisito exacto de tu programa y ajusta aquí.')));

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', id: 'import-file', 'aria-label': 'Archivo de respaldo a importar' });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0]; if (!f) return;
    try { store.importJSON(await f.text()); msg.replaceChildren(h('div', { class: 'notice good' }, 'Respaldo importado correctamente.')); }
    catch (e) { msg.replaceChildren(h('div', { class: 'notice bad' }, 'No se pudo importar: ' + e.message)); }
  });
  root.append(h('div', { class: 'card' }, h('h2', null, 'Respaldo de tu progreso'),
    h('p', null, 'Tus datos viven solo en este navegador (localStorage). Exporta un respaldo de vez en cuando, sobre todo antes de limpiar datos del navegador o cambiar de dispositivo.'),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', id: 'export-btn', onclick: () => {
      const blob = new Blob([store.exportJSON()], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `toefl-twente-respaldo-${today()}.json` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      msg.replaceChildren(h('div', { class: 'notice good' }, 'Respaldo descargado.'));
    } }, '⬇ Exportar JSON'), h('label', { class: 'btn btn-secondary', for: 'import-file' }, '⬆ Importar JSON'), fileInput), msg));

  root.append(h('div', { class: 'card' }, h('h2', null, 'Probar otra fecha'),
    h('p', { class: 'small muted' }, 'Útil para ver cómo se vería el plan en otro día (solo en esta pestaña). Los datos que guardes llevarán esa fecha.'),
    h('input', { type: 'date', id: 'sim-date', value: today(), 'aria-label': 'Fecha simulada' }),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { const v = document.getElementById('sim-date').value; try { sessionStorage.setItem('toefl-sim-today', v); } catch (e) {} location.href = location.pathname + '?today=' + v + '#/hoy'; } }, 'Usar esta fecha'), h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { location.href = location.pathname + '?today=off#/hoy'; } }, 'Volver a la fecha real'))));

  root.append(h('div', { class: 'card' }, h('h2', null, 'Zona de peligro'),
    h('button', { class: 'btn btn-danger', type: 'button', onclick: () => { if (confirm('¿Borrar TODO tu progreso en este navegador? Esta acción no se puede deshacer (exporta antes un respaldo).')) { store.reset(); location.hash = '#/hoy'; location.reload(); } } }, 'Borrar todo mi progreso')));
  return root;
}
