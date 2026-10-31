// Abre los 75 días, los simulacros y las partes del diagnóstico, y falla si hay errores de consola.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2] || 'http://localhost:8123/';
const b = await chromium.launch(); const p = await (await b.newContext()).newPage();
const errs = [];
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(e.message));
const routes = [...Array.from({ length: 75 }, (_, i) => `dia/${i + 1}`), ...['d07', 'd14', 'd21', 'd28', 'd35'].map((m) => `simulacro/${m}`), ...['reading', 'listening', 'writing', 'speaking'].map((k) => `diagnostico/${k}`)];
for (const r of routes) {
  await p.goto(`${BASE}?today=2026-11-20#/${r}`); await p.waitForSelector('main h1', { timeout: 8000 });
  // abre todos los pasos para renderizar sus bloques
  for (const s of await p.locator('details.step > summary').all()) await s.click().catch(() => {});
  await p.waitForTimeout(150);
}
console.log(`${routes.length} rutas visitadas; errores: ${errs.length}`); errs.forEach((e) => console.log(' -', e));
await b.close(); process.exit(errs.length ? 1 : 0);
