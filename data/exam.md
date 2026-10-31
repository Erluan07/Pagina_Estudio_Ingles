> **Fecha de consulta: 31 de octubre de 2026.** Esta página resume lo que pude confirmar y deja explícito lo que **no** pude verificar en la fuente primaria. Antes de matricularte, revisa siempre las páginas oficiales enlazadas abajo: los requisitos de las universidades cambian.

## 1. Formato vigente del TOEFL iBT (desde el 21 de enero de 2026)

Según las páginas de ETS que aparecieron en la búsqueda (contenido del examen, resumen del test y actualización de escala) y varias guías de terceros que coinciden entre sí, el examen tiene cuatro secciones con estas tareas:

| Sección | Tareas | Tiempo aproximado (ETS) |
|---|---|---|
| **Reading** | *Complete the Words* (completar palabras), *Read in Daily Life* (textos cotidianos), *Read an Academic Passage* (pasaje académico) | ≈ 30 min |
| **Listening** | *Listen and Choose a Response*, conversaciones, anuncios y charlas académicas | ≈ 29 min |
| **Writing** | *Build a Sentence*, *Write an Email*, *Write for an Academic Discussion* | ≈ 23 min |
| **Speaking** | *Listen and Repeat*, *Take an Interview* | ≈ 8 min |

- Reading y Listening son **adaptativos por etapas** (el segundo módulo depende de cómo te fue en el primero). Writing y Speaking no lo son.
- La duración total ronda **menos de 90 minutos** (30 + 29 + 23 + 8).
- Writing y Speaking se califican con una combinación de IA y evaluadores certificados por ETS (según las fuentes consultadas).
- Los **números exactos de ítems** por sección varían entre fuentes (p. ej. una tabla de ETS indica 50/47/12/11 ítems para R/L/W/S, pero esas cifras podrían incluir ítems no puntuados). Por eso esta app **no** afirma cuántas preguntas tendrás: practica el formato de cada tarea, no un número.

## 2. Escala de puntaje

- Desde enero de 2026 el informe de puntajes usa una **escala de 1 a 6 en pasos de 0.5**, alineada con el MCER/CEFR. El total es el promedio de las cuatro secciones, redondeado al 0.5 más cercano (según las guías consultadas).
- La escala 0-120 anterior se está retirando; ETS indica que hay una equivalencia para quienes comparan con requisitos antiguos, **pero la relación no es lineal** (varios puntajes 0-120 corresponden a una misma media banda). Ejemplos citados por ETS en materiales de ayuda: una banda 5 equivale a ≈ 95-106; y ETS recomienda que una institución que pedía **90** use **4.5**.
- No logré abrir la tabla oficial completa (ets.org no es accesible desde el entorno de desarrollo), así que **esta app no convierte** tus resultados a 0-120.

## 3. Requisito de la Universidad de Twente (maestrías)

Lo que muestran las páginas de admisión de utwente.nl en los resultados de búsqueda (consulta 31-oct-2026):

| Fecha del certificado | TOEFL iBT requerido |
|---|---|
| **Desde enero de 2026** (tu caso: examen el 15-ene-2027) | Certificado **no mayor de 2 años**; **total 4.5**, mínimo **4.5 en Reading, Listening y Writing** y **4 en Speaking** |
| Antes de enero de 2026 | Total 90, mínimo 21 en cada sección |

Notas importantes:
- Twente indica que **no acepta los puntajes «MyBest»**; la versión *Home Edition* solo se acepta por excepción y en periodos concretos.
- Los resultados de búsqueda también mostraron un texto que sugiere un umbral **más alto (5.0 total / 100 en la escala antigua) para algunas admisiones de septiembre de 2027**. El fragmento mezclaba varios bloques de requisitos, así que **no pude confirmar** si aplica a tu programa. Por prudencia, esta app usa **4.5 como meta mínima y 5.0 como margen recomendado**. Puedes cambiar ambos valores en *Ajustes*.
- Cada programa de maestría puede tener su propia página con matices. **Confirma el requisito de tu programa y la fecha límite de entrega de resultados** (con examen el 15 de enero necesitas que el informe llegue a tiempo).

## 4. Qué verifiqué y qué no

| Dato | Estado |
|---|---|
| Tareas por sección del formato 2026 | Confirmado en varios resultados de ETS y guías coincidentes (no pude abrir ets.org directamente) |
| Duraciones aproximadas por sección | De la tabla de ETS vista en resultados de búsqueda; no abierta directamente |
| Escala 1-6 con pasos de 0.5 | Confirmado en resultados de ETS (ayuda de TOEFL Access) |
| Equivalencia 4.5 ↔ 90 | Recomendación de ETS vista en resultados de búsqueda; no hay equivalencia «oficial» de Twente |
| Requisito de Twente 4.5/4.5/4.5/4 | Visto en resultados de la página de requisitos de lengua de utwente.nl; **no pude abrirla** (dominio bloqueado en el entorno) |
| Posible umbral 5.0 para septiembre de 2027 | **No confirmado** |
| Plazo de entrega de resultados de ETS | **No verificado**: consúltalo en ETS |

## 5. Fuentes para verificar tú mismo/a

- [ETS · Contenido del TOEFL iBT](https://www.ets.org/toefl/test-takers/ibt/about/content.html)
- [ETS · Sección Reading](https://www.ets.org/toefl/test-takers/ibt/about/content/reading.html) y [Speaking](https://www.ets.org/toefl/test-takers/ibt/about/content/speaking.html)
- [ETS · Actualización de la escala de puntajes (TOEFL Access)](https://toeflaccess.ets.org/help/en/articles/11758616-toefl-ibt-score-scale-update-what-you-need-to-know)
- [Universidad de Twente · Requisito de idioma para maestrías](https://www.utwente.nl/en/education/master/admission-requirements/language-requirement)

## 6. Cómo usa esta app las «bandas»

Tus bandas estimadas se calculan así (todo local, sin servidor): para Reading/Listening, el porcentaje de acierto en el material de esta app se convierte linealmente a 1-6 (`banda ≈ 1 + 5 × acierto`, redondeada a 0.5); para Writing/Speaking, el promedio de tu autoevaluación con rúbrica (0-5) más 1. **Es una brújula, no un pronóstico oficial.** Las preguntas de esta app son originales y no tienen la misma dificultad calibrada que el examen real, y la autoevaluación suele ser optimista.
