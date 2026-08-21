from PIL import Image, ImageDraw, ImageChops
import os

W, H = 64, 90
NW, NH = 48, 68
BLACK = (26, 26, 46, 255)

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'renderer', 'assets')
os.makedirs(OUT_DIR, exist_ok=True)


def new_canvas():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))


def two_tone(img, shape_fn, bbox, colorA, colorB, width=2):
    shape_mask = Image.new('L', (W, H), 0)
    md = ImageDraw.Draw(shape_mask)
    shape_fn(md, bbox, fill=255)
    x0, y0, x1, y1 = bbox
    xc = (x0 + x1) / 2
    right_mask = Image.new('L', (W, H), 0)
    rd = ImageDraw.Draw(right_mask)
    rd.rectangle([xc, y0 - 3, x1 + 3, y1 + 3], fill=255)
    inter = ImageChops.multiply(shape_mask, right_mask)
    img.paste(Image.new('RGBA', (W, H), colorA), mask=shape_mask)
    img.paste(Image.new('RGBA', (W, H), colorB), mask=inter)
    d = ImageDraw.Draw(img)
    shape_fn(d, bbox, fill=None, outline=BLACK, width=width)


def square_shape(draw, bbox, fill=None, outline=None, width=None):
    draw.rounded_rectangle(bbox, radius=6, fill=fill, outline=outline, width=width)


def circle_shape(draw, bbox, fill=None, outline=None, width=None):
    draw.ellipse(bbox, fill=fill, outline=outline, width=width)


def add_eye_pie(d, cx, cy, r, pie_color):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 255), outline=BLACK, width=2)
    d.pieslice([cx - r, cy - r, cx + r, cy + r], start=270, end=360, fill=pie_color)
    d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=BLACK)


def add_eye_target(d, cx, cy, r):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 255), outline=BLACK, width=2)
    d.ellipse([cx - r * 0.6, cy - r * 0.6, cx + r * 0.6, cy + r * 0.6], outline=BLACK, width=2)
    d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=BLACK)


def add_eye_dotmis(d, cx, cy, r):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BLACK)


def small_eye(d, cx, cy):
    d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=BLACK)


HEAD_BBOX = [14, 8, 50, 44]
BODY_BBOX = [12, 44, 52, 88]

GOLD = (240, 200, 105, 255)


def add_bellhop_cap(d, band_color, top=6, cx=32):
    left, right = cx - 11, cx + 11
    bandY = top + 9
    d.polygon([(left + 2, top), (right - 2, top), (right, bandY), (left, bandY)],
               outline=BLACK, width=2)
    d.rectangle([left, bandY - 3, right, bandY], fill=band_color, outline=BLACK, width=1)
    d.ellipse([cx - 3, top - 4, cx + 3, top + 2], fill=GOLD, outline=BLACK, width=1)


def add_cap_fill(d, body_c, top=6, cx=32):
    left, right = cx - 11, cx + 11
    bandY = top + 9
    d.polygon([(left + 2, top), (right - 2, top), (right, bandY), (left, bandY)], fill=body_c[0])


def add_bowtie(d, bow_color, cx=32, cy=46):
    d.polygon([(cx - 8, cy - 5), (cx - 1, cy), (cx - 8, cy + 5)], fill=bow_color, outline=BLACK, width=1)
    d.polygon([(cx + 8, cy - 5), (cx + 1, cy), (cx + 8, cy + 5)], fill=bow_color, outline=BLACK, width=1)
    d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=GOLD, outline=BLACK, width=1)


def add_glasses(d, lx=27, rx=41, cy=25):
    d.ellipse([lx - 8, cy - 8, lx + 8, cy + 8], outline=BLACK, width=2)
    d.ellipse([rx - 5, cy - 5, rx + 5, cy + 5], outline=BLACK, width=2)
    d.line([(lx + 8, cy), (rx - 5, cy)], fill=BLACK, width=2)


def add_magnifier(img, d, cx=54, cy=62):
    d.line([(cx + 6, cy + 10), (cx + 14, cy + 20)], fill=GOLD, width=4)
    lens_r = 10
    d.ellipse([cx - lens_r, cy - lens_r, cx + lens_r, cy + lens_r],
               fill=(255, 255, 255, 90), outline=BLACK, width=3)


def make_base(img, spec):
    two_tone(img, square_shape, BODY_BBOX, spec['body_c'][0], spec['body_c'][1], width=2)
    add_cap_fill(ImageDraw.Draw(img), spec['body_c'])
    two_tone(img, circle_shape, HEAD_BBOX, spec['head_c'][0], spec['head_c'][1], width=2)
    d = ImageDraw.Draw(img)
    add_bellhop_cap(d, spec['band'])
    add_bowtie(d, spec['bow'])

    eye = spec['eye']
    if eye == 'target':
        add_eye_target(d, 27, 25, 8)
    elif eye == 'pie':
        add_eye_pie(d, 27, 25, 8, spec['pie_color'])
    elif eye == 'dotmis':
        add_eye_dotmis(d, 27, 25, 7)
    small_eye(d, 41, 25)

    if spec.get('glasses'):
        add_glasses(d)
    return d


def make_idle(spec):
    img = new_canvas()
    make_base(img, spec)
    return img


def make_lookup(spec):
    img = new_canvas()
    d = make_base(img, spec)
    add_magnifier(img, d)
    return img


def rgba_to_hex(rgba):
    r, g, b, a = rgba
    return f"#{r:02x}{g:02x}{b:02x}"


def rle_row(pixels_row):
    runs = []
    i = 0
    n = len(pixels_row)
    while i < n:
        j = i
        while j < n and pixels_row[j] == pixels_row[i]:
            j += 1
        runs.append((i, j - i, pixels_row[i]))
        i = j
    return runs


def char_to_svg(img, px_size):
    small = img.resize((NW, NH), Image.NEAREST)
    px_data = list(small.getdata())
    rects = []
    for y in range(NH):
        row = px_data[y * NW:(y + 1) * NW]
        for start, length, color in rle_row(row):
            if color[3] == 0:
                continue
            hexcol = rgba_to_hex(color)
            alpha = color[3] / 255
            rx = start * px_size
            ry = y * px_size
            rw = length * px_size
            if alpha < 1:
                rects.append(f'<rect x="{rx}" y="{ry}" width="{rw}" height="{px_size}" fill="{hexcol}" fill-opacity="{alpha:.2f}"/>')
            else:
                rects.append(f'<rect x="{rx}" y="{ry}" width="{rw}" height="{px_size}" fill="{hexcol}"/>')
    vw, vh = NW * px_size, NH * px_size
    body = "\n".join(rects)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vw} {vh}" width="{vw}" height="{vh}">\n{body}\n</svg>\n'


PX = 3

SPECS = [
    dict(
        key='navy', label='クラシック',
        head_c=((30, 58, 95, 255), (46, 84, 132, 255)),
        body_c=((30, 58, 95, 255), (46, 84, 132, 255)),
        band=(240, 200, 105, 255), bow=(179, 66, 58, 255),
        eye='target',
    ),
    dict(
        key='pink', label='ピンク',
        head_c=((196, 74, 110, 255), (240, 150, 180, 255)),
        body_c=((196, 74, 110, 255), (240, 150, 180, 255)),
        band=(250, 240, 232, 255), bow=(180, 60, 90, 255),
        eye='pie', pie_color=(180, 60, 90, 255),
    ),
    dict(
        key='green', label='グリーン',
        head_c=((31, 92, 66, 255), (69, 140, 102, 255)),
        body_c=((31, 92, 66, 255), (69, 140, 102, 255)),
        band=(240, 200, 105, 255), bow=(90, 50, 40, 255),
        eye='dotmis', glasses=True,
    ),
    dict(
        key='red', label='レッド',
        head_c=((150, 40, 40, 255), (214, 90, 70, 255)),
        body_c=((150, 40, 40, 255), (214, 90, 70, 255)),
        band=(240, 200, 105, 255), bow=(30, 30, 30, 255),
        eye='pie', pie_color=(240, 190, 60, 255),
    ),
]

TRAY_CROP = (9, 3, 55, 49)  # 頭部を少し余白付きで切り出す(顔だけのトレイアイコン用)
TRAY_SIZE = 32

for spec in SPECS:
    idle_img = make_idle(spec)
    lookup_img = make_lookup(spec)
    idle_svg = char_to_svg(idle_img, PX)
    lookup_svg = char_to_svg(lookup_img, PX)

    with open(os.path.join(OUT_DIR, f'mascot-{spec["key"]}-idle.svg'), 'w', encoding='utf-8') as f:
        f.write(idle_svg)
    with open(os.path.join(OUT_DIR, f'mascot-{spec["key"]}-lookup.svg'), 'w', encoding='utf-8') as f:
        f.write(lookup_svg)
    idle_img.save(os.path.join(OUT_DIR, f'preview-{spec["key"]}-idle.png'))
    lookup_img.save(os.path.join(OUT_DIR, f'preview-{spec["key"]}-lookup.png'))

    tray_img = idle_img.crop(TRAY_CROP).resize((TRAY_SIZE, TRAY_SIZE), Image.NEAREST)
    tray_img.save(os.path.join(OUT_DIR, f'tray-{spec["key"]}.png'))

print('done', OUT_DIR)
