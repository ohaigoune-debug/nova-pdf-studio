import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

const arDate = new Intl.DateTimeFormat('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' })
const arDateTime = new Intl.DateTimeFormat('ar-DZ', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})
const arTime = new Intl.DateTimeFormat('ar-DZ', { hour: '2-digit', minute: '2-digit' })
const arShort = new Intl.DateTimeFormat('ar-DZ', { month: 'short', day: 'numeric' })

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—'
  return arDate.format(new Date(value))
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—'
  return arDateTime.format(new Date(value))
}

export function formatTime(value: Date | string | null | undefined): string {
  if (!value) return '—'
  return arTime.format(new Date(value))
}

export function formatShortDate(value: Date | string | null | undefined): string {
  if (!value) return '—'
  return arShort.format(new Date(value))
}

/** "08:00:00" → "08:00" */
export function formatClock(time: string | null | undefined): string {
  if (!time) return '—'
  return time.slice(0, 5)
}

export function percent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value.toFixed(digits)}%`
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
}
