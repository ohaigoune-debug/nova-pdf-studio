import { redirect } from 'next/navigation'

/** مكتبة فيديوهات يوتيوب العامة مخفية عن التلميذ (قرار المالك 1 نوفمبر 2026). */
export default function StudentVideoPage() {
  redirect('/student/lessons')
}
