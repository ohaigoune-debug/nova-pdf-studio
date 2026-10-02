'use client'

import { useMemo } from 'react'
import type { StudioBlock } from '@/lib/exam-blocks'
import { BLOCK_CSS, renderBlock, renderBody, renderFigures } from '@/server/lib/exam-render'

/** CSS الكتل مرة واحدة في الصفحة (نفس أنماط الطباعة) */
export function BlockStyles() {
  return <style>{`.studio-paper { font-family: 'Amiri', 'IBM Plex Sans Arabic', serif; } .studio-paper .katex { direction: ltr; unicode-bidi: isolate; display: inline-block; } .studio-paper .katex-display { direction: ltr; unicode-bidi: isolate; display: block; text-align: center; margin: 1.5mm 0; } .studio-paper .blk-table .tbl td, .studio-paper .blk-table .tbl th { border-color: #333; } ${BLOCK_CSS.replace(/\n\./g, '\n.studio-paper .')}`}</style>
}

/** عرض كتلة كما ستُطبع (نفس المصيّر الخادمي؛ KaTeX في المتصفح) */
export function BlockView({ block, assets, className }: { block: StudioBlock; assets?: Record<string, string>; className?: string }) {
  const html = useMemo(() => renderBlock(block, { assets }), [block, assets])
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

export function FiguresView({ figures, assets }: { figures?: StudioBlock[]; assets?: Record<string, string> }) {
  const html = useMemo(() => renderFigures(figures, { assets }), [figures, assets])
  if (!figures?.length) return null
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

/** نصّ بمعادلات $…$ وغامق — كما يُطبع */
export function RichText({ text, className, inline = false }: { text: string; className?: string; inline?: boolean }) {
  const html = useMemo(() => {
    const h = renderBody(text)
    return inline ? h.replace(/^<p dir="auto">|<\/p>$/g, '') : h
  }, [text, inline])
  return inline ? <span className={className} dir="auto" dangerouslySetInnerHTML={{ __html: html }} /> : <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
