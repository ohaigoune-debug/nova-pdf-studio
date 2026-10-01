import type { ReactNode } from 'react'

/** صفحات الطباعة: بلا قائمة ولا رأس — الورقة وحدها */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-neutral-100 text-black print:bg-white">{children}</div>
}
