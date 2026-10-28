# Madrasadz Anti-Piracy — تكامل مع منصة مدرسة

هذه إضافة آمنة إلى Next.js 15، دون إعادة بناء المنصة أو تغيير قاعدة بيانات الطلبة.

**تم تجهيز واجهة /admin/anti-piracy، لكن تشغيل الرصد يتطلب تنزيل الحزمة الأصلية v0.2 ووضع ملفات البوت داخل platform/anti-piracy/.** لا تدمج فرعًا في الإنتاج قبل إكمال الإعداد.

1. ألغِ فورًا رمز @Madrasadz_bot القديم المكشوف عبر @BotFather /revoke ولا تضع الجديد في GitHub.
2. انسخ من حزمة bot v0.2 المجلد bot/ و requirements.txt و Dockerfile إلى platform/anti-piracy/.
3. انسخ bridge_api.py إلى platform/anti-piracy/bot/bridge_api.py (هذا الملف في الفرع).
4. أضف خدمة Python bot بنظام Docker، وخدمة أخرى تقرأ فقط SQLite: python -m bot.bridge_api. يشتركان في volume مغلق وليس منشورًا إلى الإنترنت.
5. ضع ANTI_PIRACY_API_URL=http://anti-piracy-api:8091 و ANTI_PIRACY_API_KEY (سر عشوائي مستقل طويل 32+ محرف) في إعدادات خادم Next.js فقط، ونفس المفتاح في خدمة bridge.
6. من حساب المدير أرسل /start إلى البوت، ثم شغّل python -m bot.owner_setup و python -m bot.login محليًا مع أسرارك. لا تنقل جلسة Telegram أو token إلى GitHub.
7. بعد نشر التطبيق والخدمة، ادخل /admin/anti-piracy بحساب SUPER_ADMIN، وجرب /status و /scan من البوت.

ملف ZIP الذي أُنشئ مع هذه المهمة يحتوي bot/ الجاهز وملف Docker compose اختياري، وتعليمات التشغيل كاملة.

**حدود الرصد:** مصادر تيليغرام العامة فقط، ولا يجري دخول غير مصرح به للقنوات الخاصة؛ والنتائج مجرد اشتباه تحتاج مراجعة حقوق النشر. لا تُرسل بلاغات تلقائية.
