# TOEFL Twente · Plan de estudio de 75 días

Web estática (HTML + CSS + JS sin dependencias) para preparar el **TOEFL iBT** (examen el **15 de enero de 2027**) con destino a una maestría en la **Universidad de Twente**. La interfaz está en español y el material de práctica en inglés. No tiene backend: todo el progreso se guarda en `localStorage` y se puede exportar/importar como JSON.

> Contenido de práctica **original** (no copia material de ETS ni de libros de pago). Las bandas estimadas son orientativas, no puntajes oficiales.

## Qué incluye

| Función | Dónde |
|---|---|
| **Test diagnóstico** (4 partes, ≈ 50 min) que genera un perfil por habilidad y reparte el refuerzo | `#/diagnostico` |
| **Plan de 75 días** (1-nov-2026 → 14-ene-2027): calentamiento de vocabulario, mini-lección + video, práctica aplicada, mini-quiz, refuerzo personalizado y repaso | `#/plan`, `#/dia/N` |
| **Simulacros**: mini-simulacro semanal (días 7, 21, 35, 49, 63), simulacro largo cada 2 semanas y simulacros finales | `#/simulacro/…` |
| **Audio** original (TTS local, voces US/UK) con transcripción oculta hasta responder; respaldo con Web Speech API | `audio/` |
| **Speaking**: grabación local con `MediaRecorder` (temporizador, reproducción; no se sube nada) | en cada tarea de Speaking |
| **Writing**: temporizador, contador de palabras, análisis automático, respuesta modelo, rúbrica de autoevaluación | en cada tarea de Writing |
| **Progreso**: racha, minutos, % del plan, banda por habilidad en el tiempo, precisión por tipo de pregunta, palabras aprendidas, proyección vs meta | `#/progreso` |
| **Banco de errores** y **repaso espaciado** (Leitner 1-2-4-8-16-32-64 días) de vocabulario y preguntas falladas | `#/repaso` |
| **Hoy**: muestra qué toca hoy, días atrasados para recuperar, repasos pendientes | `#/hoy` |
| **Sobre el examen**: formato 2026, escala 1-6, requisito de Twente, con fecha de consulta y qué no se pudo verificar | `#/examen` |
| Modo oscuro, diseño responsive, navegación por teclado, `aria-live` en resultados | todo el sitio |

## Cómo usarlo

1. Abre el sitio (GitHub Pages) o, en local: `python3 -m http.server 8000` y entra a `http://localhost:8000/`.
2. Haz el **diagnóstico** (puedes repartirlo en varios días).
3. Cada día, abre **Hoy** → «Empezar la sesión». Usa el cronómetro de la cabecera. Al terminar, «Marcar día como completado».
4. Haz el **Repaso** a diario (5-10 min).
5. **Exporta un respaldo** de vez en cuenta en *Ajustes* (los datos viven solo en tu navegador).

Modo de sesión (60 / 90 / 120 min) en *Ajustes*: controla cuánto «refuerzo personalizado» se añade.

## Estructura del repositorio

```
index.html            # shell de la app
css/styles.css
js/                   # módulos ES: app (router), store, stats, srs, quiz, practice, audio, recorder, charts, views/*
data/
  plan.json           # 75 días (generado: node tools/build_plan.mjs)
  diagnostic.json     # diagnóstico
  days/dNN.json       # contenido de cada día (status "full" en plan.json)
  lessons/dNN.md      # mini-lección en Markdown
  mocks/dNN.json      # simulacros asociados a días del plan
  videos.json, resources.json, prompts.json, exam.md
audio/                # mp3 generados + manifest.json
tools/                # build_plan.mjs, generate_audio.py, setup_tts.sh, validate_content.mjs
tests/smoke.mjs       # prueba de humo con Playwright
.github/workflows/pages.yml
```

## Añadir o completar un día

1. Mira en `data/plan.json` el tema del día (o edita la tabla en `tools/build_plan.mjs`).
2. Crea `data/days/dNN.json` con este esquema:

```jsonc
{
  "n": 15,
  "objectives": ["…"],
  "vocab": { "theme": "…", "words": [["word", "pos", "definición EN", "traducción ES", "ejemplo EN"]] },
  "lesson": "data/lessons/d15.md",              // Markdown en español
  "videos": { "ids": ["id-en-videos.json"], "search": "búsqueda de respaldo" },
  "practice": [ /* bloques, ver abajo */ ],
  "quiz": [ /* preguntas */ ]
}
```

3. **Bloques de práctica** (`kind`): `questions` (conjunto de preguntas), `reading` (`passage` + `items`; `subtype: "daily"` para textos cotidianos), `listening` (`audio` + `items`), `writing` (`task: email|discussion`, `prompt`, `model`, `checklist`), `speaking` (`task: repeat|interview`), `authentic` (podcast/charla externa con tarea).
4. **Preguntas** (`type`): `mcq` (`options`, `answer` = índice), `multi` (`answer` = lista de índices), `order` (Build a Sentence: `words`, `answer`, `accept`), `cloze` (Complete the Words: `{{prefijo|resto}}` en `text`). Cada una lleva `id` único, `qtype` (para estadísticas) y `explain` (en español).
5. **Audio**: cualquier objeto `{"file": "audio/x.mp3", "segments": [{"voice": "af_heart", "who": "Student", "text": "…"}]}` se genera con `python3 tools/generate_audio.py` (ver abajo).
6. Ejecuta:

```bash
node tools/build_plan.mjs        # marca el día como "full"
python3 tools/generate_audio.py  # genera los mp3 que falten
node tools/validate_content.mjs  # valida ids, respuestas, audios, lecciones, videos
```

Los días sin JSON se muestran como **esqueleto**: tema + sesión guiada con material del banco general (`prompts.json`, `resources.json`).

## Audio (TTS local gratuito)

Los mp3 se generan con **Kokoro-82M** (Apache-2.0) vía `kokoro-onnx`, sin servicios de pago: voces estadounidenses (`af_*`, `am_*`) y británicas (`bf_*`, `bm_*`). **No hay voces australianas** en este modelo: el acento australiano del examen real no está cubierto (usa los podcasts auténticos de *Recursos* para exponerte a él).

```bash
pip install kokoro-onnx soundfile numpy        # ffmpeg también debe estar instalado
tools/setup_tts.sh                             # descarga el modelo (npm pack, sin ejecutar scripts) y verifica su sha256
python3 tools/generate_audio.py                # genera solo lo que cambió
```

`edge-tts` se probó primero pero no es viable en el entorno de desarrollo (sin acceso a los servidores de Microsoft). Si un mp3 no carga, el reproductor usa la **Web Speech API** del navegador como respaldo.

## Despliegue en GitHub Pages

El workflow `.github/workflows/pages.yml` valida el contenido y publica el sitio al hacer push a `main`. En el repositorio: *Settings → Pages → Source: GitHub Actions*.

## Pruebas

```bash
python3 -m http.server 8123 &
node tests/smoke.mjs        # requiere playwright (npm i -D playwright)
```

Comprueba que las vistas cargan sin errores de consola, que se guarda el progreso, y que la exportación/importación funciona.

## Honestidad sobre lo verificado

Ver el PR y la página «Sobre el examen» para el detalle de qué datos (formato del examen, requisito de Twente, videos, enlaces) se verificaron y cuáles no.
