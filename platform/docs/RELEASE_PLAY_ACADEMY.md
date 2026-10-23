# نشر PLAY + الأكاديمية على الخادم — دليل خطوة بخطوة (M7)

> يُنفَّذ بعد دمج `feature/madrasadz-play-recovery-2026` في `work`. كل خطوة أمر واحد، وبعده ما يجب أن تراه.
> إن اختلف ما تراه عن المتوقع: توقّف وأرسل آخر 30 سطرًا. لا تنتقل إلى الخطوة التالية.
> لا تُنفَّذ أي خطوة منه آليًا؛ المالك ينسخ الأوامر بنفسه عبر SSH.

## 0) قبل البدء (على الخادم، كـroot)

```sh
cd /opt/madrasa 2>/dev/null || cd ~/nova-pdf-studio/platform   # مجلد المنصة الذي فيه docker-compose.prod.yml
pwd && ls docker-compose.prod.yml .env >/dev/null && echo OK
```
المتوقع: `OK`.

```sh
git -C "$(git rev-parse --show-toplevel)" status -sb | head -3 ; git -C "$(git rev-parse --show-toplevel)" log --oneline -1
```
المتوقع: الفرع الحالي واسم آخر commit. **إن ظهرت ملفات معدّلة (M) أو commit غير موجود على GitHub، توقّف**: الخادم فيه تغييرات غير مرفوعة (كما حدث في NOVA)، ويجب حفظها أولًا.

## 1) نسخة احتياطية (إلزامية)

```sh
docker compose -f docker-compose.prod.yml exec -T db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U madrasa -d madrasa' | gzip -9 > /root/madrasa-pre-play-$(date +%Y%m%d-%H%M).sql.gz && ls -lh /root/madrasa-pre-play-*.sql.gz | tail -1
```
المتوقع: ملف بحجم أكبر من بضعة ميغابايت. تحقق من اكتماله:
```sh
gzip -dc /root/madrasa-pre-play-*.sql.gz | tail -3
```
المتوقع: سطر `PostgreSQL database dump complete`.

## 2) سحب الكود

```sh
ROOT=$(git rev-parse --show-toplevel); git -C "$ROOT" fetch origin && git -C "$ROOT" checkout work && git -C "$ROOT" pull --ff-only origin work && git -C "$ROOT" log --oneline -1
```
المتوقع: آخر commit من `work` بعد الدمج (يحوي «academy» أو «play»). إن ظهر `diverged` أو `not possible to fast-forward`: توقّف.

## 3) البناء والتشغيل

```sh
docker compose -f docker-compose.prod.yml build app && docker compose -f docker-compose.prod.yml up -d
```
المتوقع: بناء يستغرق 3–8 دقائق ثم `Started`/`Running` لكل الخدمات.

## 4) التحقق من الهجرات (0026 PLAY، 0027 الأكاديمية، 0028 Bunny)

```sh
docker compose -f docker-compose.prod.yml logs --tail 50 app | grep -i -E "migrat|error" ; docker compose -f docker-compose.prod.yml exec -T db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U madrasa -d madrasa -c "select count(*) from play_questions; select count(*) from courses; select column_name from information_schema.columns where table_name='"'"'content'"'"' and column_name='"'"'bunny_video_id'"'"';"'
```
المتوقع: `migrations applied`، ثم `0` أسئلة (قبل الاستيراد)، `0` دورات، وسطر `bunny_video_id`. إن ظهر خطأ هجرة: نفّذ التراجع (القسم 8) وأرسل السجل.

## 5) استيراد أسئلة PLAY — تجربة بلا كتابة أولًا

```sh
docker compose -f docker-compose.prod.yml exec -T app sh -c 'npx tsx scripts/play/import.ts --dry-run' | tail -5
```
المتوقع: `المجموع: 59xx سؤالاً — 59xx جديد، 0 محدَّث، 0 غير صالح، 0 بلا درس، 0 ملف فشل`.
إن ظهر «غير صالح» أو «بلا درس» أكبر من 0: توقّف وأرسل الأسطر.

```sh
docker compose -f docker-compose.prod.yml exec -T app sh -c 'npx tsx scripts/play/import.ts' | tail -5
```
المتوقع: نفس الأرقام مع «جديد». إعادة التشغيل آمنة (لا تكرار).

## 6) التحقق من الموقع

```sh
for p in / /play /login /student/play /admin/play /student/courses /admin/courses; do printf "%s -> " "$p"; curl -s -o /dev/null -w '%{http_code}\n' --max-time 10 "https://madrasadz.com$p"; done
```
المتوقع: `/` و`/play` و`/login` → 200؛ صفحات التلميذ والإدارة → 302/307 (تحويل إلى الدخول) لا 500.

ثم من الهاتف: دخول بحساب تلميذ → «MADRASADZ PLAY» → اختيار المستوى → تحدٍّ كامل → تظهر النقاط. ومن حساب المشرف: `/admin/play` يعرض عدّاد الأسئلة.

## 7) الإعدادات التي تُدخل من اللوحة (لا في الكود)

- `/admin/settings`: مفتاح SuiviSMS + زر «رسالة تجريبية»؛ تشغيل «OTP عند الطلب» حين تريد.
- `/admin/settings/video`: بيانات Bunny Stream (libraryId، apiKey، tokenAuthKey، cdnHostname) + زر الاختبار.
- `/admin/delivery`: سرّ webhook؛ ثم في لوحة شركة التوصيل ضع العنوان `https://madrasadz.com/api/v1/delivery/webhook?provider=yalidine` (أو `generic`) مع الرأس `x-webhook-secret`.
- `/admin/play`: قرار العرض: الأسئلة «مدقّقة آليًا» تُعرض فورًا؛ لإخفاء كل شيء حتى الاعتماد اليدوي، من إعدادات PLAY احذف `AUTO_VALIDATED` من «الحالات المعروضة».

## 8) التراجع (إن لزم)

```sh
ROOT=$(git rev-parse --show-toplevel); git -C "$ROOT" checkout <SHA السابق لـwork> && docker compose -f docker-compose.prod.yml build app && docker compose -f docker-compose.prod.yml up -d
```
الجداول الجديدة لا تضرّ الكود القديم (إضافة فقط). ولإزالتها نهائيًا، بعد نسخة احتياطية، نفّذ بالترتيب العكسي:
```sh
for f in 0028_bunny_provider 0027_academy 0026_madrasadz_play; do docker compose -f docker-compose.prod.yml exec -T db sh -c "PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql -U madrasa -d madrasa" < drizzle/down/$f.down.sql; done
```
الاستعادة الكاملة من النسخة: `gzip -dc /root/madrasa-pre-play-*.sql.gz | docker compose -f docker-compose.prod.yml exec -T db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U madrasa -d madrasa'` (بعد إيقاف `app`).
