from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

S = 2  # 2x supersampling for crisp text
W, H = 960 * S, 600 * S
OUT = os.path.join(os.path.dirname(__file__), '..', 'docs', 'screenshots', 'hero.png')
ASSETS = os.path.join(os.path.dirname(__file__), '..', 'renderer', 'assets')

FONT_DIR = r'C:\Windows\Fonts'


def font(name, size):
    return ImageFont.truetype(os.path.join(FONT_DIR, name), size)


F_BOLD = lambda s: font('YuGothB.ttc', s)
F_MED = lambda s: font('YuGothM.ttc', s)
F_REG = lambda s: font('YuGothR.ttc', s)

NAVY = (30, 58, 95)
NAVY_SOFT = (30, 58, 95, 235)
CREAM = (255, 253, 247)
GRAY_LINE = (227, 230, 236)
TEXT = (31, 36, 48)
MUTED = (138, 143, 156)
GOLD = (240, 200, 105)
WHITE = (255, 255, 255)


def rounded(draw, box, radius, **kw):
    draw.rounded_rectangle(box, radius=radius, **kw)


def wrap_text(text, f, max_width, draw):
    lines = []
    cur = ''
    for ch in text:
        trial = cur + ch
        if draw.textlength(trial, font=f) > max_width and cur:
            lines.append(cur)
            cur = ch
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


def soft_glow(base, center, radius, color, alpha):
    layer = Image.new('RGBA', base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = center
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(*color, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(radius * 0.5))
    base.alpha_composite(layer)


def drop_shadow(base, box, radius, blur, alpha=90):
    layer = Image.new('RGBA', base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(box, radius=radius, fill=(0, 0, 0, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(layer)


# --- 背景 ---
img = Image.new('RGBA', (W, H), (26, 35, 56, 255))
d = ImageDraw.Draw(img)
d.rectangle([0, 0, W, H], fill=(26, 35, 56))
soft_glow(img, (int(W * 0.12), int(H * 0.08)), int(W * 0.42), (61, 95, 138), 140)
soft_glow(img, (int(W * 0.94), int(H * 0.9)), int(W * 0.36), (74, 122, 95), 130)
d = ImageDraw.Draw(img)

# --- ドキュメントカード ---
doc_box = (56 * S, 56 * S, 56 * S + 460 * S, 56 * S + 260 * S)
drop_shadow(img, doc_box, 12 * S, 18 * S, alpha=110)
d = ImageDraw.Draw(img)
rounded(d, doc_box, 12 * S, fill=(*CREAM, 245))

dx, dy = doc_box[0] + 34 * S, doc_box[1] + 30 * S
for i, c in enumerate([(229, 103, 95), (229, 184, 79), (95, 180, 106)]):
    d.ellipse([dx + i * 17 * S, dy, dx + i * 17 * S + 10 * S, dy + 10 * S], fill=c)
dy += 34 * S
d.text((dx, dy), 'クラゲの生態について', font=F_BOLD(19 * S), fill=TEXT)
dy += 40 * S
for w in (0.96, 0.88):
    d.rounded_rectangle([dx, dy, dx + 460 * S * 0.0 + dx - dx + (392 * S) * w, dy + 11 * S], radius=4 * S, fill=GRAY_LINE)
    dy += 22 * S

line_y = dy
seg1 = 'クラゲは'
seg2 = '刺胞動物'
seg3 = 'に分類される、海に生息する生物です。'
f14 = F_MED(14 * S)
x = dx
d.text((x, line_y), seg1, font=f14, fill=(58, 65, 80))
x += d.textlength(seg1, font=f14)
target_x0 = x - 3 * S
w2 = d.textlength(seg2, font=f14)
d.rounded_rectangle([target_x0, line_y - 2 * S, x + w2 + 3 * S, line_y + 20 * S], radius=4 * S,
                     fill=(240, 200, 105, 140), outline=(240, 200, 105, 220), width=2 * S)
d.text((x, line_y), seg2, font=f14, fill=(58, 65, 80))
x += w2
d.text((x, line_y), seg3, font=f14, fill=(58, 65, 80))
dy = line_y + 30 * S
for w in (0.92, 0.66):
    d.rounded_rectangle([dx, dy, dx + 392 * S * w, dy + 11 * S], radius=4 * S, fill=GRAY_LINE)
    dy += 22 * S

cursor_x, cursor_y = target_x0 + 30 * S, line_y + 26 * S

# --- マスコット ---
mascot = Image.open(os.path.join(ASSETS, 'preview-navy-lookup.png')).convert('RGBA')
mw = 150 * S
mh = round(mw * mascot.height / mascot.width)
mascot_big = mascot.resize((mw, mh), Image.NEAREST)
mx = W - 26 * S - mw
my = H - 16 * S - mh
shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.ellipse([mx + mw * 0.1, my + mh - 14 * S, mx + mw * 0.9, my + mh + 14 * S], fill=(0, 0, 0, 130))
shadow = shadow.filter(ImageFilter.GaussianBlur(8 * S))
img.alpha_composite(shadow)
img.alpha_composite(mascot_big, (mx, my))
d = ImageDraw.Draw(img)

# --- ポップアップカード ---
pop_box = (500 * S, 168 * S, 500 * S + 260 * S, 168 * S + 250 * S)
drop_shadow(img, pop_box, 10 * S, 16 * S, alpha=120)
d = ImageDraw.Draw(img)
rounded(d, pop_box, 10 * S, fill=(*CREAM, 250))
d.rounded_rectangle([pop_box[0], pop_box[1], pop_box[0] + 4 * S, pop_box[3]], radius=0, fill=NAVY)

px, py = pop_box[0] + 15 * S, pop_box[1] + 13 * S
d.text((px, py), '刺胞動物', font=F_BOLD(13 * S), fill=NAVY)
py += 24 * S
body_text = 'クラゲやイソギンチャクなどが含まれる動物の分類群です。体表や触手に「刺胞」という毒針のような器官を持ち、獲物の捕獲や防御に使います。'
f_body = F_REG(12 * S)
for line in wrap_text(body_text, f_body, 230 * S, d):
    d.text((px, py), line, font=f_body, fill=TEXT)
    py += 18 * S
py += 6 * S
d.text((px, py), 'AIによる説明のため、誤りを含む場合があります。', font=F_REG(10 * S), fill=MUTED)
py += 20 * S
f_src = F_REG(10.5 * S)
for label in ('出典: ja.wikipedia.org', 'Wikipediaで「刺胞動物」を検索'):
    d.text((px, py), label, font=f_src, fill=NAVY)
    tw = d.textlength(label, font=f_src)
    d.line([px, py + 13 * S, px + tw, py + 13 * S], fill=NAVY, width=1)
    py += 17 * S
py += 8 * S
d.line([px, py, pop_box[2] - 15 * S, py], fill=(30, 58, 95, 60), width=1)
py += 8 * S
btn_w = (230 * S - 5 * S) / 2
for i, label in enumerate(('選び直す', '辞書に登録')):
    bx = px + i * (btn_w + 5 * S)
    d.rounded_rectangle([bx, py, bx + btn_w, py + 22 * S], radius=5 * S, outline=(30, 58, 95, 160), width=1 * S)
    f_btn = F_MED(9.5 * S)
    tw = d.textlength(label, font=f_btn)
    d.text((bx + (btn_w - tw) / 2, py + 4 * S), label, font=f_btn, fill=NAVY)

# --- カーソル(ポインタ形状を自前描画) ---
d.polygon([
    (cursor_x, cursor_y), (cursor_x, cursor_y + 22 * S), (cursor_x + 6 * S, cursor_y + 17 * S),
    (cursor_x + 10 * S, cursor_y + 25 * S), (cursor_x + 14 * S, cursor_y + 23 * S),
    (cursor_x + 10 * S, cursor_y + 15 * S), (cursor_x + 17 * S, cursor_y + 14 * S),
], fill=WHITE, outline=(20, 20, 20), width=int(1.5 * S))

# --- キャッチコピー ---
tx, ty = 56 * S, H - 90 * S
d.text((tx + 2 * S, ty + 2 * S), '画面の文字をクリックするだけ。', font=F_BOLD(27 * S), fill=(0, 0, 0, 90))
d.text((tx, ty), '画面の文字をクリックするだけ。', font=F_BOLD(27 * S), fill=WHITE)
ty += 40 * S
d.text((tx, ty), '気になった言葉を、透明なデスクトップ・コンシェルジュがその場で解説します。', font=F_REG(13.5 * S), fill=(244, 241, 234, 230))

# --- 出力(高解像度→ちょうど良いサイズへダウンサンプルしてアンチエイリアス) ---
final = img.convert('RGB').resize((960, 600), Image.LANCZOS)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
final.save(OUT)
print('saved', OUT)
