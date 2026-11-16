#!/usr/bin/env python3
"""
يولّد صور اختبار OCR والمسح (نصوص من تأليفنا، لا حقوق): عربية، فرنسية، إنجليزية، ومختلطة،
ونسخة «صورة هاتف» بظل متدرّج وضجيج لاختبار تحسين الإضاءة.
النص العربي يُشكَّل عبر libraqm (ربط الحروف واتجاه RTL صحيح).
"""
import json, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont, features

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
AR_FONT = os.path.join(REPO, 'resources', 'fonts', 'NotoNaskhArabic-Regular.ttf')
LAT_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
assert features.check('raqm'), 'libraqm is required for Arabic shaping'

SAMPLES = {
    'ar': ['تطبيق نوفا يحول الأوراق إلى ملفات رقمية',
           'فاتورة للعميل مكتبة النور في مدينة بوسعادة',
           'المبلغ الإجمالي المستحق خمسة آلاف دينار'],
    'fr': ['Facture n° 2026-015 émise à Bou Saâda',
           'Total à payer : 12 500,00 DA TTC',
           'Merci pour votre confiance et à bientôt'],
    'en': ['NOVA Docs turns paper into searchable PDF files',
           'Invoice total due within thirty days',
           'Your documents stay private on your iPhone'],
    # صفحة واحدة تمزج العربية والفرنسية (كل سطر بخط يدعم حروفه)
    'mixed': ['فاتورة رقم 2026 للعميل مكتبة النور',
              'Client : Librairie En-Nour, Bou Saada',
              'المبلغ المدفوع 12500 دينار جزائري'],
}

def render(lines, rtl_flags, size=(1600, 520), font_px=54):
    img = Image.new('RGB', size, 'white')
    d = ImageDraw.Draw(img)
    y = 60
    for text, rtl in zip(lines, rtl_flags):
        font = ImageFont.truetype(AR_FONT if rtl else LAT_FONT, font_px, layout_engine=ImageFont.Layout.RAQM)
        kwargs = {'direction': 'rtl', 'language': 'ar'} if rtl else {}
        w = d.textlength(text, font=font, **kwargs)
        x = size[0] - 70 - w if rtl else 70
        d.text((x, y), text, font=font, fill=(20, 20, 20), **kwargs)
        y += int(font_px * 2.2)
    return img

def has_ar(s):
    return any('؀' <= c <= 'ۿ' for c in s)

truth = {}
for key, lines in SAMPLES.items():
    flags = [has_ar(l) for l in lines]
    render(lines, flags).save(os.path.join(HERE, f'ocr-{key}.png'))
    truth[key] = '\n'.join(lines)

# صورة «هاتف»: ظل متدرج قوي من اليسار، ضوء دافئ، ضجيج، وتمويه بسيط
base = render(SAMPLES['fr'], [False] * 3).convert('RGB')
w, h = base.size
shadow = Image.new('L', (w, h))
px = shadow.load()
for x in range(w):
    v = int(95 + 150 * (x / w) ** 0.8)   # 95 (ظل) → 245 (مضاء)
    for y in range(h):
        px[x, y] = v
tinted = Image.merge('RGB', [Image.eval(shadow, lambda v: min(255, v + 6)), shadow, Image.eval(shadow, lambda v: max(0, v - 14))])
from PIL import ImageChops
photo = ImageChops.multiply(base, tinted)
random.seed(7)
noise = Image.effect_noise((w, h), 18).convert('RGB')
photo = Image.blend(photo, ImageChops.multiply(photo, noise.point(lambda v: 200 + v // 5)), 0.35).filter(ImageFilter.GaussianBlur(0.8))
photo.save(os.path.join(HERE, 'scan-photo-fr.jpg'), quality=88)
truth['scan-photo-fr'] = truth['fr']

json.dump(truth, open(os.path.join(HERE, 'ocr-truth.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('fixtures:', ', '.join(sorted(os.listdir(HERE))))
