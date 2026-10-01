'use client'

import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useTransition } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { detachProductFileAction, saveProductAction } from '@/server/actions/store.actions'
import { PRODUCT_STATUSES, PRODUCT_TYPES } from '@/server/db/schema/enums'
import type { ProductRow } from '@/server/db/schema'

type Opt = { id: string; name: string }
const TYPE_AR: Record<string, string> = { BOOK: 'كتاب ورقي', PDF: 'ملف PDF', PACK: 'حزمة (ورقي + رقمي)' }
const STATUS_AR: Record<string, string> = { DRAFT: 'مسودة', PUBLISHED: 'منشور', ARCHIVED: 'مؤرشف' }

/** نموذج منتج المتجر (إنشاء/تعديل) مع غلاف وملفات رقمية */
export function ProductForm({ product, files, options }: { product?: ProductRow | null; files?: { id: string; label: string | null; name: string }[]; options: { subjects: Opt[]; levels: Opt[]; streams: Opt[] } }) {
  const router = useRouter()
  const [state, action] = useActionState(saveProductAction, null)
  const [pending, start] = useTransition()
  useEffect(() => {
    if (state?.ok) {
      toast('success', 'حُفظ المنتج')
      router.push(`/admin/store/products/${state.data.id}`)
    }
  }, [state, router])
  return (
    <form action={action} className="space-y-4">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="العنوان" htmlFor="p-title" error={fieldError(state, 'title')} className="sm:col-span-2">
          <Input id="p-title" name="title" defaultValue={product?.title ?? ''} maxLength={200} required dir="auto" />
        </Field>
        <Field label="النوع" htmlFor="p-type">
          <Select id="p-type" name="type" defaultValue={product?.type ?? 'BOOK'}>
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_AR[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الحالة" htmlFor="p-status">
          <Select id="p-status" name="status" defaultValue={product?.status ?? 'DRAFT'}>
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_AR[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="السعر (دج)" htmlFor="p-price" error={fieldError(state, 'priceDzd')} hint="0 = مجاني">
          <Input id="p-price" name="priceDzd" type="number" min="0" step="1" defaultValue={product?.priceDzd ?? 0} dir="ltr" required />
        </Field>
        <Field label="السعر قبل التخفيض (دج)" htmlFor="p-compare" error={fieldError(state, 'comparePriceDzd')}>
          <Input id="p-compare" name="comparePriceDzd" type="number" min="0" step="1" defaultValue={product?.comparePriceDzd ?? ''} dir="ltr" />
        </Field>
        <Field label="المخزون (للورقي)" htmlFor="p-stock" hint="فارغ = غير محدود" error={fieldError(state, 'stock')}>
          <Input id="p-stock" name="stock" type="number" min="0" step="1" defaultValue={product?.stock ?? ''} dir="ltr" />
        </Field>
        <Field label="عدد الصفحات" htmlFor="p-pages">
          <Input id="p-pages" name="pages" type="number" min="1" defaultValue={product?.pages ?? ''} dir="ltr" />
        </Field>
        <Field label="المؤلّف" htmlFor="p-author">
          <Input id="p-author" name="author" defaultValue={product?.author ?? ''} maxLength={120} dir="auto" />
        </Field>
        <Field label="الرابط (slug)" htmlFor="p-slug" hint="فارغ = من العنوان">
          <Input id="p-slug" name="slug" defaultValue={product?.slug ?? ''} maxLength={80} dir="ltr" />
        </Field>
        <Field label="المادة" htmlFor="p-subject">
          <Select id="p-subject" name="subjectId" defaultValue={product?.subjectId ?? ''}>
            <option value="">—</option>
            {options.subjects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الصف" htmlFor="p-level">
          <Select id="p-level" name="levelId" defaultValue={product?.levelId ?? ''}>
            <option value="">—</option>
            {options.levels.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الشعبة" htmlFor="p-stream">
          <Select id="p-stream" name="streamId" defaultValue={product?.streamId ?? ''}>
            <option value="">كل الشعب</option>
            {options.streams.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ترتيب العرض" htmlFor="p-sort">
          <Input id="p-sort" name="sortOrder" type="number" min="0" defaultValue={product?.sortOrder ?? 0} dir="ltr" />
        </Field>
        <Field label="الوصف" htmlFor="p-desc" className="sm:col-span-2">
          <Textarea id="p-desc" name="description" rows={4} defaultValue={product?.description ?? ''} maxLength={4000} dir="auto" />
        </Field>
        <Field label="صورة الغلاف" htmlFor="p-cover" hint="ملف صورة، أو رابط صورة في الحقل التالي">
          <Input id="p-cover" name="cover" type="file" accept="image/*" />
        </Field>
        <Field label="رابط صورة الغلاف" htmlFor="p-cover-url" error={fieldError(state, 'coverUrl')}>
          <Input id="p-cover-url" name="coverUrl" defaultValue={product?.coverUrl ?? ''} dir="ltr" placeholder="https://…" />
        </Field>
        <Field label="ملفات رقمية (PDF)" htmlFor="p-files" hint="تُتاح للتنزيل بعد تأكيد الطلب فقط" className="sm:col-span-2">
          <Input id="p-files" name="files" type="file" accept="application/pdf,.pdf,.zip" multiple />
        </Field>
      </div>
      {files?.length ? (
        <ul className="divide-y rounded-lg border text-sm">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 p-2">
              <span className="truncate">{f.label ?? f.name}</span>
              <Button type="button" size="sm" variant="ghost" title="إزالة الملف من المنتج" loading={pending} onClick={() => start(async () => { const r = await detachProductFileAction(f.id); if (!r.ok) toast('error', r.error.message); else router.refresh() })}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <FormError state={state} />
      <SubmitButton>{product ? 'حفظ التعديلات' : 'إنشاء المنتج'}</SubmitButton>
    </form>
  )
}
