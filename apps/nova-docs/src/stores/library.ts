import { create } from 'zustand'
import { listLibrary, type LibraryItem } from '../platform/library'

interface LibraryState {
  items: LibraryItem[]
  loading: boolean
  refresh(): Promise<void>
}

export const useLibrary = create<LibraryState>((set) => ({
  items: [],
  loading: true,
  async refresh() {
    set({ loading: true })
    set({ items: await listLibrary(), loading: false })
  }
}))
