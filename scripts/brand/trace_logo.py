"""
Trace the AbrahamMoses logo master into vector paths, one per part.

    pip install potracer pillow numpy
    python3 scripts/brand/trace_logo.py design/brand/abrahammoses-logo-master.png design/brand/logo-paths.json
    npm run brand:build

A one-off step: the paths it writes are committed, and `npm run brand:build`
derives every brand asset from them. Rendering the result over the master
(see build-brand.mjs --check) gives an intersection-over-union of 0.988; the
remaining differences are single anti-aliased edge pixels.
"""
import json, re, sys
import numpy as np
from PIL import Image, ImageFilter
import potrace

SRC, OUT = sys.argv[1], sys.argv[2]
SCALE = 4
im = Image.open(SRC).convert('L')
X0, Y0, X1, Y1 = 84, 333, 1586, 601          # crop with an 8px margin around the ink
crop = im.crop((X0, Y0, X1, Y1))
big = crop.resize((crop.width * SCALE, crop.height * SCALE), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
ink = np.array(big) < 128

def pt(p):
    x, y = (p.x, p.y) if hasattr(p, 'x') else p
    return f'{x / SCALE:.2f} {y / SCALE:.2f}'

def trace(mask):
    # potracer treats True as white, so pass the inverse of the ink mask.
    plist = potrace.Bitmap(~mask).trace(turdsize=60, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,
                                       alphamax=1.0, opticurve=True, opttolerance=0.2)
    d = []
    for curve in plist:
        d.append('M' + pt(curve.start_point))
        for s in curve.segments:
            if s.is_corner:
                d.append('L' + pt(s.c) + 'L' + pt(s.end_point))
            else:
                d.append('C' + pt(s.c1) + ' ' + pt(s.c2) + ' ' + pt(s.end_point))
        d.append('Z')
    return ''.join(d)

parts = {}
for name, (a, b) in {'emblem': (84, 340), 'divider': (340, 366), 'wordmark': (366, 1586)}.items():
    m = np.zeros_like(ink)
    lo, hi = (a - X0) * SCALE, (b - X0) * SCALE
    m[:, lo:hi] = ink[:, lo:hi]
    parts[name] = trace(m)
def r1(d):
    # One decimal place is far below a device pixel at any size the logo is shown.
    return re.sub(r'-?\d+\.\d+', lambda m: f'{float(m.group()):.1f}'.rstrip('0').rstrip('.'), d)

json.dump({'source': SRC.split('/')[-1], 'crop': [X0, Y0, X1, Y1], 'width': X1 - X0, 'height': Y1 - Y0,
           'parts': {k: r1(v) for k, v in parts.items()}}, open(OUT, 'w'), indent=1)
print({k: len(v) for k, v in parts.items()}, 'viewBox', X1 - X0, Y1 - Y0)
