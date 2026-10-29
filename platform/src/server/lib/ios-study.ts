import { headers } from 'next/headers'
import { IOS_PRESENTATION_HEADER, IOS_PRESENTATION_VALUE } from '@/lib/ios-presentation'

/** عرض «دراسة فقط» داخل تطبيق iPhone: لا روابط شراء ولا متجر (قرار المالك + إرشاد App Store 3.1.1) */
export async function isIosStudyOnly(): Promise<boolean> {
  return (await headers()).get(IOS_PRESENTATION_HEADER) === IOS_PRESENTATION_VALUE
}
