from PIL import Image
from collections import Counter
import colorsys, glob, os

def summarize(path):
    im = Image.open(path).convert('RGB')
    im = im.resize((160, 100))  # downscale for speed
    px = list(im.getdata())
    n = len(px)
    # quantize to 4-bit buckets to find dominant colors
    buckets = Counter()
    for r, g, b in px:
        buckets[(r//16*16, g//16*16, b//16*16)] += 1
    top = buckets.most_common(6)
    total = sum(c for _, c in buckets.items())
    # saturation + brightness stats
    sats, vals = [], []
    for r, g, b in px:
        h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
        sats.append(s); vals.append(v)
    avg_rgb = tuple(sum(c[i] for c in px)//n for i in range(3))
    print(f'== {os.path.basename(path)}')
    print(f'   avg rgb {avg_rgb}  sat mean {sum(sats)/n:.2f}  val mean {sum(vals)/n:.2f}')
    for (r, g, b), cnt in top:
        print(f'   #{r:02x}{g:02x}{b:02x}  {cnt/total*100:5.1f}%')

for f in sorted(glob.glob('*.png')):
    summarize(f)
