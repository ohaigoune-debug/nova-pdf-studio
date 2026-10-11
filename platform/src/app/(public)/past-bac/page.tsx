import { redirect } from 'next/navigation'

/** «بكالوريات سابقة» دُمجت في «بنك البكالوريات السابقة» (/bac) — الروابط القديمة تبقى صالحة */
export default function PastBacRedirect() {
  redirect('/bac')
}
