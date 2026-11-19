# يولّد ملفي اختبار عرض العربية: خط مضمّن (مثل Word) وخط غير مضمّن (TraditionalArabic). الاستعمال:
# python3 scripts/make-arabic-fixtures.py ../../resources/fonts/NotoNaskhArabic-Regular.ttf src/lib/selftest-fixtures/arabic  (يتطلب fpdf2 وuharfbuzz وpikepdf)
import sys, pikepdf
from fpdf import FPDF
font = sys.argv[1]; out = sys.argv[2]
TEXT = [
 "أولًا – البناء الفكري",
 "1) الفكرة العامة: يصوّر الشاعر معاناته وحنينه إلى وطنه.",
 "2) الأفكار الأساسية: الحنين (ب1–4)، وصف الطبيعة (ب5–9).",
 "التقويم النقدي: النص من الشعر الوجداني الذي يعبّر عن ذات الشاعر.",
 "الدكتور حيقون أسامة — 68",
]
pdf = FPDF(format='A4'); pdf.add_page()
pdf.add_font('Naskh', '', font)
pdf.set_font('Naskh', size=16)
pdf.set_text_shaping(use_shaping_engine=True, direction='rtl', script='arab', language='ara')
for line in TEXT:
    pdf.cell(0, 14, line, align='R', new_x='LMARGIN', new_y='NEXT')
pdf.set_text_color(29, 78, 216); pdf.cell(0, 14, 'دليل الاختبار التركيبي ص 43', align='R', new_x='LMARGIN', new_y='NEXT')
pdf.output(out + '-embedded.pdf')
# نسخة بلا خط مضمّن (كملف Word بخط لا يُسمح بتضمينه / أو تصدير بلا تضمين)
p = pikepdf.open(out + '-embedded.pdf')
n = 0
for obj in p.objects:
    if isinstance(obj, pikepdf.Dictionary) and obj.get('/Type') == '/FontDescriptor' and '/FontFile2' in obj:
        del obj['/FontFile2']; obj['/FontName'] = pikepdf.Name('/TraditionalArabic'); n += 1
    if isinstance(obj, pikepdf.Dictionary) and obj.get('/Type') == '/Font' and '/BaseFont' in obj:
        obj['/BaseFont'] = pikepdf.Name('/TraditionalArabic')
p.save(out + '-nonembedded.pdf')
print('stripped', n)
