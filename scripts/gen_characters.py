from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

S = 2
ASSETS = os.path.join(os.path.dirname(__file__), '..', 'renderer', 'assets')
OUT = os.path.join(os.path.dirname(__file__), '..', 'docs', 'screenshots', 'characters.png')
FONT_DIR = r'C:\Windows\Fonts'


def font(name, size):
    return ImageFont.truetype(os.path.join(FONT_DIR, name), size)


F_BOLD = lambda s: font('YuGothB.ttc', s)
F_REG = lambda s: font('YuGothR.ttc', s)

CARDS = [
    ('navy', 'クラシック', '執事のように丁寧な敬語', (30, 58, 95)),
    ('pink', 'ピンク', '明るくフレンドリーな口調', (196, 74, 110)),
    ('green', 'グリーン', '落ち着いた学者風の口調', (31, 92, 66)),
    ('red', 'レッド', '元気で勢いのある口調', (150, 40, 40)),
]

CARD_W, CARD_H = 220 * S, 260 * S
GAP = 22 * S
PAD = 26 * S
W = PAD * 2 + CARD_W * 4 + GAP * 3
H = PAD * 2 + CARD_H

img = Image.new('RGBA', (W, H), (244, 241, 234, 255))
d = ImageDraw.Draw(img)

for i, (key, label, tone, color) in enumerate(CARDS):
    x0 = PAD + i * (CARD_W + GAP)
    y0 = PAD
    box = (x0, y0, x0 + CARD_W, y0 + CARD_H)

    shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(box, radius=14 * S, fill=(0, 0, 0, 45))
    shadow = shadow.filter(ImageFilter.GaussianBlur(6 * S))
    img.alpha_composite(shadow)
    d = ImageDraw.Draw(img)

    d.rounded_rectangle(box, radius=14 * S, fill=(255, 255, 255, 255), outline=(*color, 90), width=2 * S)

    mascot = Image.open(os.path.join(ASSETS, f'preview-{key}-idle.png')).convert('RGBA')
    mw = 108 * S
    mh = round(mw * mascot.height / mascot.width)
    mascot_big = mascot.resize((mw, mh), Image.NEAREST)
    mx = x0 + (CARD_W - mw) // 2
    my = y0 + 20 * S
    img.alpha_composite(mascot_big, (mx, my))
    d = ImageDraw.Draw(img)

    ty = y0 + 20 * S + mh + 14 * S
    f_label = F_BOLD(16 * S)
    tw = d.textlength(label, font=f_label)
    d.text((x0 + (CARD_W - tw) / 2, ty), label, font=f_label, fill=color)
    ty += 24 * S

    f_tone = F_REG(11 * S)
    words = tone
    tw = d.textlength(words, font=f_tone)
    d.text((x0 + (CARD_W - tw) / 2, ty), words, font=f_tone, fill=(90, 96, 108))

final = img.convert('RGB').resize((W // 2, H // 2), Image.LANCZOS)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
final.save(OUT)
print('saved', OUT)
