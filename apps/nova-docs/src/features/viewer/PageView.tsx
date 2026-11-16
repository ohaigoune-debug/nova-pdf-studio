/**
 * صفحة PDF واحدة: تصيير كسول بـ pdf.js (عند الاقتراب من الشاشة فقط) + طبقة تحرير تفاعلية باللمس وApple Pencil.
 * كل الإحداثيات في الطبقة بالنقاط من أعلى-يسار الصفحة (نظام editModel)، وتحويلها للشاشة = × scale.
 */
import clsx from 'clsx'
import { MessageSquareText } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PdfEngine, PageInfo, TextSpan } from '@modules/pdf/renderer/pdfEngine'
import type { EditObject, TextObject } from '@modules/pdf/shared/editModel'
import { isRtlText } from '@modules/pdf/shared/editModel'
import { editorCssFont } from '../../lib/editorFonts'
import { strokeToSvgPath, type InkStroke } from '../../lib/ink'
import { NOTE_SIZE } from '../../lib/annotations'
import { Capacitor } from '@capacitor/core'
import { NovaPdfRender, nativeRenderAvailable } from '../../platform/native'
import { usePrefs } from '../../stores/prefs'
import { newId, useEditor } from './editorState'
import { usePro } from '../../stores/proInstance'
import { confirmDialog, promptDialog, toast } from '../../ui/overlays'
import type { Feature } from '../../lib/features'

export interface HitRect { x: number; y: number; width: number; height: number; active: boolean }

interface Props {
  engine: PdfEngine
  info: PageInfo
  scale: number
  editing: boolean
  hits: HitRect[]
  onVisible: (index: number) => void
  /** مسار الملف في صندوق التطبيق: يتيح العرض بمحرك iOS (PDFKit) */
  fileUri?: string | null
}

const TOOL_FEATURE: Record<string, Feature> = { text: 'editText', highlight: 'highlight', pen: 'ink', image: 'editImage', shape: 'shapes', note: 'comments', whiteout: 'whiteout', signature: 'signature' }

function ObjectView({ o, scale, selected }: { o: EditObject; scale: number; selected: boolean }) {
  const style: React.CSSProperties = { left: o.x * scale, top: o.y * scale, width: o.width * scale, height: o.height * scale, transform: o.rotation ? `rotate(${o.rotation}deg)` : undefined }
  const ring = selected ? 'outline outline-2 outline-offset-2 outline-accent' : ''
  switch (o.kind) {
    case 'text':
      return (
        <div data-oid={o.id} className={clsx('absolute whitespace-pre-wrap break-words leading-[1.25]', ring)} style={{ ...style, height: 'auto', minHeight: style.height, font: editorCssFont(o as TextObject, scale), color: o.color, background: o.background ?? undefined, direction: o.direction === 'auto' ? (isRtlText(o.text) ? 'rtl' : 'ltr') : o.direction, textAlign: o.align === 'right' ? 'right' : o.align === 'center' ? 'center' : 'left', textDecoration: o.underline ? 'underline' : undefined }}>
          {o.text}
        </div>
      )
    case 'image':
      return <img data-oid={o.id} alt="" draggable={false} className={clsx('absolute select-none', ring)} style={{ ...style, opacity: o.opacity }} src={`data:${o.mime};base64,${o.dataBase64}`} />
    case 'highlight':
      return <div data-oid={o.id} className={clsx('absolute mix-blend-multiply', ring)} style={{ ...style, background: o.color, opacity: o.opacity }} />
    case 'redact':
      return <div data-oid={o.id} className={clsx('absolute', ring)} style={{ ...style, background: o.color }} />
    case 'rect':
    case 'ellipse':
      return <div data-oid={o.id} className={clsx('absolute', ring)} style={{ ...style, border: `${o.strokeWidth * scale}px solid ${o.stroke}`, background: o.fill ?? undefined, opacity: o.opacity, borderRadius: o.kind === 'ellipse' ? '50%' : 0 }} />
    default:
      return <div data-oid={o.id} className={clsx('absolute border border-dashed border-accent', ring)} style={style} />
  }
}

function inkBounds(s: InkStroke) {
  const xs = s.points.map((p) => p[0])
  const ys = s.points.map((p) => p[1])
  return { x: Math.min(...xs), y: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

export const PageView = memo(function PageView({ engine, info, scale, editing, hits, onVisible, fileUri }: Props) {
  const { t } = useTranslation()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)
  const [rendered, setRendered] = useState(0)
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [livePoints, setLivePoints] = useState<[number, number][] | null>(null)
  // تعليقات PDF الموجودة في الملف (Sticky notes) — يرسمها pdf.js في طبقة HTML لا على الـ canvas، فنعرضها بأنفسنا
  const [fileNotes, setFileNotes] = useState<{ x: number; y: number; text: string; author: string }[]>([])
  const pencilSeen = useRef(false)
  const gesture = useRef<{ mode: 'draw' | 'rect' | 'move' | 'resize'; startX: number; startY: number; id?: string; ox?: number; oy?: number; ow?: number; oh?: number; points?: [number, number][] } | null>(null)

  const editor = useEditor()
  const objects = editor.present.objects.filter((o) => o.page === info.index)
  const ink = editor.present.ink.filter((s) => s.page === info.index)
  const notes = editor.present.notes.filter((n) => n.page === info.index)
  const W = info.widthPt * scale
  const H = info.heightPt * scale

  // ظهور الصفحة: نصيّر فقط ما يقترب من الشاشة، ونحرر الذاكرة لما يبتعد كثيرًا
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      const e = entries[0]
      setVisible(e.isIntersecting)
      if (e.intersectionRatio > 0.35) onVisible(info.index)
    }, { rootMargin: '700px 0px', threshold: [0, 0.35] })
    io.observe(el)
    return () => io.disconnect()
  }, [info.index, onVisible])

  // ---- العرض بمحرك iOS (PDFKit) أولًا؛ pdf.js احتياطًا (الويب، الملفات المشفّرة، أي فشل)
  const wantNative = usePrefs((st) => st.nativeRender) && !!fileUri && nativeRenderAvailable()
  const [nativeSrc, setNativeSrc] = useState<string | null>(null)
  const [nativeFailed, setNativeFailed] = useState(false)
  const useNative = wantNative && !nativeFailed
  useEffect(() => {
    if (!useNative) return
    if (!visible) {
      setNativeSrc(null)
      return
    }
    let alive = true
    // عرض بكسلي مُكمَّم (مضاعفات 160) كي يعيد التكبير المتقارب استعمال الصورة المخزّنة
    const px = Math.min(4096, Math.max(320, Math.ceil((W * Math.min(window.devicePixelRatio || 2, 3)) / 160) * 160))
    const timer = setTimeout(() => {
      NovaPdfRender.renderPage({ path: fileUri!, page: info.index, width: px })
        .then((r) => alive && setNativeSrc(r.webPath ?? Capacitor.convertFileSrc(r.path)))
        .catch(() => alive && setNativeFailed(true))
    }, nativeSrc ? 120 : 0)
    return () => {
      alive = false
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useNative, visible, W, fileUri, info.index, engine])

  useEffect(() => {
    if (useNative) return
    if (!visible || !canvasRef.current) {
      if (!visible && canvasRef.current && rendered) {
        canvasRef.current.width = 1
        canvasRef.current.height = 1
        setRendered(0)
      }
      return
    }
    let cancel: (() => void) | null = null
    let alive = true
    const timer = setTimeout(async () => {
      try {
        const task = await engine.render(info.index, canvasRef.current!, scale)
        cancel = task.cancel
        await task.done
        if (alive) setRendered(scale)
      } catch {
        /* صفحة تالفة: تبقى بيضاء */
      }
    }, rendered ? 120 : 0)
    return () => {
      alive = false
      clearTimeout(timer)
      cancel?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, scale, engine, info.index, useNative])

  useEffect(() => {
    if (!visible) return
    let alive = true
    void (async () => {
      try {
        const page = await engine.page(info.index)
        const vp = page.getViewport({ scale: 1 })
        const annots = (await page.getAnnotations()) as { subtype: string; rect: number[]; contentsObj?: { str: string }; titleObj?: { str: string } }[]
        const notes = annots
          .filter((a) => a.subtype === 'Text' && a.contentsObj?.str)
          .map((a) => {
            const [x1, y1] = vp.convertToViewportPoint(a.rect[0], a.rect[3])
            return { x: x1, y: y1, text: a.contentsObj!.str, author: a.titleObj?.str ?? '' }
          })
        if (alive) setFileNotes(notes)
      } catch {
        /* ملف بلا تعليقات */
      }
    })()
    return () => {
      alive = false
    }
  }, [visible, engine, info.index])

  const toPt = useCallback((e: { clientX: number; clientY: number }) => {
    const r = wrapRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
  }, [scale])

  const allowed = (tool: string) => {
    const f = TOOL_FEATURE[tool]
    return !f || usePro.getState().require(f)
  }

  const spanAt = async (x: number, y: number): Promise<TextSpan | null> => {
    const spans = await engine.textSpans(info.index)
    return spans.find((s) => x >= s.x && x <= s.x + s.width && y >= s.y - 2 && y <= s.y + s.height + 2) ?? null
  }

  const onPointerDown = async (e: React.PointerEvent) => {
    if (!editing) return
    const tool = editor.tool
    if (e.pointerType === 'pen') pencilSeen.current = true
    // بعد استعمال Apple Pencil: الإصبع يمرّر الصفحة والقلم يكتب (رفض راحة اليد)
    if (tool === 'pen' && e.pointerType === 'touch' && pencilSeen.current) return
    const p = toPt(e)
    const target = (e.target as HTMLElement).closest('[data-oid]') as HTMLElement | null
    const handle = (e.target as HTMLElement).closest('[data-handle]') as HTMLElement | null

    if (tool === 'select') {
      if (handle && editor.selectedId) {
        const o = editor.present.objects.find((x) => x.id === editor.selectedId)
        if (o) gesture.current = { mode: 'resize', startX: p.x, startY: p.y, id: o.id, ow: o.width, oh: o.height }
      } else if (target) {
        const id = target.dataset.oid!
        const o = editor.present.objects.find((x) => x.id === id)
        editor.select(id)
        if (o && !o.locked) gesture.current = { mode: 'move', startX: p.x, startY: p.y, id, ox: o.x, oy: o.y }
      } else {
        const stroke = ink.find((s) => { const b = inkBounds(s); return p.x >= b.x - 6 && p.x <= b.x1 + 6 && p.y >= b.y - 6 && p.y <= b.y1 + 6 })
        const note = notes.find((n) => p.x >= n.x && p.x <= n.x + NOTE_SIZE && p.y >= n.y && p.y <= n.y + NOTE_SIZE)
        editor.select(stroke?.id ?? note?.id ?? null)
      }
      if (gesture.current) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      return
    }
    if (!allowed(tool)) return

    if (tool === 'pen') {
      gesture.current = { mode: 'draw', startX: p.x, startY: p.y, points: [[p.x, p.y]] }
      setLivePoints([[p.x, p.y]])
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      return
    }
    if (tool === 'highlight' || tool === 'whiteout' || tool === 'shape') {
      gesture.current = { mode: 'rect', startX: p.x, startY: p.y }
      setDraft({ x: p.x, y: p.y, w: 0, h: 0 })
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      return
    }
    if ((tool === 'signature' || tool === 'image') && editor.pending) {
      const w = Math.min(170, info.widthPt * 0.4)
      const h = w * editor.pending.aspect
      editor.addObject({ id: newId('img'), kind: 'image', page: info.index, x: p.x - w / 2, y: p.y - h / 2, width: w, height: h, mime: editor.pending.mime, dataBase64: editor.pending.dataBase64, role: editor.pending.role, opacity: 1 })
      editor.setPending(null)
      editor.setTool('select')
      return
    }
    if (tool === 'text') {
      // لمس نص موجود = استبداله بطبقة (تبييض + نص جديد بنفس الموضع والحجم) — لا ندّعي تعديل النص الأصلي داخل الملف
      const span = await spanAt(p.x, p.y)
      const value = await promptDialog(t('ios.edit.enterText'), span?.text ?? '')
      if (!value) return
      if (span) {
        editor.commit({
          ...editor.present,
          objects: [
            ...editor.present.objects,
            { id: newId('wo'), kind: 'redact', page: info.index, x: span.x - 1, y: span.y - 1, width: span.width + 2, height: span.height + 2, color: '#ffffff' },
            { id: newId('tx'), kind: 'text', page: info.index, x: span.x, y: span.y, width: Math.max(span.width + 20, 60), height: span.height, text: value, fontSize: Math.max(6, span.fontSize * 0.95), fontFamily: 'sans', bold: false, italic: false, underline: false, align: span.dir === 'rtl' ? 'right' : 'left', color: '#111111', background: null, direction: 'auto', replaces: { spanText: span.text } }
          ]
        })
      } else {
        const fs = editor.fontSize
        const width = Math.min(260, info.widthPt - p.x - 8)
        editor.addObject({ id: newId('tx'), kind: 'text', page: info.index, x: p.x, y: p.y - fs * 0.6, width: Math.max(60, width), height: fs * 1.3 * value.split('\n').length, text: value, fontSize: fs, fontFamily: 'sans', bold: false, italic: false, underline: false, align: isRtlText(value) ? 'right' : 'left', color: editor.color, background: null, direction: 'auto', ...(editor.fontName ? { fontName: editor.fontName } : {}) } as EditObject)
      }
      editor.setTool('select')
      return
    }
    if (tool === 'note') {
      const value = await promptDialog(t('ios.edit.enterNote'))
      if (value) editor.addNote({ id: newId('nt'), page: info.index, x: p.x - NOTE_SIZE / 2, y: p.y - NOTE_SIZE / 2, text: value, color: '#F5C518' })
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g) return
    const p = toPt(e)
    if (g.mode === 'draw') {
      const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent]
      for (const ev of events) g.points!.push([toPt(ev).x, toPt(ev).y])
      setLivePoints([...g.points!])
    } else if (g.mode === 'rect') {
      setDraft({ x: Math.min(g.startX, p.x), y: Math.min(g.startY, p.y), w: Math.abs(p.x - g.startX), h: Math.abs(p.y - g.startY) })
    } else if (g.mode === 'move' && g.id) {
      editor.updateObject(g.id, { x: g.ox! + (p.x - g.startX), y: g.oy! + (p.y - g.startY) }, false)
    } else if (g.mode === 'resize' && g.id) {
      const o = editor.present.objects.find((x) => x.id === g.id)
      const keepAspect = o?.kind === 'image'
      const w = Math.max(12, g.ow! + (p.x - g.startX))
      const h = keepAspect ? (w * g.oh!) / g.ow! : Math.max(8, g.oh! + (p.y - g.startY))
      editor.updateObject(g.id, { width: w, height: h }, false)
    }
  }

  const onPointerUp = () => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (g.mode === 'draw' && g.points && g.points.length > 1) {
      editor.addInk({ id: newId('ink'), page: info.index, points: g.points, color: editor.color, width: editor.strokeWidth, opacity: 1 })
      setLivePoints(null)
    } else if (g.mode === 'draw') {
      setLivePoints(null)
    } else if (g.mode === 'rect' && draft) {
      setDraft(null)
      if (draft.w < 4 || draft.h < 4) {
        if (editor.tool === 'highlight') {
          void spanAt(g.startX, g.startY).then((s) => s && editor.addObject({ id: newId('hl'), kind: 'highlight', page: info.index, x: s.x, y: s.y, width: s.width, height: s.height, color: editor.color === '#111111' ? '#FFE066' : editor.color, opacity: 0.45 }))
        }
        return
      }
      const base = { page: info.index, x: draft.x, y: draft.y, width: draft.w, height: draft.h }
      if (editor.tool === 'highlight') editor.addObject({ id: newId('hl'), kind: 'highlight', ...base, color: '#FFE066', opacity: 0.45 })
      else if (editor.tool === 'whiteout') editor.addObject({ id: newId('wo'), kind: 'redact', ...base, color: '#ffffff' })
      else editor.addObject({ id: newId('sh'), kind: 'rect', ...base, stroke: editor.color, strokeWidth: editor.strokeWidth, fill: null, opacity: 1 })
    } else if ((g.mode === 'move' || g.mode === 'resize') && g.id) {
      // تسجيل الحركة النهائية في التاريخ كخطوة واحدة
      const o = editor.present.objects.find((x) => x.id === g.id)
      if (o) editor.updateObject(g.id, { x: o.x, y: o.y, width: o.width, height: o.height }, true)
    }
  }

  const onDoubleClick = async (e: React.MouseEvent) => {
    if (!editing) return
    const target = (e.target as HTMLElement).closest('[data-oid]') as HTMLElement | null
    const o = target && editor.present.objects.find((x) => x.id === target.dataset.oid)
    if (o?.kind === 'text') {
      const value = await promptDialog(t('ios.edit.enterText'), o.text)
      if (value) editor.updateObject(o.id, { text: value } as Partial<EditObject>)
    }
  }

  const selected = editor.present.objects.find((o) => o.id === editor.selectedId && o.page === info.index)
  const penActive = editing && editor.tool === 'pen'

  return (
    <div ref={wrapRef} data-page={info.index} className="pdf-page relative mx-auto mb-4" style={{ width: W, height: H }}>
      {useNative
        ? nativeSrc && <img src={nativeSrc} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none" data-renderer="ios" />
        : <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" data-renderer="pdfjs" />}
      {hits.map((h, i) => (
        <div key={i} className={clsx('pointer-events-none absolute rounded-sm', h.active ? 'bg-[#FF9F0A]/55' : 'bg-[#FFE066]/50')} style={{ left: h.x * scale, top: h.y * scale, width: h.width * scale, height: h.height * scale }} />
      ))}
      <div
        className={clsx('absolute inset-0', editing && 'no-select', penActive && 'ink-layer cursor-crosshair', editing && editor.tool !== 'select' && !penActive && 'touch-none')}
        style={{ touchAction: penActive && !pencilSeen.current ? 'none' : penActive ? 'pan-x pan-y' : undefined }}
        onPointerDown={(e) => void onPointerDown(e)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => void onDoubleClick(e)}
      >
        {objects.map((o) => <ObjectView key={o.id} o={o} scale={scale} selected={editing && o.id === editor.selectedId} />)}
        <svg className="pointer-events-none absolute inset-0" width={W} height={H} viewBox={`0 0 ${info.widthPt} ${info.heightPt}`}>
          {ink.map((s) => (
            <path key={s.id} d={strokeToSvgPath(s.points)} fill="none" stroke={s.color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" opacity={s.opacity} className={editor.selectedId === s.id ? 'drop-shadow-[0_0_2px_#17B890]' : ''} />
          ))}
          {livePoints && <path d={strokeToSvgPath(livePoints)} fill="none" stroke={editor.color} strokeWidth={editor.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
        {notes.map((n) => (
          <div key={n.id} title={n.text} className={clsx('absolute grid place-items-center rounded-[4px] bg-[#F5C518] text-[#4a3800] shadow', editor.selectedId === n.id && 'outline outline-2 outline-accent')} style={{ left: n.x * scale, top: n.y * scale, width: Math.max(NOTE_SIZE * scale, 26), height: Math.max(NOTE_SIZE * scale, 26) }}>
            <MessageSquareText style={{ width: NOTE_SIZE * scale * 0.7, height: NOTE_SIZE * scale * 0.7 }} />
          </div>
        ))}
        {fileNotes.map((n, i) => (
          <button key={`f${i}`} aria-label={n.text} title={n.text} onClick={(e) => { e.stopPropagation(); void confirmDialog(n.author || t('ios.edit.note'), { message: n.text }) }}
            className="absolute grid place-items-center rounded-[4px] bg-[#F5C518] text-[#4a3800] shadow" style={{ left: n.x * scale, top: n.y * scale, width: Math.max(NOTE_SIZE * scale, 26), height: Math.max(NOTE_SIZE * scale, 26) }}>
            <MessageSquareText style={{ width: NOTE_SIZE * scale * 0.7, height: NOTE_SIZE * scale * 0.7 }} />
          </button>
        ))}
        {draft && <div className={clsx('pointer-events-none absolute border-2 border-dashed', editor.tool === 'whiteout' ? 'border-muted bg-white' : editor.tool === 'highlight' ? 'border-transparent bg-[#FFE066]/50' : 'border-accent')} style={{ left: draft.x * scale, top: draft.y * scale, width: draft.w * scale, height: draft.h * scale }} />}
        {editing && selected && editor.tool === 'select' && (
          <div data-handle className="absolute h-7 w-7 rounded-full border-2 border-white bg-accent shadow" style={{ left: (selected.x + selected.width) * scale - 14, top: (selected.y + selected.height) * scale - 14, touchAction: 'none' }} />
        )}
      </div>
    </div>
  )
})
