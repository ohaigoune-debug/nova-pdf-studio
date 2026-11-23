/** تنقل بأسلوب iOS: خمسة أقسام، ولكل قسم مكدس شاشات مستقل (Push/Pop) يحتفظ بموضعه عند التبديل. */
import { create } from 'zustand'

export type Tab = 'documents' | 'tools' | 'scan' | 'invoices' | 'more'
export const TABS: Tab[] = ['documents', 'tools', 'scan', 'invoices', 'more']

export type Route =
  | { name: 'viewer'; file: string; page?: number; edit?: boolean }
  | { name: 'invoiceEdit'; id?: number; prefill?: unknown }
  | { name: 'invoiceView'; id: number }
  | { name: 'customerEdit'; id?: number }
  | { name: 'productEdit'; id?: number }
  | { name: 'sheets' }
  | { name: 'sheet'; id?: number }
  | { name: 'settings' }
  | { name: 'company' }
  | { name: 'languages' }
  | { name: 'backup' }
  | { name: 'support' }
  | { name: 'legal'; doc: 'privacy' | 'terms' }
  | { name: 'about' }

interface NavState {
  tab: Tab
  stacks: Record<Tab, Route[]>
  setTab(tab: Tab): void
  push(route: Route, tab?: Tab): void
  pop(): void
  replace(route: Route): void
  popToRoot(tab?: Tab): void
}

const empty = (): Record<Tab, Route[]> => ({ documents: [], tools: [], scan: [], invoices: [], more: [] })

export const useNav = create<NavState>((set, get) => ({
  tab: 'documents',
  stacks: empty(),
  setTab(tab) {
    // لمس القسم الحالي مرة ثانية يعيد للجذر (سلوك iOS)
    if (get().tab === tab) set((s) => ({ stacks: { ...s.stacks, [tab]: [] } }))
    else set({ tab })
  },
  push(route, tab) {
    const target = tab ?? get().tab
    set((s) => ({ tab: target, stacks: { ...s.stacks, [target]: [...s.stacks[target], route] } }))
  },
  pop() {
    const tab = get().tab
    set((s) => ({ stacks: { ...s.stacks, [tab]: s.stacks[tab].slice(0, -1) } }))
  },
  replace(route) {
    const tab = get().tab
    set((s) => ({ stacks: { ...s.stacks, [tab]: [...s.stacks[tab].slice(0, -1), route] } }))
  },
  popToRoot(tab) {
    const target = tab ?? get().tab
    set((s) => ({ stacks: { ...s.stacks, [target]: [] } }))
  }
}))

export function currentRoute(): Route | null {
  const s = useNav.getState()
  return s.stacks[s.tab].at(-1) ?? null
}
