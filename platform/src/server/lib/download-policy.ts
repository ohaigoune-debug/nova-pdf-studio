/**
 * سياسة التنزيل الخام لملفات المحتوى — مصدر واحد تستعمله كل الصفحات.
 * PDF يُعرض داخل المنصة مختوماً باسم التلميذ، والفيديو المرفوع يُبثّ عبر المشغّل الآمن فقط؛
 * لا يُعطى رابط تنزيل مباشر إلا إذا سمح الأستاذ (allowDownload) ولم يكن الملف PDF أو فيديو.
 */
export function isRawDownloadAllowed(f: { allowDownload: boolean; mime: string | null | undefined }): boolean {
  if (!f.allowDownload) return false
  const mime = f.mime ?? ''
  if (mime === 'application/pdf') return false
  if (mime.startsWith('video/')) return false
  return true
}
