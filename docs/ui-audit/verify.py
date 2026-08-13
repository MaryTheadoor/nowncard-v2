from PIL import Image

# 1) Brass check: find brass-family pixels in the dark hero capture (08)
im = Image.open('08-local-dark.png').convert('RGB')
w, h = im.size
px = im.load()
brass, muddy = [], []
for y in range(0, h // 2, 2):
    for x in range(0, w, 2):
        r, g, b = px[x, y]
        # brass family: R > 150, G in 100-210, B < 120
        if r > 150 and 100 <= g <= 210 and b < 120 and r > b + 60:
            brass.append((r, g, b))
        # muddy bronze: R 60-150, G 40-110, B < 70
        if 60 <= r <= 150 and 40 <= g <= 110 and b < 70:
            muddy.append((r, g, b))
def avg(lst):
    n = len(lst)
    return (sum(c[0] for c in lst)//n, sum(c[1] for c in lst)//n, sum(c[2] for c in lst)//n, n)
print('08 dark: brass pixels', avg(brass), ' muddy pixels', avg(muddy))

# 2) Chamfer check on 09: locate the large gold panel, inspect its top-left corner
im2 = Image.open('09-local-chamfers.png').convert('RGB')
w2, h2 = im2.size
px2 = im2.load()
gold = [(x, y) for y in range(h2 // 3, h2, 3) for x in range(0, w2, 3)
        if (lambda p: p[0] > 180 and 130 < p[1] < 220 and p[2] < 120)(px2[x, y])]
if gold:
    xs = [p[0] for p in gold]; ys = [p[1] for p in gold]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    print(f'09 gold panel bbox: x {x0}-{x1} y {y0}-{y1}')
    # count gold pixels in the top-left 40px corner square
    corner = sum(1 for y in range(y0, y0 + 40) for x in range(x0, x0 + 40)
                 if px2[x, y][0] > 180 and 130 < px2[x, y][1] < 220 and px2[x, y][2] < 120)
    print(f'  gold pixels in 40x40 top-left corner: {corner}/1600  (chamfered corner ~ 0, square ~ full)')
    # same for top-right
    corner2 = sum(1 for y in range(y0, y0 + 40) for x in range(x1 - 40, x1)
                  if px2[x, y][0] > 180 and 130 < px2[x, y][1] < 220 and px2[x, y][2] < 120)
    print(f'  gold pixels in 40x40 top-right corner: {corner2}/1600')

# 3) Paper brightness + texture on 10
im3 = Image.open('10-local-light.png').convert('RGB')
im3s = im3.resize((240, 135))
px3 = list(im3s.getdata())
avg3 = tuple(sum(c[i] for c in px3) // len(px3) for i in range(3))
print('10 light avg rgb', avg3)
