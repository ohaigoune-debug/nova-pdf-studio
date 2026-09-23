import type { Metadata } from 'next'
import Link from 'next/link'
import { contactEmail } from '@/server/lib/contact'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'سياسة الخصوصية' }

const UPDATED = '23 سبتمبر 2026'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <div className="space-y-2 leading-loose text-muted-foreground [&_li]:ms-5 [&_li]:list-disc [&_strong]:text-foreground">{children}</div>
    </section>
  )
}

/** سياسة الخصوصية — رابطها يُطلب في Google Play ويظهر في تذييل كل صفحة */
export default function PrivacyPage() {
  const email = contactEmail()
  return (
    <article dir="rtl" className="container max-w-3xl space-y-8 py-12">
      <header className="space-y-2">
        <h1 className="font-display text-4xl font-bold">سياسة الخصوصية</h1>
        <p className="text-sm text-muted-foreground">منصة «مدرسة» — madrasadz.com وتطبيقها على أندرويد · آخر تحديث: {UPDATED}</p>
      </header>

      <Section title="باختصار">
        <ul>
          <li>نجمع ما يلزم للتعليم فقط: حسابك، وأفواجك، وحضورك، وواجباتك ونتائجك.</li>
          <li><strong>لا إعلانات، ولا بيع للبيانات، ولا مشاركتها لأغراض تسويقية.</strong></li>
          <li>أستاذك يرى بيانات أفواجه فقط، ولا يرى أستاذ آخر شيئاً منها.</li>
          <li>تستطيع حذف حسابك بنفسك في أي وقت.</li>
        </ul>
      </Section>

      <Section title="البيانات التي نجمعها">
        <ul>
          <li><strong>الحساب:</strong> الاسم، والبريد الإلكتروني، وكلمة السر (مخزّنة مشفّرة بدالّة تجزئة لا يمكن عكسها)، والهاتف اختيارياً.</li>
          <li><strong>الدراسة:</strong> الولاية، والمؤسسة، والمستوى، والشعبة، ورقم هاتف الوليّ إن أدخلته.</li>
          <li><strong>النشاط التعليمي:</strong> الأفواج التي تنضم إليها، وسجلّ الحضور والغياب، والواجبات التي تسلّمها، والاختبارات ونتائجها، وتقييم المهارات.</li>
          <li><strong>الجلسات والأمان:</strong> نوع الجهاز والمتصفّح وعنوان IP وتواريخ الدخول، لحماية حسابك وعرض أجهزتك المتصلة، ولمنع محاولات التخمين.</li>
          <li><strong>الإشعارات:</strong> إن سمحت بها، نحفظ معرّف الاشتراك في الإشعارات الخاصّ بجهازك.</li>
        </ul>
        <p>لا نجمع موقعك الجغرافي الدقيق، ولا جهات اتصالك، ولا صورك، ولا أي بيانات من خارج المنصة.</p>
      </Section>

      <Section title="كيف نستعملها">
        <ul>
          <li>تشغيل حسابك وربطك بأفواج أستاذك.</li>
          <li>تسجيل الحضور ببطاقة QR، وحساب الغيابات.</li>
          <li>تصحيح الواجبات ومتابعة تقدّمك، وإرسال الإشعارات المتعلّقة بدروسك.</li>
          <li>إرسال رسائل البريد الضرورية فقط، مثل رابط استعادة كلمة السر.</li>
          <li>إحصاءات عامّة غير شخصية، مثل عدد التلاميذ في كل ولاية.</li>
        </ul>
      </Section>

      <Section title="الجهات التي تعالج البيانات نيابة عنّا">
        <ul>
          <li><strong>Contabo:</strong> استضافة الخادم وقاعدة البيانات.</li>
          <li><strong>OpenAI:</strong> حين يستعمل أستاذك التصحيح أو التحليل بالذكاء الاصطناعي، تُرسل نصوص الإجابات والنتائج، واسم التلميذ عند تحليل تقدّمه. لا تُستعمل هذه البيانات لتدريب نماذجها وفق شروط واجهتها البرمجية، والأستاذ يراجع كل اقتراح قبل اعتماده.</li>
          <li><strong>Resend:</strong> إرسال رسائل البريد، مثل استعادة كلمة السر.</li>
          <li><strong>YouTube:</strong> الفيديوهات معروضة من youtube-nocookie.com، نسخة الخصوصية المعزّزة، وتخضع لسياسة Google عند تشغيلها.</li>
        </ul>
      </Section>

      <Section title="ما يُحفظ على جهازك">
        <p>
          كوكي الجلسة لإبقائك متصلاً، وكوكي اللغة والمظهر، وكوكي يميّز فتح المنصة من تطبيق أندرويد. وتُحفظ مسوّدات واجباتك على جهازك حتى تعمل بلا
          إنترنت ثم تُرسل عند عودة الاتصال. لا نستعمل كوكيز إعلانية ولا أدوات تتبّع من طرف ثالث.
        </p>
      </Section>

      <Section title="الأمان">
        <p>
          الاتصال مشفّر بـ HTTPS، وكلمات السر مجزّأة، وكل جلسة قابلة للإنهاء من صفحة «أجهزتي». ويُحدّ من المحاولات المتكرّرة لتسجيل الدخول، وتُنسخ
          البيانات احتياطياً بانتظام.
        </p>
      </Section>

      <Section title="المدّة وحذف الحساب">
        <p>
          نحتفظ ببياناتك ما دام حسابك قائماً. تستطيع حذفه بنفسك من{' '}
          <Link href="/delete-account" className="font-bold text-primary underline-offset-4 hover:underline">
            صفحة حذف الحساب
          </Link>
          . عند الحذف يُمحى اسمك وبريدك وهاتفك وولايتك ومدرستك وهاتف وليّك، وتُنهى كل جلساتك وتُحذف اشتراكات الإشعارات، وتغادر أفواجك. أما الحضور
          والعلامات السابقة فتبقى عند أستاذك <strong>بلا أي اسم أو وسيلة تعرّف</strong>، لأنها جزء من سجلّ فوجه وإحصاءاته.
        </p>
      </Section>

      <Section title="التلاميذ القاصرون">
        <p>
          المنصة موجّهة لتلاميذ الثانوي. نطلب من التلميذ القاصر استعمالها بعلم وليّه، ويستطيع الوليّ طلب الاطلاع على بيانات ابنه أو حذفها عبر وسيلة
          التواصل أدناه.
        </p>
      </Section>

      <Section title="حقوقك والتواصل">
        <p>لك أن تطّلع على بياناتك وتصحّحها من صفحة ملفّك، وأن تحذف حسابك، وأن تسألنا عن أي شيء يخصّ بياناتك.</p>
        {email ? (
          <p>
            للتواصل:{' '}
            <a href={`mailto:${email}`} dir="ltr" className="font-bold text-primary">
              {email}
            </a>
          </p>
        ) : null}
        <p>إن غيّرنا هذه السياسة تغييراً جوهرياً نُعلمك داخل المنصة قبل سريانه.</p>
      </Section>
    </article>
  )
}
