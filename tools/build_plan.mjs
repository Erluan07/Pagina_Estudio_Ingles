// Genera data/plan.json a partir de la tabla de temas. Uso: node tools/build_plan.mjs
// Marca cada día como "full" si existe data/days/dNN.json, o "skeleton" si solo tiene tema.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const START = '2026-11-01', EXAM = '2027-01-15';

// [skill, type, titulo, enfoque]
// skill: reading|listening|writing|speaking|mixed|review|mock|rest
// type: skill|review|mock-partial|mock-long|mixed|rest
const T = [
  // Semana 1 · Fundamentos del nuevo formato
  ['reading', 'skill', 'Complete the Words: contexto y morfología', 'Completar palabras usando prefijos, sufijos y pistas del contexto.'],
  ['listening', 'skill', 'Listen and Choose a Response + campus', 'Responder a frases cortas y entender conversaciones del campus.'],
  ['writing', 'skill', 'Build a Sentence: orden de palabras', 'Construir oraciones correctas a partir de fragmentos desordenados.'],
  ['speaking', 'skill', 'Listen and Repeat: ritmo y chunks', 'Repetir oraciones exactas agrupando en bloques (chunks) y con ritmo natural.'],
  ['reading', 'skill', 'Read in Daily Life: avisos y correos', 'Leer textos cotidianos (avisos, emails, anuncios) y extraer lo esencial.'],
  ['writing', 'skill', 'Write an Email: registro y estructura', 'Escribir un correo claro y cortés con saludo, propósito, detalles y cierre.'],
  ['review', 'mock-partial', 'Repaso semanal + mini-simulacro 1', 'Repaso espaciado, banco de errores y mini-simulacro de las tareas vistas.'],
  // Semana 2 · Lectura y escucha académica
  ['reading', 'skill', 'Pasaje académico: idea principal y estructura', 'Identificar la idea principal y cómo se organiza un párrafo académico.'],
  ['listening', 'skill', 'Charlas académicas: toma de notas', 'Tomar notas útiles de una charla corta y reconstruir las ideas.'],
  ['writing', 'skill', 'Academic Discussion: opinión y razones', 'Contribuir a un foro académico con una opinión, dos razones y un ejemplo.'],
  ['speaking', 'skill', 'Take an Interview: estructura de respuesta', 'Responder preguntas de entrevista con respuesta directa + razón + ejemplo.'],
  ['reading', 'skill', 'Vocabulario en contexto e inferencias', 'Deducir significados y conclusiones que el texto sugiere sin decirlas.'],
  ['listening', 'skill', 'Propósito y actitud del hablante', 'Captar para qué habla alguien y qué siente o piensa.'],
  ['mock', 'mock-long', 'Simulacro largo 1', 'Reading, Listening, Writing y Speaking en condiciones cronometradas.'],
  // Semana 3
  ['reading', 'skill', 'Referencias, paráfrasis y conectores', 'Seguir pronombres, reconocer paráfrasis y conectores de contraste/causa.'],
  ['listening', 'skill', 'Conversaciones del campus: problema y solución', 'Identificar el problema, las opciones y la decisión en diálogos de campus.'],
  ['writing', 'skill', 'Build a Sentence II: subordinación y preguntas indirectas', 'Cláusulas subordinadas, preguntas indirectas y orden de adverbios.'],
  ['speaking', 'skill', 'Listen and Repeat II: oraciones largas', 'Memoria de trabajo, reducciones y entonación en oraciones largas.'],
  ['reading', 'skill', 'Complete the Words II: colocaciones y gramática', 'Usar colocaciones y gramática para completar palabras difíciles.'],
  ['writing', 'skill', 'Email II: peticiones, quejas y disculpas', 'Lenguaje de cortesía y registro formal para situaciones delicadas.'],
  ['review', 'mock-partial', 'Repaso semanal + mini-simulacro 2', 'Repaso espaciado y mini-simulacro con tareas de las semanas 2-3.'],
  // Semana 4
  ['reading', 'skill', 'Textos expositivos: causa-efecto y comparación', 'Reconocer patrones retóricos y usarlos para predecir el contenido.'],
  ['listening', 'skill', 'Charla de ciencias naturales', 'Seguir una explicación científica con definiciones y ejemplos.'],
  ['writing', 'skill', 'Academic Discussion II: concesión y contraargumento', 'Reconocer otra postura y responder con un contraargumento.'],
  ['speaking', 'skill', 'Interview II: ejemplos y detalles', 'Desarrollar ejemplos concretos en 45 segundos.'],
  ['reading', 'skill', 'Dato NO mencionado y propósito retórico', 'Preguntas de exclusión y de «por qué el autor menciona…».'],
  ['listening', 'skill', 'Anuncios y avisos del campus', 'Detalles, fechas y condiciones en anuncios y mensajes.'],
  ['mock', 'mock-long', 'Simulacro largo 2', 'Segundo simulacro cronometrado de las cuatro habilidades.'],
  // Semana 5
  ['reading', 'skill', 'Humanidades: argumentos y evidencia', 'Distinguir tesis, evidencia y contraargumentos.'],
  ['listening', 'skill', 'Charla de ciencias sociales', 'Conceptos, estudios y ejemplos en una charla de ciencias sociales.'],
  ['writing', 'skill', 'Build a Sentence III: pasiva y relativos', 'Voz pasiva, cláusulas de relativo y participios.'],
  ['speaking', 'skill', 'Interview III: opinión y comparaciones', 'Dar una opinión matizada y comparar dos opciones.'],
  ['reading', 'skill', 'Read in Daily Life II: políticas y horarios', 'Textos con condiciones, excepciones y fechas límite.'],
  ['writing', 'skill', 'Email III: tono y concisión', 'Recortar y precisar: el mismo mensaje con 20 % menos palabras.'],
  ['review', 'mock-partial', 'Repaso semanal + mini-simulacro 3', 'Repaso espaciado y mini-simulacro.'],
  // Semana 6
  ['listening', 'skill', 'Notas y resumen oral de una charla', 'Convertir notas en un resumen oral de 45 segundos.'],
  ['reading', 'skill', 'Pasajes de ciencias de la vida', 'Procesos biológicos, clasificaciones y secuencias.'],
  ['writing', 'skill', 'Academic Discussion III: vocabulario preciso', 'Reemplazar palabras vagas por vocabulario académico preciso.'],
  ['speaking', 'skill', 'Interview IV: fluidez sin muletillas', 'Reducir «eh/um», usar pausas estratégicas y conectores orales.'],
  ['listening', 'skill', 'Charla con ejemplos y analogías', 'Entender para qué se usa un ejemplo o una analogía.'],
  ['reading', 'skill', 'Historia y arte: inferencias avanzadas', 'Inferir causas, actitudes y consecuencias en textos históricos.'],
  ['mock', 'mock-long', 'Simulacro largo 3', 'Tercer simulacro cronometrado.'],
  // Semana 7
  ['writing', 'skill', 'Build a Sentence IV: velocidad', 'Resolver tareas Build a Sentence contra reloj.'],
  ['reading', 'skill', 'Reading cronometrado: ritmo por tarea', 'Distribuir el tiempo entre Complete the Words, Daily Life y académico.'],
  ['listening', 'skill', 'Listening cronometrado: una sola escucha', 'Practicar con una sola reproducción y notas rápidas.'],
  ['speaking', 'skill', 'Listen and Repeat III: velocidad de examen', 'Series de siete oraciones con tiempo de examen.'],
  ['writing', 'skill', 'Email IV: gramática de cortesía', 'Modales, condicionales y fórmulas corteses.'],
  ['speaking', 'skill', 'Interview V: temas del campus', 'Preguntas típicas sobre vida universitaria, estudios y planes.'],
  ['review', 'mock-partial', 'Repaso semanal + mini-simulacro 4', 'Repaso espaciado y mini-simulacro.'],
  // Semana 8
  ['reading', 'skill', 'Pasaje largo: tecnología e ingeniería', 'Pasajes afines a Twente: tecnología, sistemas, sostenibilidad.'],
  ['listening', 'skill', 'Charla de ingeniería y tecnología', 'Escuchar explicaciones técnicas con vocabulario preciso.'],
  ['writing', 'skill', 'Academic Discussion IV: cohesión', 'Hilar ideas con referencias y transiciones.'],
  ['speaking', 'skill', 'Interview VI: 45 s sin pausas', 'Respuestas completas de principio a fin dentro del tiempo.'],
  ['reading', 'skill', 'Complete the Words III: cronometrado', 'Velocidad y precisión en Complete the Words.'],
  ['listening', 'skill', 'Conversaciones: matices y tono', 'Ironía suave, duda, cortesía indirecta.'],
  ['mock', 'mock-long', 'Simulacro largo 4', 'Cuarto simulacro cronometrado.'],
  // Semana 9
  ['reading', 'skill', 'Errores frecuentes de Reading', 'Trabajo dirigido con tu banco de errores de lectura.'],
  ['listening', 'skill', 'Errores frecuentes de Listening', 'Trabajo dirigido con tu banco de errores de escucha.'],
  ['writing', 'skill', 'Errores frecuentes de Writing: edición', 'Edición sistemática: concordancia, artículos, tiempos.'],
  ['speaking', 'skill', 'Errores frecuentes de Speaking', 'Pronunciación, acentuación y estructura de respuesta.'],
  ['mixed', 'mixed', 'Sesión mixta: Reading + Listening', 'Bloque cronometrado de Reading y Listening.'],
  ['mixed', 'mixed', 'Sesión mixta: Writing + Speaking', 'Bloque cronometrado de Writing y Speaking.'],
  ['review', 'mock-partial', 'Repaso semanal + mini-simulacro 5', 'Repaso espaciado y mini-simulacro.'],
  // Semana 10
  ['reading', 'skill', 'Reading: estrategia de última milla', 'Afinar estrategia con tus tipos de pregunta más débiles.'],
  ['listening', 'skill', 'Listening: estrategia de última milla', 'Afinar estrategia con tus tipos de pregunta más débiles.'],
  ['writing', 'skill', 'Writing: plantillas personales y edición rápida', 'Dejar lista tu plantilla personal de email y discusión.'],
  ['speaking', 'skill', 'Speaking: banco de ejemplos personales', 'Preparar ejemplos reutilizables para el 45 s de entrevista.'],
  ['mixed', 'mixed', 'Sesión mixta según tu punto débil', 'Bloque cronometrado centrado en la habilidad más baja.'],
  ['review', 'review', 'Repaso completo del banco de errores', 'Vaciar el banco de errores pendiente.'],
  ['mock', 'mock-long', 'Simulacro largo 5 (completo)', 'Simulacro completo con condiciones de examen.'],
  // Cierre
  ['review', 'review', 'Análisis del simulacro y ajustes', 'Revisar el simulacro 5 y fijar los últimos ajustes.'],
  ['mock', 'mock-long', 'Simulacro completo final', 'Último simulacro completo, a nivel de examen.'],
  ['mixed', 'mixed', 'Afinamiento ligero (60 min)', 'Repasar puntos débiles sin sobrecargar.'],
  ['review', 'review', 'Repaso ligero + logística del examen', 'Documentos, hora, equipo, ruta; repaso corto de vocabulario.'],
  ['rest', 'rest', 'Descanso + consejos del día del examen', 'Hoy no se estudia: descansa. Lista de consejos para mañana.'],
];

const MIN = { skill: 90, 'mock-partial': 75, 'mock-long': 120, mixed: 90, review: 75, rest: 20 };
const dayName = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
function addDays(s, n) { const [y, m, d] = s.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); }
const phaseOf = (n) => n <= 14 ? 'Fundamentos del nuevo formato' : n <= 42 ? 'Construcción de habilidades' : n <= 63 ? 'Práctica integrada y cronometrada' : 'Simulacros y afinamiento';

const days = T.map(([skill, type, title, focus], i) => {
  const n = i + 1, date = addDays(START, i);
  const file = path.join(root, 'data/days', `d${String(n).padStart(2, '0')}.json`);
  const dow = new Date(date + 'T12:00:00Z').getUTCDay();
  const d = { n, date, dow: dayName[dow], week: Math.ceil(n / 7), phase: phaseOf(n), skill, type, title, focus, minutes: MIN[type], status: fs.existsSync(file) ? 'full' : 'skeleton' };
  if (type.startsWith('mock')) { d.mock = `d${String(n).padStart(2, '0')}`; d.mockReady = fs.existsSync(path.join(root, 'data/mocks', `${d.mock}.json`)); }
  return d;
});
const out = { meta: { start: START, end: days[days.length - 1].date, exam: EXAM, total: days.length, generated: 'node tools/build_plan.mjs' }, days };
fs.writeFileSync(path.join(root, 'data/plan.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`plan.json: ${days.length} días (${days.filter((d) => d.status === 'full').length} con contenido completo), ${out.meta.start} → ${out.meta.end}`);
