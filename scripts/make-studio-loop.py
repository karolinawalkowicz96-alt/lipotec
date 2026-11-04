"""Studio "reveal" loop of the whole EVA SP6 on a black set.

Uses the cut-out derived from assets/original/product.jpg. The device pixels are
only relit (brightness and a gold rim light derived from its own silhouette);
shape, parts and colours are never changed. The camera cranes up from the base
to the full device with a slight perspective yaw, and the loop starts and ends
in low light so it closes without a visible cut.

Run: python3 scripts/make-studio-loop.py  (needs NumPy, SciPy, Pillow, ffmpeg)
"""
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "video"
OUT.mkdir(parents=True, exist_ok=True)
W, H, FPS, SECONDS = 1080, 1350, 30, 8
NAME = "loop-studio"

# ---- device layer from the original render (black background removed) ----
src = Image.open(ROOT / "assets" / "original" / "product.jpg").convert("RGB")
a = np.asarray(src).astype(np.int16)
lum = a.max(axis=2)
labels, _ = ndimage.label(lum < 14)
border = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
alpha = np.where(np.isin(labels, list(border)), 0, 255).astype(np.uint8)
dev = src.convert("RGBA")
dev.putalpha(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.8)))
dev = dev.crop(dev.getbbox())

# render the device at a fixed working height
DEV_H = 1500
dev = dev.resize((round(dev.width * DEV_H / dev.height), DEV_H), Image.LANCZOS)
D = np.asarray(dev).astype(np.float32)
rgb, al = D[..., :3], D[..., 3] / 255.0
# rim mask: thin band just inside the silhouette
inner = ndimage.gaussian_filter(ndimage.binary_erosion(al > 0.5, iterations=6).astype(np.float32), 3)
rim = np.clip(al - inner, 0, 1)
dh, dw = al.shape
yy, xx = np.mgrid[0:dh, 0:dw].astype(np.float32)
xn, yn = xx / dw, yy / dh


def coeffs(src_pts, dst_pts):
    m = []
    for (x, y), (u, v) in zip(dst_pts, src_pts):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        m.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    A = np.array(m, dtype=np.float64)
    B = np.array(src_pts, dtype=np.float64).reshape(8)
    return np.linalg.solve(A, B)


bgy, bgx = np.mgrid[0:H, 0:W].astype(np.float32)
frames = FPS * SECONDS
proc = subprocess.Popen(
    ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
     "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(OUT / f"{NAME}.mp4")],
    stdin=subprocess.PIPE,
)
poster = None
for f in range(frames):
    t = f / frames
    s = math.sin(math.pi * t)                 # 0 -> 1 -> 0
    env = 0.18 + 0.82 * (s ** 1.4)            # overall light level, low at the loop seam
    yaw = 6.0 * math.sin(2 * math.pi * t)     # degrees, returns to 0
    zoom = 1.30 - 0.30 * s                    # closer on the lower body -> full device -> closer
    focus_y = 0.64 - 0.14 * s                 # lower body -> centre of the device

    # --- relight the device (brightness only + gold rim) ---
    sweep_pos = -0.3 + 1.6 * t
    band = np.exp(-(((xn + 0.35 * yn) - sweep_pos * 1.35) / 0.16) ** 2)
    key = 0.32 + 0.68 * (0.55 * s + 0.45 * band)
    lit = rgb * (key * env)[..., None]
    lit += (band * env * 60.0)[..., None] * np.clip(rgb / 255.0, 0, 1) ** 2   # specular lift on bright metal
    gold = np.array([243, 204, 114], dtype=np.float32)
    rim_side = np.clip(0.35 + 0.65 * (1 - xn) * (0.5 + 0.5 * math.cos(2 * math.pi * t)) + 0.65 * xn * (0.5 - 0.5 * math.cos(2 * math.pi * t)), 0, 1)
    rim_amt = (rim * rim_side * (0.25 + 0.75 * env))[..., None]
    lit = lit * (1 - rim_amt * 0.6) + gold * rim_amt * 0.9
    layer = np.dstack([np.clip(lit, 0, 255), al * 255]).astype(np.uint8)
    layer = Image.fromarray(layer, "RGBA")

    # --- slight perspective yaw ---
    k = math.tan(math.radians(yaw)) * 0.5
    shrink = abs(k) * dh * 0.25
    if yaw >= 0:
        dst = [(0, 0), (dw, shrink), (dw, dh - shrink), (0, dh)]
    else:
        dst = [(0, shrink), (dw, 0), (dw, dh), (0, dh - shrink)]
    layer = layer.transform((dw, dh), Image.PERSPECTIVE, coeffs([(0, 0), (dw, 0), (dw, dh), (0, dh)], dst), Image.BICUBIC)

    # --- stage ---
    scale = (H * 0.80 / dh) * zoom
    lw, lh = max(1, round(dw * scale)), max(1, round(dh * scale))
    lay = layer.resize((lw, lh), Image.LANCZOS)
    cx = W * 0.5
    cy = H * 0.5 - (focus_y - 0.5) * lh
    x0, y0 = round(cx - lw / 2), round(cy - lh / 2)
    floor_y = y0 + lh

    # background: dark studio with a warm glow behind the device
    glow = np.exp(-(((bgx - cx) / (W * 0.45)) ** 2 + ((bgy - (cy - lh * 0.05)) / (H * 0.55)) ** 2))
    bg = np.zeros((H, W, 3), np.float32)
    bg += glow[..., None] * env * np.array([42, 31, 14], np.float32)
    # glossy floor gradient
    floor = np.exp(-(((bgy - floor_y) / (H * 0.07)) ** 2) - ((bgx - cx) / (W * 0.42)) ** 2) * 0.55
    bg += floor[..., None] * env * np.array([34, 28, 18], np.float32)
    canvas = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8)).convert("RGBA")

    # reflection
    refl = lay.transpose(Image.FLIP_TOP_BOTTOM)
    ra = np.asarray(refl).astype(np.float32)
    fade = np.clip(1 - np.linspace(0, 1, lh) / 0.28, 0, 1)[:, None] * 0.22
    ra[..., 3] *= fade
    refl = Image.fromarray(ra.astype(np.uint8), "RGBA").filter(ImageFilter.GaussianBlur(1.5))
    if floor_y < H:
        canvas.paste(refl, (x0, floor_y), refl)
    canvas.paste(lay, (x0, y0), lay)
    frame = np.asarray(canvas.convert("RGB"))
    proc.stdin.write(frame.tobytes())
    if f == frames // 2:
        poster = Image.fromarray(frame)

proc.stdin.close()
proc.wait()
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(OUT / f"{NAME}.mp4"), "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36",
                "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", "-an", str(OUT / f"{NAME}.webm")], check=True)
poster.save(OUT / f"{NAME}-poster.webp", "WEBP", quality=80, method=6)
for ext in ("mp4", "webm"):
    p = OUT / f"{NAME}.{ext}"
    print(p.relative_to(ROOT), f"{p.stat().st_size // 1024} KB")
