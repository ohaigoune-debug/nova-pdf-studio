export const APP_VERSION = '1.0.0'
/** بريد الدعم يُضبط وقت البناء (VITE_SUPPORT_EMAIL) — لا نضع عنوانًا مخترعًا في الشيفرة. */
export const SUPPORT_EMAIL: string = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ?? ''
