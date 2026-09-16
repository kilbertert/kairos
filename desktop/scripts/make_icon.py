#!/usr/bin/env python3
"""Regenerate desktop/src-tauri/icons/icon.ico from the web app's source icon.

Tauri bundles a Windows .ico and the repo ships PNGs only, so one has to be
derived. The result is committed rather than generated during a build: doing it
in the Windows job would need Pillow and a `python3` invocation on a runner where
neither is guaranteed. Run this by hand whenever the web icon changes.

Run from anywhere:  python3 desktop/scripts/make_icon.py
Requires Pillow.
"""
import pathlib
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: pip install Pillow")

SIZES = [16, 24, 32, 48, 64, 128, 256]

root = pathlib.Path(__file__).resolve().parents[2]
src = root / "web/public/images/icon-512.png"
dst = root / "desktop/src-tauri/icons/icon.ico"

if not src.is_file():
    sys.exit(f"missing source icon: {src}")

dst.parent.mkdir(parents=True, exist_ok=True)
with Image.open(src) as image:
    image.convert("RGBA").save(dst, format="ICO", sizes=[(s, s) for s in SIZES])

print(f"wrote {dst.relative_to(root)} from {src.relative_to(root)}")
