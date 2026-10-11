import { redirect } from 'next/navigation'

/** نفس بنك البكالوريات للجميع: لا نسخة ثانية للتلميذ */
export default function StudentPastBacRedirect() {
  redirect('/bac')
}
