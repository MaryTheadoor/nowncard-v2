from PIL import Image
import sys

def patch_stats(path):
    im = Image.open(path).convert('L').resize((480, 270))
    px = im.load()
    w, h = im.size
    stds = []
    for y0 in range(0, h - 8, 8):
        for x0 in range(0, w - 8, 8):
            vals = [px[x0 + dx, y0 + dy] for dy in range(8) for dx in range(8)]
            m = sum(vals) / len(vals)
            stds.append((sum((v - m) ** 2 for v in vals) / len(vals)) ** 0.5)
    stds.sort()
    n = len(stds)
    return stds[n // 2], stds[n * 9 // 10]

for f in sys.argv[1:]:
    med, p90 = patch_stats(f)
    print(f'{f}: median local std = {med:.2f}  p90 = {p90:.2f}')
