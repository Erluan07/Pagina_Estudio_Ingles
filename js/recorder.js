// Grabadora local para Speaking (MediaRecorder). El audio nunca sale del navegador.
import { h, fmtClock } from './util.js';

const supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

/**
 * opts: { prepSeconds, speakSeconds, onRecorded(blobUrl) }
 * Flujo: [Preparar y grabar] -> cuenta atrás de preparación -> graba hasta speakSeconds -> reproducción local.
 */
export function createRecorder({ prepSeconds = 0, speakSeconds = 45, label = 'Tu respuesta' } = {}) {
  const status = h('div', { class: 'small', role: 'status', 'aria-live': 'polite' }, 'Listo.');
  const clock = h('div', { class: 'big', 'aria-hidden': 'true' }, fmtClock(prepSeconds || speakSeconds));
  const startBtn = h('button', { class: 'btn', type: 'button' }, prepSeconds ? `● Preparar (${prepSeconds}s) y grabar` : '● Grabar');
  const stopBtn = h('button', { class: 'btn btn-secondary', type: 'button', disabled: true }, '■ Detener');
  const playback = h('audio', { controls: true, hidden: true, 'aria-label': `Reproducir ${label}` });
  const clearBtn = h('button', { class: 'btn btn-ghost btn-small', type: 'button', hidden: true }, 'Borrar grabación');
  const box = h('div', { class: 'rec' }, h('strong', null, label), clock, h('div', { class: 'btn-row' }, startBtn, stopBtn, clearBtn), status, playback,
    h('p', { class: 'small muted' }, 'La grabación se queda en tu navegador: no se sube a ningún servidor.'));

  if (!supported()) {
    startBtn.disabled = true;
    status.textContent = 'Tu navegador no permite grabar audio aquí (necesita HTTPS o localhost y permiso de micrófono). Puedes practicar hablando en voz alta con el temporizador.';
  }

  let stream = null, rec = null, chunks = [], timer = null, phase = 'idle', url = null, tStart = 0, started = false;

  const finishTimer = () => { clearInterval(timer); timer = null; };
  function stopAll() {
    finishTimer();
    if (rec && rec.state !== 'inactive') rec.stop();
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  }
  function beginRecording() {
    phase = 'recording'; box.classList.add('recording');
    chunks = [];
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m));
    rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      box.classList.remove('recording');
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      playback.src = url; playback.hidden = false; clearBtn.hidden = false;
      status.textContent = `Grabación lista (${fmtClock((Date.now() - tStart) / 1000)}). Escúchala y compárala con la respuesta modelo.`;
      phase = 'done'; started = true;
      startBtn.disabled = false; startBtn.textContent = '● Grabar de nuevo'; stopBtn.disabled = true;
      box.dispatchEvent(new CustomEvent('recorded', { bubbles: true }));
    };
    rec.start();
    tStart = Date.now();
    status.replaceChildren(h('span', { class: 'dot' }), 'Grabando… habla con naturalidad.');
    stopBtn.disabled = false;
    let left = speakSeconds;
    clock.textContent = fmtClock(left);
    finishTimer();
    timer = setInterval(() => {
      left--; clock.textContent = fmtClock(left);
      if (left <= 0) stopAll();
    }, 1000);
  }

  startBtn.addEventListener('click', async () => {
    try {
      startBtn.disabled = true;
      playback.hidden = true; clearBtn.hidden = true;
      status.textContent = 'Solicitando permiso de micrófono…';
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      status.textContent = 'No se pudo acceder al micrófono (' + (e.name || 'error') + '). Revisa los permisos del navegador o practica en voz alta con el temporizador.';
      startBtn.disabled = false; return;
    }
    if (prepSeconds) {
      phase = 'prep';
      let left = prepSeconds;
      clock.textContent = fmtClock(left);
      status.textContent = 'Preparación: organiza tus ideas (no hables todavía).';
      stopBtn.disabled = false;
      timer = setInterval(() => {
        left--; clock.textContent = fmtClock(left);
        if (left <= 0) { finishTimer(); beginRecording(); }
      }, 1000);
    } else beginRecording();
  });
  stopBtn.addEventListener('click', () => {
    if (phase === 'prep') { finishTimer(); beginRecording(); } else stopAll();
  });
  clearBtn.addEventListener('click', () => {
    if (url) URL.revokeObjectURL(url);
    url = null; playback.removeAttribute('src'); playback.hidden = true; clearBtn.hidden = true; clock.textContent = fmtClock(prepSeconds || speakSeconds); status.textContent = 'Grabación borrada.'; started = false;
  });

  return { el: box, hasRecording: () => started, stop: stopAll };
}
