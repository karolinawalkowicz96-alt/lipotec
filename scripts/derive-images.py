"""Generates optimised derivatives from the original renders in assets/original.

Originals are never modified. Run: python3 scripts/derive-images.py
Requires Pillow (with WebP) and NumPy/SciPy.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "original"
OUT = ROOT / "assets" / "img"
OUT.mkdir(parents=True, exist_ok=True)


def save_webp(img, name, width=None, quality=82, lossless=False):
    im = img
    if width and im.width > width:
        h = round(im.height * width / im.width)
        im = im.resize((width, h), Image.LANCZOS)
    path = OUT / f"{name}.webp"
    im.save(path, "WEBP", quality=quality, method=6, lossless=lossless)
    print(f"{path.relative_to(ROOT)}  {im.size}  {path.stat().st_size // 1024} KB")
    return im


def device_alpha(rgb):
    """Separates the device from its pure-black studio background.

    Only black pixels connected to the image border are treated as background,
    so dark parts inside the device stay opaque. The device itself is untouched.
    """
    a = np.asarray(rgb).astype(np.int16)
    lum = a.max(axis=2)
    dark = lum < 14
    labels, _ = ndimage.label(dark)
    border = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    bg = np.isin(labels, list(border))
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # soft edge: blend near-black edge pixels by their own luminance
    edge = ndimage.binary_dilation(~bg, iterations=2) & bg
    alpha[edge] = np.clip(lum[edge] * 12, 0, 255).astype(np.uint8)
    alpha_img = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.6))
    out = rgb.convert("RGBA")
    out.putalpha(alpha_img)
    return out


product = Image.open(SRC / "product.jpg").convert("RGB")

# Full studio render on black (hero / explorer)
save_webp(product, "eva-sp6-studio-1100", 1100, 84)
save_webp(product, "eva-sp6-studio-720", 720, 82)

# High-resolution cut-out derived from the same render (alpha only, pixels unchanged)
cut = device_alpha(product)
bbox = cut.getbbox()
cut = cut.crop(bbox)
save_webp(cut, "eva-sp6-cutout-1000", 1000, 86)
save_webp(cut, "eva-sp6-cutout-640", 640, 84)
print("cutout bbox in source:", bbox)

# Existing macro render without people (aspiration jar)
save_webp(Image.open(SRC / "macro-detail.jpg").convert("RGB"), "macro-jar", 1100, 82)

# Photographic opening (previous hero) — unchanged pixels, resized only
hero = Image.open(SRC / "hero-editorial.jpg").convert("RGB")
save_webp(hero, "hero-editorial-1672", 1672, 84)
save_webp(hero, "hero-editorial-960", 960, 82)

# Open Graph image 1200x630 built from the studio render on black
og = Image.new("RGB", (1200, 630), (0, 0, 0))
p = cut.copy()
p.thumbnail((1200, 590), Image.LANCZOS)
og.paste(p, (1200 - p.width - 120, 20), p)
og.save(OUT / "og-eva-sp6.jpg", "JPEG", quality=86, optimize=True, progressive=True)
print("assets/img/og-eva-sp6.jpg")

# AI-generated macro studio shots (Higgsfield / GPT Image 2.5, reference: assets/original/product.jpg).
# Checked visually against the reference render; labelled on the site as AI visualisations.
GEN = ROOT / "assets" / "generated"
for src in sorted(GEN.glob("macro-*.jpg")):
    im = Image.open(src).convert("RGB")
    save_webp(im, f"{src.stem}-1600", 1600, 84)
    save_webp(im, f"{src.stem}-900", 900, 82)

# Full-frame studio render with a transparent background (same 1100x1650 frame
# as eva-sp6-studio-*, so hotspot positions stay identical). Lets the page's
# own studio lighting show behind the device on every browser.
alpha_full = device_alpha(product)
save_webp(alpha_full, "eva-sp6-studio-alpha-1100", 1100, 86)
save_webp(alpha_full, "eva-sp6-studio-alpha-720", 720, 84)
