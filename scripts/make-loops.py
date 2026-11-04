"""Builds short seamless video loops from the macro shots in assets/generated.

The device pixels are never altered: the loop is a slow camera push (zoom/pan
that returns to the start) plus a soft light sweep that only brightens areas
that are already lit, so the black background stays black.

Run: python3 scripts/make-loops.py   (needs NumPy, Pillow, ffmpeg)
"""
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
GEN = ROOT / "assets" / "generated"
OUT = ROOT / "assets" / "video"
OUT.mkdir(parents=True, exist_ok=True)

FPS = 30
SECONDS = 6

LOOPS = [
    # name, source, output size, zoom amplitude, pan (x, y) in fraction of frame, sweep angle
    ("loop-panel", "macro-panel.jpg", (1280, 720), 0.06, (-0.03, 0.01), 0.25),
]


def render(name, src, size, zoom_amp, pan, angle):
    W, H = size
    im = Image.open(GEN / src).convert("RGB")
    # work at 1.25x output for headroom, keep aspect by cover-cropping
    base_w = int(W * 1.25)
    base_h = int(H * 1.25)
    sw, sh = im.size
    scale = max(base_w / sw, base_h / sh)
    im = im.resize((round(sw * scale), round(sh * scale)), Image.LANCZOS)
    iw, ih = im.size
    frames = FPS * SECONDS
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(OUT / f"{name}.mp4")],
        stdin=subprocess.PIPE,
    )
    poster = None
    for f in range(frames):
        t = f / frames  # 0..1, loop closes at 1
        e = (1 - math.cos(2 * math.pi * t)) / 2  # 0 -> 1 -> 0, smooth at both ends
        z = 1 + zoom_amp * e
        cw, ch = iw / (1.25 * z) * 1.0, ih / (1.25 * z)
        cx = iw / 2 + pan[0] * iw * e
        cy = ih / 2 + pan[1] * ih * e
        box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
        frame = im.resize((W, H), Image.LANCZOS, box=box)
        a = np.asarray(frame).astype(np.float32)
        # light sweep: a soft diagonal band crossing the frame once per loop,
        # fully off-frame at the start and the end so the loop is seamless
        pos = -0.45 + 1.9 * t
        d = (xx / W) + angle * (yy / H) - pos * (1 + angle)
        band = np.exp(-(d / 0.09) ** 2)
        lum = a.max(axis=2) / 255.0
        gain = (band * np.clip(lum, 0, 1) ** 1.6 * 0.55)[..., None]
        warm = np.array([255, 236, 196], dtype=np.float32)
        a = a + gain * (warm - a * 0.35)
        out = np.clip(a, 0, 255).astype(np.uint8)
        proc.stdin.write(out.tobytes())
        if f == 0:
            poster = Image.fromarray(out)
    proc.stdin.close()
    proc.wait()
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(OUT / f"{name}.mp4"), "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36",
                    "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", "-an", str(OUT / f"{name}.webm")], check=True)
    poster.save(OUT / f"{name}-poster.webp", "WEBP", quality=80, method=6)
    for ext in ("mp4", "webm"):
        p = OUT / f"{name}.{ext}"
        print(p.relative_to(ROOT), f"{p.stat().st_size // 1024} KB")


for args in LOOPS:
    render(*args)
