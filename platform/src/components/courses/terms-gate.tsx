'use client'

import { ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import { acceptCourseTermsAction } from '@/server/actions/courses.actions'

/** عرض بسيط لنص Markdown للشروط: عناوين، قوائم، فقرات — بلا مكتبة */
function TermsText({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/)
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((b, i) => {
        const lines = b.split('\n').filter((l) => l.trim())
        if (lines.length === 0) return null
        const first = lines[0]!
        if (/^#{1,3}\s/.test(first)) {
          const level = first.match(/^(#{1,3})/)![1]!.length
          const title = first.replace(/^#{1,3}\s*/, '')
          const rest = lines.slice(1)
          return (
            <div key={i} className="space-y-2">
              {level === 1 ? <h2 className="text-lg font-extrabold">{title}</h2> : <h3 className="font-bold">{title}</h3>}
              {rest.length ? <TermsText text={rest.join('\n')} /> : null}
            </div>
          )
        }
        if (lines.every((l) => /^\s*(\d+[.)]|[-*•])\s+/.test(l))) {
          const ordered = /^\s*\d+[.)]/.test(first)
          const items = lines.map((l) => l.replace(/^\s*(\d+[.)]|[-*•])\s+/, ''))
          return ordered ? (
            <ol key={i} className="list-decimal space-y-1 ps-5">
              {items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ol>
          ) : (
            <ul key={i} className="list-disc space-y-1 ps-5">
              {items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ul>
          )
        }
        return <p key={i}>{lines.join(' ')}</p>
      })}
    </div>
  )
}

export function TermsGate({ courseId, slug, title, termsText }: { courseId: string; slug: string; title: string; termsText: string }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [pending, start] = useTransition()
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" /> النظام الداخلي وشروط الدورة
        </CardTitle>
        <CardDescription>قبل الدخول إلى «{title}» اقرأ الشروط ووافق عليها. تُطلب الموافقة مرة واحدة (وعند تحديث الشروط).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-[50vh] overflow-y-auto rounded-lg border bg-muted/30 p-4">
          <TermsText text={termsText} />
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <input type="checkbox" className="mt-1 size-4 accent-primary" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>قرأت ووافقت على النظام الداخلي والشروط، وأعلم أن الفيديوهات تختفي بعد البكالوريا.</span>
        </label>
        <Button
          className="w-full"
          size="lg"
          disabled={!checked}
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await acceptCourseTermsAction({ courseId, slug, accepted: true })
              if (!r.ok) return toast('error', r.error.message)
              toast('success', 'مرحباً بك في الدورة')
              router.refresh()
            })
          }
        >
          أوافق وأدخل الدورة
        </Button>
      </CardContent>
    </Card>
  )
}
