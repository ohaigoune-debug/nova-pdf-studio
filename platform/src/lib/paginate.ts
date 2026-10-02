/**
 * تقسيم تقديري إلى صفحات A4 من ارتفاعات مقيسة (دالة خالصة): الكتلة لا تُقسم؛ ما لا يتّسع ينزل إلى صفحة جديدة؛
 * الكتلة الأطول من صفحة تُعلَّم تجاوزاً (ستقسمها الطابعة حيث تشاء).
 */
export interface MeasuredBlock {
  id: string
  /** الارتفاع بالملمتر */
  height: number
  /** فاصل صفحة صريح */
  forceBreak?: boolean
  label?: string
}

export interface PaginationResult {
  pages: { ids: string[]; used: number }[]
  /** الكتل الأطول من صفحة كاملة */
  overflow: { id: string; label?: string; height: number }[]
  /** الكتل التي بدأت صفحة جديدة لأنها لم تتّسع (ترك فراغاً كبيراً في الصفحة السابقة) */
  pushed: { id: string; label?: string; gapLeft: number }[]
}

export function paginate(blocks: MeasuredBlock[], pageHeight: number, firstPageHeight = pageHeight): PaginationResult {
  const pages: { ids: string[]; used: number }[] = [{ ids: [], used: 0 }]
  const overflow: PaginationResult['overflow'] = []
  const pushed: PaginationResult['pushed'] = []
  const capacity = () => (pages.length === 1 ? firstPageHeight : pageHeight)
  for (const b of blocks) {
    const page = pages[pages.length - 1]!
    if (b.forceBreak) {
      page.ids.push(b.id)
      pages.push({ ids: [], used: 0 })
      continue
    }
    if (b.height > capacity() + 0.5 && pages.length > 0) overflow.push({ id: b.id, label: b.label, height: b.height })
    if (page.used + b.height > capacity() + 0.5 && page.ids.length > 0) {
      const gap = capacity() - page.used
      if (gap > 40) pushed.push({ id: b.id, label: b.label, gapLeft: Math.round(gap) })
      pages.push({ ids: [b.id], used: b.height })
    } else {
      page.ids.push(b.id)
      page.used += b.height
    }
  }
  return { pages, overflow, pushed }
}
