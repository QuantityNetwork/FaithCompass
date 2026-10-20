"""
Trace the official one-word AbrahamMoses logo (the "A" mark beside "AbrahamMoses"
on one line) into vector paths.

    apt-get install potrace && pip install pillow numpy
    python3 scripts/brand/trace_official.py \
        design/brand/official/abrahammoses-official-navy-on-white.png \
        design/brand/official/logo-paths.json
    npm run brand:build

The navy-on-white file is traced: it is the cleaner of the two supplied exports
(the white-on-black one is slightly heavier, with "A" and "b" touching). Mark and
wordmark are found from the ink's column profile (the widest gap separates them),
traced separately at 4x, and stored with the lockup's top-left corner at 0,0.
"""
import json, os, re, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
S = 4
PAD = 10
src = Image.open(SRC).convert('L')
ink = np.array(src) < 128                       # dark ink on white

cols = np.nonzero(ink.any(axis=0))[0]
rows = np.nonzero(ink.any(axis=1))[0]
gaps = np.diff(cols)
split = int(np.argmax(gaps))                    # widest gap: between mark and wordmark
MARK = (int(cols[0]), int(rows[0]), int(cols[split]) + 1, int(rows[-1]) + 1)
WORD = (int(cols[split + 1]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1)

def absolute(d, ox, oy, H):
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

def trace(box):
    x0, y0, x1, y1 = box[0] - PAD, box[1] - PAD, box[2] + PAD, box[3] + PAD
    c = src.crop((x0, y0, x1, y1)).resize(((x1 - x0) * S, (y1 - y0) * S), Image.LANCZOS).filter(ImageFilter.GaussianBlur(2.5))
    with tempfile.TemporaryDirectory() as t:
        c.point(lambda v: 255 if v > 127 else 0).convert('1').save(f'{t}/in.pbm')   # dark ink stays black for potrace
        subprocess.run(['potrace', f'{t}/in.pbm', '-s', '-o', f'{t}/out.svg', '-t', '40', '-a', '1.1', '-O', '0.6', '--flat'], check=True)
        svg = open(f'{t}/out.svg').read()
    Hpt = float(re.search(r'translate\(0\.000000,([\d.]+)\)', svg).group(1))
    d = ' '.join(p.replace('\n', ' ') for p in re.findall(r'<path d="([^"]+)"', svg, re.S))
    return absolute(d, x0, y0, Hpt)

mark, word = trace(MARK), trace(WORD)
pts = [p for seg in mark + word if seg != 'Z' for p in seg[1]]
X0, Y0 = min(p[0] for p in pts), min(p[1] for p in pts)
X1, Y1 = max(p[0] for p in pts), max(p[1] for p in pts)
mx = [p for seg in mark if seg != 'Z' for p in seg[1]]

def fmt(segs):
    return ''.join('Z' if s == 'Z' else s[0] + ' '.join(f'{x - X0:.1f} {y - Y0:.1f}' for x, y in s[1]) for s in segs)

json.dump({
    'source': os.path.basename(SRC),
    'crop': [round(X0, 1), round(Y0, 1), round(X1, 1), round(Y1, 1)],
    'width': round(X1 - X0, 1), 'height': round(Y1 - Y0, 1),
    'markWidth': round(max(p[0] for p in mx) - X0, 1),
    'markHeight': round(max(p[1] for p in mx) - min(p[1] for p in mx), 1),
    'navy': '#091121',
    'parts': {'mark': fmt(mark), 'wordmark': fmt(word)},
}, open(OUT, 'w'))
print('wrote', OUT, 'mark', MARK, 'word', WORD)
