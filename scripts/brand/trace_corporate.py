"""
Trace the AbrahamMoses corporate logo master (mark + two-line "Abraham Moses"
wordmark, white on navy) into vector paths.

    apt-get install potrace && pip install pillow numpy
    python3 scripts/brand/trace_corporate.py \
        design/brand/corporate/abrahammoses-corporate-master.png \
        design/brand/corporate/logo-paths.json
    npm run brand:build

A one-off step: the paths are committed and `npm run brand:build` derives the
logo files, browser icon, touch icon and social preview from them. Rendered
back over the 1967x799 master the trace differs by a mean of 0.74/255 per pixel
(198 of ~281,000 ink pixels differ by more than a quarter), i.e. edge pixels only.
"""
import json, re, subprocess, sys, tempfile, os
from PIL import Image, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
S = 4                                   # trace at 4x for smooth curves
MARK = (237, 147, 721, 602)             # ink bounds in the master (x0, y0, x1, y1)
WORD = (785, 217, 1767, 579)
PAD = 10
src = Image.open(SRC).convert('L')

def trace(box):
    x0, y0, x1, y1 = box[0] - PAD, box[1] - PAD, box[2] + PAD, box[3] + PAD
    c = src.crop((x0, y0, x1, y1)).resize(((x1 - x0) * S, (y1 - y0) * S), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.5))
    with tempfile.TemporaryDirectory() as t:
        c.point(lambda v: 0 if v > 127 else 255).convert('1').save(f'{t}/in.pbm')   # white ink -> black for potrace
        subprocess.run(['potrace', f'{t}/in.pbm', '-s', '-o', f'{t}/out.svg', '-t', '20', '-a', '1.0', '-O', '0.4', '--flat'], check=True)
        svg = open(f'{t}/out.svg').read()
    Hpt = float(re.search(r'translate\(0\.000000,([\d.]+)\)', svg).group(1))
    d = ' '.join(p.replace('\n', ' ') for p in re.findall(r'<path d="([^"]+)"', svg, re.S))
    return absolute(d, x0, y0, Hpt)

def absolute(d, ox, oy, H):
    """potrace emits relative commands in a flipped 0.1pt space; return absolute master-pixel coordinates."""
    toks = re.findall(r'[MmCcLlZz]|-?\d+\.?\d*', d)
    out, i, cx, cy, sx, sy, cmd = [], 0, 0, 0, 0, 0, None
    f = lambda x, y: (ox + 0.1 * x / S, oy + (H - 0.1 * y) / S)
    while i < len(toks):
        if re.match('[A-Za-z]', toks[i]):
            cmd = toks[i]; i += 1
        if cmd in 'Zz':
            out.append('Z'); cx, cy = sx, sy; continue
        n = {'M': 2, 'm': 2, 'L': 2, 'l': 2, 'C': 6, 'c': 6}[cmd]
        v = list(map(float, toks[i:i + n])); i += n
        pts = [(cx + v[k], cy + v[k + 1]) if cmd.islower() else (v[k], v[k + 1]) for k in range(0, n, 2)]
        out.append((cmd.upper(), [f(*p) for p in pts]))
        cx, cy = pts[-1]
        if cmd in 'Mm':
            sx, sy = cx, cy; cmd = 'l' if cmd == 'm' else 'L'
    return out

mark, word = trace(MARK), trace(WORD)
pts = [p for seg in mark + word if seg != 'Z' for p in seg[1]]
X0, Y0 = min(p[0] for p in pts), min(p[1] for p in pts)
X1, Y1 = max(p[0] for p in pts), max(p[1] for p in pts)
mark_x1 = max(p[0] for seg in mark if seg != 'Z' for p in seg[1])

def fmt(segs):
    return ''.join('Z' if s == 'Z' else s[0] + ' '.join(f'{x - X0:.1f} {y - Y0:.1f}' for x, y in s[1]) for s in segs)

json.dump({
    'source': os.path.basename(SRC),
    'crop': [round(X0, 1), round(Y0, 1), round(X1, 1), round(Y1, 1)],
    'width': round(X1 - X0, 1), 'height': round(Y1 - Y0, 1),
    'markWidth': round(mark_x1 - X0, 1), 'markHeight': round(Y1 - Y0, 1),
    'navy': '#080e16',
    'parts': {'mark': fmt(mark), 'wordmark': fmt(word)},
}, open(OUT, 'w'))
print('wrote', OUT)
