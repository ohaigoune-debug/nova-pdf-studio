/** لوحة التوقيع: رسم بالإصبع أو Apple Pencil بضغط متغير، قصّ تلقائي للفراغ، حفظ حتى 4 توقيعات. */
import { Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePrefs } from '../../stores/prefs'
import { Button } from '../../ui/kit'
import { Sheet } from '../../ui/overlays'

export interface SignatureResult { dataBase64: string; aspect: number }

function trimCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = src.getContext('2d')!
  const { width, height } = src
  const data = ctx.getImageData(0, 0, width, height).data
  let minX = width, minY = height, maxX = 0, maxY = 0
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] > 10) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  const pad = 8
  const w = Math.max(1, maxX - minX + pad * 2)
  const h = Math.max(1, maxY - minY + pad * 2)
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d')!.drawImage(src, minX - pad, minY - pad, w, h, 0, 0, w, h)
  return out
}

export function SignatureSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (r: SignatureResult) => void }) {
  const { t } = useTranslation()
  const { signatures, addSignature, removeSignature } = usePrefs()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hasInk, setHasInk] = useState(false)
  const [color, setColor] = useState('#0B2A6F')
  const last = useRef<{ x: number; y: number; w: number } | null>(null)

  useEffect(() => {
    if (!open) return
    const c = canvasRef.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = c.clientWidth * dpr
    c.height = c.clientHeight * dpr
    setHasInk(false)
  }, [open])

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5
    return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr, w: (1.2 + pressure * 3.2) * dpr }
  }
  const down = (e: React.PointerEvent) => {
    canvasRef.current!.setPointerCapture(e.pointerId)
    last.current = pos(e)
  }
  const move = (e: React.PointerEvent) => {
    if (!last.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
    for (const ev of events) {
      const p = pos(ev as unknown as React.PointerEvent)
      ctx.strokeStyle = color
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = (last.current.w + p.w) / 2
      ctx.beginPath()
      ctx.moveTo(last.current.x, last.current.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
      last.current = p
    }
    setHasInk(true)
  }
  const up = () => (last.current = null)
  const clear = () => {
    const c = canvasRef.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setHasInk(false)
  }
  const pickDataUrl = (url: string) => {
    const img = new Image()
    img.onload = () => {
      onPick({ dataBase64: url.split(',')[1], aspect: img.height / img.width })
      onClose()
    }
    img.src = url
  }
  const use = () => {
    const trimmed = trimCanvas(canvasRef.current!)
    const url = trimmed.toDataURL('image/png')
    addSignature(url)
    pickDataUrl(url)
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('ios.sign.title')} trailing={<button className="text-accent" onClick={onClose}>{t('common.cancel')}</button>}>
      <div className="px-4">
        {signatures.length > 0 && (
          <>
            <div className="mb-2 text-[13px] uppercase text-muted">{t('ios.sign.saved')}</div>
            <div className="mb-5 grid grid-cols-2 gap-3">
              {signatures.map((s, i) => (
                <div key={i} className="relative rounded-ios bg-white p-2 shadow-card">
                  <button className="block h-16 w-full" onClick={() => pickDataUrl(s)}><img src={s} alt="" className="h-full w-full object-contain" /></button>
                  <button aria-label={t('ios.sign.remove')} onClick={() => removeSignature(i)} className="absolute end-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-danger/10 text-danger"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] uppercase text-muted">{t('ios.sign.new')}</span>
          <div className="flex gap-2">
            {['#0B2A6F', '#111111', '#1D4ED8'].map((c) => (
              <button key={c} aria-label={c} onClick={() => setColor(c)} className="h-7 w-7 rounded-full border-2" style={{ background: c, borderColor: color === c ? '#17B890' : 'transparent' }} />
            ))}
          </div>
        </div>
        <div className="relative overflow-hidden rounded-card bg-white shadow-card">
          <canvas ref={canvasRef} className="ink-layer block h-[220px] w-full" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          {!hasInk && <div className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-dashed border-gray-300 pb-1 text-[13px] text-gray-400">{t('ios.sign.drawHere')}</div>}
        </div>
        <div className="mt-4 flex gap-3">
          <Button variant="tinted" className="flex-1" onClick={clear}>{t('ios.sign.clear')}</Button>
          <Button className="flex-1" disabled={!hasInk} onClick={use}>{t('ios.sign.use')}</Button>
        </div>
      </div>
    </Sheet>
  )
}
