/**
 * خلفيات الهوية (20 نوفمبر 2026): تُطلب الصورة من رأس الصفحة بدل انتظار ملف CSS،
 * فتظهر مع العنوان لا بعده. media يجعل الهاتف لا ينزّل إلا نسخته.
 * (‎<link>‎ في JSX يرفعه React إلى ‎<head>‎؛ ‎preload()‎ من مكوّن خادم لا يصل إلى HTML في Next 15)
 */
const MOBILE = '(max-width: 767px)'
const DESKTOP = '(min-width: 768px)'

function Preload({ href, media }: { href: string; media: string }) {
  return <link rel="preload" as="image" href={href} media={media} fetchPriority="high" />
}

/** الدخول والتسجيل: القوس على الهاتف، والإطار الأعرض على الحاسوب */
export function AuthBackgroundPreload() {
  return (
    <>
      <Preload href="/brand/bg/auth-m.webp" media={MOBILE} />
      <Preload href="/brand/bg/auth-d.webp" media={DESKTOP} />
    </>
  )
}

/** بطل صفحة الهبوط: أعلى القوس على الهاتف (الصورة نفسها تخدم التسجيل بعده)، والشريط العريض على الحاسوب */
export function LandingHeroBackgroundPreload() {
  return (
    <>
      <Preload href="/brand/bg/auth-m.webp" media={MOBILE} />
      <Preload href="/brand/bg/band-strong-d.webp" media={DESKTOP} />
    </>
  )
}
