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

console.log('\nErrores de consola:', errors.length ? '\n' + errors.join('\n') : 'ninguno');
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
