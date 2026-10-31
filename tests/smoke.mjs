// Prueba de humo con Playwright: navega las vistas, verifica que no haya errores de consola
// y que el guardado/exportación/importación del progreso funcione.
// Uso: node tests/smoke.mjs [url-base]   (por defecto http://localhost:8123/)
import fs from 'node:fs';
import { createRequire } from 'node:module';
// require() respeta NODE_PATH (útil si playwright está instalado globalmente)
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.argv[2] || 'http://localhost:8123/';
const errors = [];
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error('✘ ' + m); } else console.log('✔ ' + m); };

const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ acceptDownloads: true, permissions: ['microphone'], viewport: { width: 1000, height: 900 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('requestfailed', (r) => { if (!/youtube|ytimg/.test(r.url())) errors.push('[requestfailed] ' + r.url()); });

const go = async (hash, q = '') => { await page.goto(`${BASE}${q}#/${hash}`); await page.waitForSelector('main h1'); };

// 1. Vistas básicas
for (const r of ['hoy', 'plan', 'diagnostico', 'progreso', 'repaso', 'recursos', 'examen', 'ajustes']) {
  await go(r, '?today=2026-11-03');
  ok(await page.locator('main h1').count() > 0, `vista #/${r} se renderiza`);
}
await go('plan', '?today=2026-11-03');
ok(await page.locator('.daycell').count() === 75, 'el plan tiene 75 días');

// 2. Diagnóstico Reading: responder y guardar
await go('diagnostico/reading', '?today=2026-11-03');
await page.locator('.cloze input').first().fill('xx');
const radios = page.locator('.q input[type=radio]');
await radios.nth(0).check().catch(() => {});
await page.getByRole('button', { name: 'Comprobar respuestas' }).first().click();
await page.getByRole('button', { name: 'Comprobar respuestas' }).first().click().catch(() => {});
ok(await page.locator('.qresult .notice').count() > 0, 'Reading: se muestra el resultado');

// 3. Estado guardado
let state = await page.evaluate(() => JSON.parse(localStorage.getItem('toefl-twente-v1')));
ok(state && state.attempts.length > 0, 'localStorage contiene intentos');
ok(Object.keys(state.errors).length > 0, 'las respuestas falladas llegan al banco de errores');

// 4. Exportar e importar
await go('ajustes', '?today=2026-11-03');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
const file = await dl.path();
const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
ok(exported.app === 'toefl-twente' && exported.data.attempts.length === state.attempts.length, 'la exportación contiene el progreso');
await page.evaluate(() => localStorage.clear());
await page.reload(); await page.waitForSelector('main h1');
await page.setInputFiles('#import-file', file);
await page.waitForSelector('.notice.good');
state = await page.evaluate(() => JSON.parse(localStorage.getItem('toefl-twente-v1')));
ok(state.attempts.length === exported.data.attempts.length, 'la importación restaura el progreso');


// 5. Día 1: calentamiento de vocabulario, Complete the Words y racha
await go('dia/1', '?today=2026-11-01');
await page.waitForSelector('#step-warmup .flash');
for (let i = 0; i < 10; i++) {
  await page.getByRole('button', { name: 'Mostrar significado' }).click();
  await page.getByRole('button', { name: 'La sabía' }).click();
}
ok(await page.locator('#step-warmup.done').count() === 1, 'Día 1: el calentamiento queda marcado como hecho');
state = await page.evaluate(() => JSON.parse(localStorage.getItem('toefl-twente-v1')));
ok(Object.keys(state.vocab).length === 10, 'Día 1: 10 palabras añadidas al repaso espaciado');
const day1 = JSON.parse(fs.readFileSync(new URL('../data/days/d01.json', import.meta.url), 'utf8'));
await page.locator('#step-practice-d01-p1 > summary').click();
const blanks = [...day1.practice[0].items[0].text.matchAll(/\{\{([^|]*)\|([^}]*)\}\}/g)].map((m) => m[2]);
const inputs = page.locator('#step-practice-d01-p1 .cloze input');
for (let i = 0; i < blanks.length; i++) await inputs.nth(i).fill(blanks[i]);
await page.locator('#step-practice-d01-p1').getByRole('button', { name: 'Comprobar respuestas' }).click();
ok((await page.locator('#step-practice-d01-p1 .qresult').innerText()).includes('100 %'), 'Día 1: Complete the Words se califica al 100 %');
await page.fill('#min-input', '80');
await page.getByRole('button', { name: 'Marcar día como completado' }).click();
await page.waitForSelector('.notice.good');
state = await page.evaluate(() => JSON.parse(localStorage.getItem('toefl-twente-v1')));
ok(state.days['1'] && state.days['1'].done && state.minutesByDate['2026-11-01'] >= 80, 'Día 1: el día se completa y registra minutos');

// 6. Día 2: reproductor de audio presente y mp3 accesible
await go('dia/2', '?today=2026-11-02');
await page.locator('#step-practice-d02-p1 > summary').click();
await page.waitForSelector('#step-practice-d02-p1 .player');
const mp3 = await page.request.get(BASE + 'audio/d02-c1.mp3');
ok(mp3.ok() && (await mp3.body()).length > 5000, 'Día 2: el mp3 existe y se sirve');

// 7. Simulacro mini 1 de punta a punta
await go('simulacro/d07', '?today=2026-11-07');
await page.getByRole('button', { name: 'Empezar el simulacro' }).click();
for (let i = 0; i < 4; i++) {
  await page.waitForSelector('.timer-display');
  await page.getByRole('button', { name: /Terminar (sección|simulacro)/ }).click();
}
await page.waitForSelector('text=Resultado del simulacro');
ok(true, 'Simulacro: llega al resumen');

// 8. Grabación local con micrófono falso
await go('diagnostico/speaking', '?today=2026-11-07');
await page.getByRole('button', { name: '● Grabar' }).first().click();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: '■ Detener' }).first().click();
await page.waitForSelector('.rec audio:not([hidden])');
ok(true, 'Speaking: la grabación local se reproduce');

// 9. Progreso y repaso con datos
await go('progreso', '?today=2026-11-07');
ok(await page.locator('svg.chart').count() > 0, 'Progreso: se dibuja la gráfica');
await go('repaso', '?today=2026-11-07&tab=errores');
ok(await page.locator('main h1').count() > 0, 'Repaso de errores se renderiza');

console.log('\nErrores de consola:', errors.length ? '\n' + errors.join('\n') : 'ninguno');
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
