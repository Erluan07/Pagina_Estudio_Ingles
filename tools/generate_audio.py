#!/usr/bin/env python3
"""Genera los mp3 de data/**/*.json a partir de los objetos de audio.

Cualquier objeto JSON con las claves "file" y "segments" se considera un audio:
    {"file": "audio/d02-conv.mp3", "segments": [{"voice": "af_heart", "who": "Student", "text": "..."}]}
Voces Kokoro: af_*/am_* = inglés estadounidense; bf_*/bm_* = inglés británico.
(No hay voces australianas en Kokoro; ver README.)

Uso:  python3 tools/generate_audio.py [--force] [--only audio/archivo.mp3]
Requiere haber ejecutado tools/setup_tts.sh (o definir KOKORO_MODEL y KOKORO_VOICES).
Los mp3 ya generados con el mismo texto/voz se omiten (se compara un hash en audio/manifest.json).
"""
import argparse, glob, hashlib, json, os, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = os.environ.get("KOKORO_MODEL", os.path.join(ROOT, ".tts-cache", "kokoro-q8.onnx"))
VOICES = os.environ.get("KOKORO_VOICES", os.path.join(ROOT, ".tts-cache", "voices.npz"))
SPEED = 0.95
SR = 24000


def find_audio(obj, found):
    if isinstance(obj, dict):
        if "file" in obj and "segments" in obj:
            found[obj["file"]] = obj
        for v in obj.values():
            find_audio(v, found)
    elif isinstance(obj, list):
        for v in obj:
            find_audio(v, found)


def collect():
    found = {}
    for p in sorted(glob.glob(os.path.join(ROOT, "data", "**", "*.json"), recursive=True)):
        find_audio(json.load(open(p, encoding="utf-8")), found)
    return found


def spec_hash(spec):
    payload = json.dumps([spec["segments"], spec.get("speed", SPEED)], sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only")
    args = ap.parse_args()
    specs = collect()
    manifest_path = os.path.join(ROOT, "audio", "manifest.json")
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    todo = [f for f, s in specs.items() if (not args.only or f == args.only)
            and (args.force or manifest.get(f, {}).get("hash") != spec_hash(s) or not os.path.exists(os.path.join(ROOT, f)))]
    print(f"{len(specs)} audios en el contenido; {len(todo)} por generar.")
    if not todo:
        return
    from kokoro_onnx import Kokoro
    k = Kokoro(MODEL, VOICES)
    os.makedirs(os.path.join(ROOT, "audio"), exist_ok=True)
    for f in todo:
        s = specs[f]
        chunks, prev = [], None
        for seg in s["segments"]:
            v = seg["voice"]
            lang = "en-gb" if v[0] == "b" else "en-us"
            samples, sr = k.create(seg["text"], voice=v, speed=s.get("speed", SPEED), lang=lang)
            assert sr == SR
            gap = 0.0 if prev is None else (0.7 if prev != v else 0.45)
            chunks.append(np.zeros(int(SR * gap), dtype=np.float32))
            chunks.append(samples.astype(np.float32))
            prev = v
        audio = np.concatenate(chunks)
        peak = float(np.max(np.abs(audio))) or 1.0
        audio = audio * (0.89 / peak)
        out = os.path.join(ROOT, f)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                        "-codec:a", "libmp3lame", "-b:a", "48k", out], input=audio.tobytes(), check=True)
        dur = len(audio) / SR
        manifest[f] = {"hash": spec_hash(s), "seconds": round(dur, 1), "voices": sorted({x["voice"] for x in s["segments"]})}
        print(f"  {f}: {dur:.1f}s, {os.path.getsize(out)//1024} KB")
        json.dump(manifest, open(manifest_path, "w"), indent=1, sort_keys=True)
    print("Hecho.")


if __name__ == "__main__":
    sys.exit(main())
