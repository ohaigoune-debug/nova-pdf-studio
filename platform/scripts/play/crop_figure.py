#!/usr/bin/env python3
"""
قصّ شكل (رسم، منحنى، دارة، خريطة، جدول مصوّر) من صورة صفحة الورقة الرسمية — لا رسم ولا إعادة إنشاء.

  python3 scripts/play/crop_figure.py <page.png> <x0> <y0> <x1> <y1> <set_id> <name>

الإحداثيات كسور من عرض الصفحة وارتفاعها (0..1). يحفظ public/play-exams/figures/<set_id>/<name>.png
ويطبع كتلة MediaRef (JSON) جاهزة: local_path، sha256، width، height — ويبقى على المحوِّل ملء
source_url (رابط الورقة على Drive) و depicts و alt بما في الصورة فعلًا.
"""
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    if len(sys.argv) != 8:
        sys.exit(__doc__)
    page, x0, y0, x1, y1, set_id, name = sys.argv[1], *map(float, sys.argv[2:6]), sys.argv[6], sys.argv[7]
    if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
        sys.exit('الإحداثيات كسور بين 0 و1 مع x0<x1 و y0<y1')
    im = Image.open(page).convert('RGB')
    w, h = im.size
    crop = im.crop((round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h)))
    # تصغير معقول للهاتف دون فقدان الوضوح
    if crop.width > 1400:
        crop = crop.resize((1400, round(crop.height * 1400 / crop.width)), Image.LANCZOS)
    out_dir = ROOT / 'public' / 'play-exams' / 'figures' / set_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f'{name}.png'
    crop.save(out, optimize=True)
    data = out.read_bytes()
    print(json.dumps({
        'local_path': f'/play-exams/figures/{set_id}/{name}.png',
        'source_url': 'https://drive.google.com/file/d/<paper fileId>/view',
        'attribution': 'الديوان الوطني للامتحانات والمسابقات — ورقة الموضوع الرسمية',
        'license': 'وثيقة امتحان رسمية منشورة — نسخة مطابقة للاستعمال التعليمي',
        'image_verified_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'sha256': hashlib.sha256(data).hexdigest(),
        'width': crop.width,
        'height': crop.height,
        'depicts': '<ما يظهر في الشكل كما في الورقة>',
        'alt': '<وصف قصير>',
    }, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
