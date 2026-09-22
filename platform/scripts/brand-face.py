"""
يولّد علامة المنصة من صورة الأستاذ المقصوصة (public/teacher.webp):
  public/brand-face.webp        الرأس والكتفان بخلفية شفافة — للواجهة (الشعار الدائري)
  public/icon-*.png             أيقونات تطبيق الويب
  android/.../mipmap-*/*.png    أيقونات تطبيق أندرويد
  android/.../drawable/splash.png
الأيقونات: الوجه على الحبر مع هالة ذهبية وحلقة ذهبية. تشغيل: python3 scripts/brand-face.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'public' / 'teacher.webp'
RES = ROOT / 'android' / 'app' / 'src' / 'main' / 'res'

INK = (13, 27, 33)
INK_DEEP = (8, 17, 21)
GOLD = (219, 166, 43)

portrait = Image.open(SRC).convert('RGBA')
alpha = np.asarray(portrait)[..., 3]

# الرأس: أعلى صفّ معتم، وعرضه من الصفوف الأولى — مركز القصّ أفقياً
rows = np.where(alpha.max(axis=1) > 200)[0]
top = int(rows[0])
head_cols = np.where(alpha[top + 60 : top + 200].max(axis=0) > 200)[0]
cx = int((head_cols.min() + head_cols.max()) / 2)
head_w = int(head_cols.max() - head_cols.min())

# مربع يضمّ الرأس والكتفين: ضلعه ~2.1 عرض الرأس، يبدأ فوق الرأس بهامش
side = int(head_w * 2.1)
y0 = max(0, top - int(side * 0.08))
face = portrait.crop((cx - side // 2, y0, cx + side // 2, y0 + side))

face.resize((512, 512), Image.LANCZOS).save(ROOT / 'public' / 'brand-face.webp', 'WEBP', quality=90, method=6)


def badge(size: int, *, ring: bool, face_scale: float, bg_alpha: bool) -> Image.Image:
    """مربع حبريّ بهالة ذهبية خلف الرأس؛ الوجه ملاصق للحافة السفلية كأنه يطلّ منها"""
    s = size * 4  # رسم بدقة أعلى ثم تصغير: حواف ناعمة
    img = Image.new('RGBA', (s, s), (*INK, 255))
    # تدرّج عمودي خفيف
    grad = np.linspace(0, 1, s)[:, None]
    base = np.array(INK)[None, None, :] * (1 - grad[..., None] * 0.4) + np.array(INK_DEEP)[None, None, :] * (grad[..., None] * 0.4)
    img = Image.fromarray(np.concatenate([base.repeat(s, axis=1).astype(np.uint8), np.full((s, s, 1), 255, np.uint8)], axis=2), 'RGBA')
    # هالة ذهبية خلف الرأس
    glow = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    r = int(s * 0.34)
    d.ellipse((s // 2 - r, int(s * 0.38) - r, s // 2 + r, int(s * 0.38) + r), fill=(*GOLD, 110))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(s * 0.09)))
    # الوجه
    fw = int(s * face_scale)
    f = face.resize((fw, fw), Image.LANCZOS)
    layer = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    layer.alpha_composite(f, ((s - fw) // 2, s - fw))
    if ring:
        # الوجه والكتفان داخل الحلقة: لا شيء يتجاوزها
        w = max(4, int(s * 0.03))
        inner = Image.new('L', (s, s), 0)
        ImageDraw.Draw(inner).ellipse((2 * w, 2 * w, s - 2 * w, s - 2 * w), fill=255)
        layer.putalpha(Image.fromarray(np.minimum(np.asarray(layer)[..., 3], np.asarray(inner))))
    img.alpha_composite(layer)
    if ring:
        ring_img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        ImageDraw.Draw(ring_img).ellipse((w, w, s - w, s - w), outline=(*GOLD, 255), width=w)
        img.alpha_composite(ring_img)
        # قصّ دائري: أيقونة "any" تُعرض كما هي
        mask = Image.new('L', (s, s), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, s - 1, s - 1), fill=255)
        img.putalpha(mask)
    out = img.resize((size, size), Image.LANCZOS)
    return out if bg_alpha else out.convert('RGB')


pub = ROOT / 'public'
badge(192, ring=True, face_scale=0.86, bg_alpha=True).save(pub / 'icon-192.png')
badge(512, ring=True, face_scale=0.86, bg_alpha=True).save(pub / 'icon-512.png')
# maskable: النظام يقصّ بأي شكل؛ الوجه داخل المنطقة الآمنة (80% المركزية)
badge(512, ring=False, face_scale=0.78, bg_alpha=False).save(pub / 'icon-maskable-512.png')
badge(512, ring=False, face_scale=0.9, bg_alpha=False).save(pub / 'icon-play-512.png')

for density, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    d = RES / f'mipmap-{density}'
    badge(px, ring=True, face_scale=0.86, bg_alpha=True).save(d / 'ic_launcher.png')
    badge(px, ring=False, face_scale=0.72, bg_alpha=False).save(d / 'ic_maskable.png')

badge(512, ring=True, face_scale=0.86, bg_alpha=True).save(RES / 'drawable' / 'splash.png')
print('ok', 'head_w', head_w, 'side', side)
