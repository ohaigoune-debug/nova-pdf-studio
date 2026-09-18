import type { ReactNode } from 'react'

/** عرض Markdown مبسّط وآمن (عناوين، قوائم، فقرات) بلا HTML خام */
export function Markdown({ body, className }: { body: string; className?: string }) {
  const lines = body.split(/\r?\n/)
  const out: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={out.length} className="list-disc space-y-1 ps-6">
          {list.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )
      list = []
    }
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    if (line.startsWith('## ') || line.startsWith('# ')) {
      flush()
      out.push(
        <h2 key={out.length} className="mt-6 text-xl font-extrabold">
          {line.replace(/^#+\s/, '')}
        </h2>
      )
    } else if (/^[-*•]\s/.test(line) || /^\d+\.\s/.test(line)) {
      list.push(line.replace(/^([-*•]|\d+\.)\s/, ''))
    } else {
      flush()
      out.push(
        <p key={out.length} className="leading-8">
          {line}
        </p>
      )
    }
  }
  flush()
  return <div className={className ?? 'space-y-3 text-[17px]'}>{out}</div>
}
