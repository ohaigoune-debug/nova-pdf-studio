/** بريد التواصل المعلن في سياسة الخصوصية وصفحة حذف الحساب (Google Play يشترط وسيلة تواصل) */
export function contactEmail(): string | null {
  return process.env.CONTACT_EMAIL || process.env.ADMIN_EMAIL || null
}
