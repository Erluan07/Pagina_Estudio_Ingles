#!/usr/bin/env bash
# Prepara el TTS local (Kokoro-82M, Apache-2.0) en .tts-cache/ sin usar Hugging Face.
# Requiere: node/npm, python3 con `pip install kokoro-onnx soundfile numpy`, ffmpeg.
# Descarga dos paquetes de npm SIN ejecutar scripts (npm pack):
#   - kokoro-q8-shards: el modelo ONNX cuantizado partido en 6 trozos (sha256 conocido, se verifica abajo)
#   - kokoro-local-runtime: contiene las voces (.bin) de Kokoro
# Si tienes acceso a Hugging Face puedes usar en su lugar kokoro-v1.0.onnx + voices-v1.0.bin de kokoro-onnx.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=.tts-cache
mkdir -p "$OUT/dl/shards" "$OUT/dl/runtime"
EXPECTED=fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478
if [ ! -f "$OUT/kokoro-q8.onnx" ]; then
  (cd "$OUT/dl/shards" && npm pack kokoro-q8-shards --ignore-scripts >/dev/null && tar xzf ./*.tgz)
  cat "$OUT"/dl/shards/package/kokoro-q8.part{0,1,2,3,4,5}.bin > "$OUT/kokoro-q8.onnx"
fi
echo "$EXPECTED  $OUT/kokoro-q8.onnx" | sha256sum -c -
if [ ! -f "$OUT/voices.npz" ]; then
  (cd "$OUT/dl/runtime" && npm pack kokoro-local-runtime --ignore-scripts >/dev/null && tar xzf ./*.tgz)
  python3 -I - "$OUT" <<'PY'
import sys, glob, os, numpy as np
out = sys.argv[1]
voices = {}
for f in glob.glob(f"{out}/dl/runtime/package/voices/*.bin"):
    voices[os.path.basename(f)[:-4]] = np.fromfile(f, dtype=np.float32).reshape(-1, 1, 256)
np.savez(f"{out}/voices.npz", **voices)
print(len(voices), "voces:", ", ".join(sorted(voices)))
PY
fi
echo "Listo. Ahora: python3 tools/generate_audio.py"
