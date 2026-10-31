// Reproductor de audio con límite de reproducciones, velocidad y respaldo con Web Speech API.
import { h, fmtClock } from './util.js';

const langOf = (voice) => (voice && voice[0] === 'b' ? 'en-GB' : 'en-US');
const MALE = (voice) => voice && voice[1] === 'm';

/** Reproduce los segmentos con la voz del navegador (respaldo si el mp3 no carga). */
function speakFallback(segments, rate, onend) {
  if (!('speechSynthesis' in window)) { onend && onend(false); return; }
  window.speechSynthesis.cancel();
  const voices = window.speechSynthesis.getVoices();
  let i = 0;
  const next = () => {
    if (i >= segments.length) { onend && onend(true); return; }
    const seg = segments[i++];
    const u = new SpeechSynthesisUtterance(seg.text);
    u.lang = langOf(seg.voice); u.rate = rate;
    const cand = voices.filter((v) => v.lang && v.lang.replace('_', '-').startsWith(u.lang));
    if (cand.length) u.voice = cand[MALE(seg.voice) && cand.length > 1 ? 1 : 0];
    u.onend = next; u.onerror = next;
    window.speechSynthesis.speak(u);
  };
  next();
}

/**
 * spec: { file, segments:[{voice, who?, text}] }
 * opts: { maxPlays, label }
 * Devuelve { el, transcriptEl(), reveal() }
 */
export function createPlayer(spec, opts = {}) {
  const maxPlays = opts.maxPlays || Infinity;
  const audio = new Audio();
  audio.preload = 'none';
  audio.src = spec.file;
  let plays = 0, usingFallback = false, playing = false;

  const playBtn = h('button', { class: 'btn btn-small', type: 'button', 'aria-label': 'Reproducir audio' }, '▶ Escuchar');
  const prog = h('progress', { class: 'bar', max: 100, value: 0, 'aria-label': 'Progreso del audio' });
  const time = h('span', { class: 'time' }, '00:00');
  const speed = h('select', { 'aria-label': 'Velocidad de reproducción' },
    [['0.85', '0.85×'], ['1', '1×'], ['1.15', '1.15×']].map(([v, t]) => h('option', { value: v, selected: v === '1' }, t)));
  const info = h('span', { class: 'time' }, maxPlays === Infinity ? '' : `Reproducciones: 0/${maxPlays}`);
  const msg = h('div', { class: 'small muted', role: 'status' });
  const el = h('div', { class: 'player' }, playBtn, prog, time, h('label', { class: 'small' }, 'Velocidad ', speed), info, msg);

  const updateInfo = () => { if (maxPlays !== Infinity) info.textContent = `Reproducciones: ${plays}/${maxPlays}`; };
  const setPlaying = (v) => { playing = v; playBtn.textContent = v ? '⏸ Pausa' : '▶ Escuchar'; playBtn.setAttribute('aria-label', v ? 'Pausar audio' : 'Reproducir audio'); };
  const exhausted = () => plays >= maxPlays && !playing;

  audio.addEventListener('timeupdate', () => {
    if (audio.duration) prog.value = (audio.currentTime / audio.duration) * 100;
    time.textContent = fmtClock(audio.currentTime);
  });
  audio.addEventListener('ended', () => { setPlaying(false); prog.value = 100; if (plays >= maxPlays) playBtn.disabled = true; });
  audio.addEventListener('error', () => {
    if (usingFallback) return;
    usingFallback = true;
    msg.textContent = 'No se pudo cargar el archivo de audio; se usará la voz de tu navegador (calidad y acento pueden variar).';
  });

  playBtn.addEventListener('click', () => {
    if (usingFallback || audio.error) {
      usingFallback = true;
      if (playing) { window.speechSynthesis.cancel(); setPlaying(false); return; }
      if (plays >= maxPlays) return;
      plays++; updateInfo(); setPlaying(true);
      msg.textContent = 'Usando la voz del navegador.';
      speakFallback(spec.segments, Number(speed.value), (ok) => { setPlaying(false); if (!ok) msg.textContent = 'Tu navegador no ofrece síntesis de voz.'; if (plays >= maxPlays) playBtn.disabled = true; });
      return;
    }
    if (playing) { audio.pause(); setPlaying(false); return; }
    if (audio.currentTime === 0 || audio.ended) {
      if (plays >= maxPlays) return;
      plays++; updateInfo();
    }
    audio.playbackRate = Number(speed.value);
    audio.play().then(() => setPlaying(true)).catch(() => { /* el evento 'error' activa el respaldo */ if (audio.error) playBtn.click(); });
  });
  speed.addEventListener('change', () => { audio.playbackRate = Number(speed.value); });

  const transcript = h('div', { class: 'transcript', hidden: true },
    h('strong', null, 'Transcripción'),
    spec.segments.map((s) => h('p', null, s.who ? h('strong', null, s.who + ': ') : '', s.text)));
  const wrapper = h('div', null, el, h('p', { class: 'small muted' }, maxPlays === Infinity ? 'Consejo: escucha primero sin leer; la transcripción se desbloquea al comprobar tus respuestas.' : `Como en el examen, solo puedes escuchar ${maxPlays === 1 ? 'una vez' : maxPlays + ' veces'}.`), transcript);
  return {
    el: wrapper,
    reveal() { transcript.hidden = false; },
    stop() { audio.pause(); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); },
  };
}
