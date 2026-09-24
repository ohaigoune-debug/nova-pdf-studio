/**
 * أنواع الملفات المقبولة في الرفع — مشتركة بين الخادم ونوافذ الاختيار في المتصفّح.
 * نافذة الاختيار تعرض باهتاً كل نوع غير مذكور هنا، فلا يُختار.
 */
export const DOC_MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  text: 'text/plain'
} as const

const BY_EXT: Record<string, string> = {
  pdf: DOC_MIME.pdf,
  docx: DOC_MIME.docx,
  doc: DOC_MIME.doc,
  pptx: DOC_MIME.pptx,
  ppt: DOC_MIME.ppt,
  txt: DOC_MIME.text,
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'video/mp4'
}

/** ملفات الدروس التي يقرؤها الذكاء الاصطناعي (القديمة .doc و.ppt تُرفع لكنها لا تُقرأ) */
export const LESSON_ACCEPT = '.pdf,.docx,.doc,.pptx,.ppt,.txt'
/** كل ما يُرفع إلى «ملفاتي» */
export const ANY_ACCEPT = '.pdf,.docx,.doc,.pptx,.ppt,.txt,.jpg,.jpeg,.png,.webp,.mp3,.m4a,.mp4'

/** نوع الملف من المتصفّح، وإلا من امتداده (ويندوز يترك النوع فارغاً أحياناً) */
export function mimeOf(file: { name: string; type: string }): string {
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  return BY_EXT[ext] ?? (file.type || 'application/octet-stream')
}
