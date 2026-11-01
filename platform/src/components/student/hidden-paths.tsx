'use client'

import { createContext, useContext, type ReactNode } from 'react'

/** المسارات التي أخفاها المشرف من حساب التلميذ (للتبويبات وشريط الهاتف) — الحجب الفعلي في الخادم */
const HiddenPathsContext = createContext<readonly string[]>([])

export function HiddenPathsProvider({ hidden, children }: { hidden: readonly string[]; children: ReactNode }) {
  return <HiddenPathsContext.Provider value={hidden}>{children}</HiddenPathsContext.Provider>
}

export const useHiddenPaths = () => useContext(HiddenPathsContext)
