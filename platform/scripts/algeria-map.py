"""
يولّد src/components/domain/algeria-map-data.ts من حدود الولايات (Natural Earth، ملكية عامة).
  curl -LO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
  python3 scripts/algeria-map.py ne_10m_admin_1_states_provinces.geojson
Natural Earth يعرف 48 ولاية؛ الولايات 49–58 (تقسيم 2019/2021) نقاط عند عواصمها داخل ولاياتها الأم.
"""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'src' / 'components' / 'domain' / 'algeria-map-data.ts'

src = json.load(open(sys.argv[1], encoding='utf-8'))
features = [f for f in src['features'] if f['properties'].get('adm0_a3') == 'DZA']
assert len(features) == 48, len(features)

# إسقاط متساوي المسافات مصحّح بخط العرض الأوسط: الشكل لا يتمطّط أفقياً
LAT0 = math.radians(28.0)
LON_MIN, LON_MAX, LAT_MIN, LAT_MAX = -8.8, 12.1, 18.8, 37.2
W = 1000.0
KX = W / ((LON_MAX - LON_MIN) * math.cos(LAT0))
H = (LAT_MAX - LAT_MIN) * KX


def proj(lon: float, lat: float) -> tuple[float, float]:
    return ((lon - LON_MIN) * math.cos(LAT0) * KX, (LAT_MAX - lat) * KX)


def rdp(pts: list[tuple[float, float]], eps: float) -> list[tuple[float, float]]:
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy) or 1e-9
    idx, dmax = 0, 0.0
    for i in range(1, len(pts) - 1):
        x0, y0 = pts[i]
        d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / norm
        if d > dmax:
            idx, dmax = i, d
    if dmax > eps:
        return rdp(pts[: idx + 1], eps)[:-1] + rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]


def ring_path(ring: list[list[float]]) -> str:
    raw = [proj(x, y) for x, y in ring]
    if len(raw) > 1 and raw[0] == raw[-1]:
        raw = raw[:-1]
    if len(raw) < 3:
        return ''
    # حلقة مغلقة: البداية = النهاية فيسقط كل شيء في RDP. تُقسم عند أبعد نقطة عن البداية
    far = max(range(len(raw)), key=lambda i: math.hypot(raw[i][0] - raw[0][0], raw[i][1] - raw[0][1]))
    pts = rdp(raw[: far + 1], 0.9)[:-1] + rdp(raw[far:] + [raw[0]], 0.9)[:-1]
    if len(pts) < 4:
        return ''
    return 'M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in pts) + 'Z'


# عواصم الولايات الجديدة (تقريبية إلى 0.05°) والولاية الأم التي اقتُطعت منها
NEW = {
    '49': ('تيميمون', 0.24, 29.26, '01'),
    '50': ('برج باجي مختار', 0.95, 21.33, '01'),
    '51': ('أولاد جلال', 5.07, 34.42, '07'),
    '52': ('بني عباس', -2.17, 30.13, '08'),
    '53': ('عين صالح', 2.47, 27.20, '11'),
    '54': ('عين قزام', 5.77, 19.57, '11'),
    '55': ('تقرت', 6.07, 33.10, '30'),
    '56': ('جانت', 9.48, 24.55, '33'),
    '57': ('المغير', 5.92, 33.95, '39'),
    '58': ('المنيعة', 2.88, 30.58, '47'),
}

rows = []
for f in sorted(features, key=lambda f: f['properties']['iso_3166_2']):
    p = f['properties']
    code = p['iso_3166_2'].split('-')[1]
    g = f['geometry']
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    d = ''.join(ring_path(poly[0]) for poly in polys)
    cx, cy = proj(p['longitude'], p['latitude'])
    rows.append((code, d, cx, cy, None))
for code, (_, lon, lat, parent) in NEW.items():
    cx, cy = proj(lon, lat)
    rows.append((code, '', cx, cy, parent))

lines = [
    '/* مولَّد بواسطة scripts/algeria-map.py من Natural Earth (ملكية عامة) — لا تعدّله يدوياً */',
    '',
    'export interface MapWilaya {',
    '  code: string',
    '  /** حدود الولاية؛ فارغ للولايات 49–58 (نقطة عند العاصمة فقط) */',
    '  d: string',
    '  cx: number',
    '  cy: number',
    '  /** الولاية الأم للولايات الجديدة */',
    '  parent: string | null',
    '}',
    '',
    f"export const MAP_VIEWBOX = '0 0 {W:.0f} {H:.0f}'",
    '',
    'export const MAP_WILAYAS: MapWilaya[] = [',
]
for code, d, cx, cy, parent in rows:
    par = f"'{parent}'" if parent else 'null'
    lines.append(f"  {{ code: '{code}', cx: {cx:.1f}, cy: {cy:.1f}, parent: {par}, d: '{d}' }},")
lines.append(']')
OUT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(OUT, OUT.stat().st_size, 'bytes', 'viewBox', W, round(H))
