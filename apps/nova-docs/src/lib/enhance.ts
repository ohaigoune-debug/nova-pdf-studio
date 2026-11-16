/**
 * تحسين صور المسح (بعد أن يكشف VisionKit الحدود ويصحح المنظور ويقص):
 *   - enhanced : تصحيح الإضاءة غير المتساوية (إزالة الظلال) بقسمة الصورة على تقدير الخلفية + مدّ المستويات
 *   - grayscale: رمادي مع تصحيح الإضاءة
 *   - bw       : أبيض/أسود بعتبة تكيّفية (Bradley) لوضوح النص عند الطباعة والـ OCR
 * دوال نقية على بكسلات RGBA (قابلة للاختبار دون متصفح).
 */
export type ScanFilter = 'original' | 'enhanced' | 'grayscale' | 'bw'

export interface Pixels {
  data: Uint8ClampedArray
  width: number
  height: number
}

const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b

/** صورة تكاملية لحساب متوسط أي مستطيل في O(1). */
function integral(gray: Float32Array, w: number, h: number): Float64Array {
  const ii = new Float64Array((w + 1) * (h + 1))
  for (let y = 1; y <= h; y++) {
    let row = 0
    for (let x = 1; x <= w; x++) {
      row += gray[(y - 1) * w + (x - 1)]
      ii[y * (w + 1) + x] = ii[(y - 1) * (w + 1) + x] + row
    }
  }
  return ii
}

function boxMean(ii: Float64Array, w: number, h: number, x: number, y: number, r: number): number {
  const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r)
  const x1 = Math.min(w, x + r + 1), y1 = Math.min(h, y + r + 1)
  const W = w + 1
  const sum = ii[y1 * W + x1] - ii[y0 * W + x1] - ii[y1 * W + x0] + ii[y0 * W + x0]
  return sum / ((x1 - x0) * (y1 - y0))
}

function grayOf(p: Pixels): Float32Array {
  const g = new Float32Array(p.width * p.height)
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = lum(p.data[j], p.data[j + 1], p.data[j + 2])
  return g
}

/**
 * تقدير الإضاءة: متوسط محلي واسع لكن «مُنحاز للورق» — نأخذ أقصى قيمة بين المتوسط المحلي ومتوسط أكبر،
 * فلا يُحسب الحبر الكثيف كخلفية مظلمة.
 */
function background(gray: Float32Array, w: number, h: number): Float32Array {
  const ii = integral(gray, w, h)
  const r1 = Math.max(4, Math.round(Math.min(w, h) / 24))
  const r2 = r1 * 3
  const bg = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      bg[y * w + x] = Math.max(boxMean(ii, w, h, x, y, r1), boxMean(ii, w, h, x, y, r2) * 0.97, 1)
    }
  }
  return bg
}

function percentile(values: Float32Array, p: number): number {
  const hist = new Uint32Array(256)
  for (let i = 0; i < values.length; i++) hist[Math.max(0, Math.min(255, Math.round(values[i])))]++
  const target = values.length * p
  let acc = 0
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc >= target) return v
  }
  return 255
}

export function applyScanFilter(src: Pixels, filter: ScanFilter): Pixels {
  if (filter === 'original') return src
  const { width: w, height: h } = src
  const out = new Uint8ClampedArray(src.data.length)
  const gray = grayOf(src)

  if (filter === 'bw') {
    // Bradley: البكسل أسود إن كان أغمق بنسبة t من متوسط جواره
    const ii = integral(gray, w, h)
    const r = Math.max(6, Math.round(Math.min(w, h) / 40))
    const t = 0.15
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        const v = gray[i] < boxMean(ii, w, h, x, y, r) * (1 - t) ? 0 : 255
        out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v
        out[i * 4 + 3] = 255
      }
    }
    return { data: out, width: w, height: h }
  }

  const bg = background(gray, w, h)
  // بعد التطبيع تصبح الورقة ≈ 255؛ نمدّ المستويات بين نسبة 2% (حبر) و 99.5% (ورق)
  const norm = new Float32Array(w * h)
  for (let i = 0; i < norm.length; i++) norm[i] = Math.min(255, (gray[i] / bg[i]) * 255)
  const lo = percentile(norm, 0.02)
  const hi = Math.max(lo + 1, percentile(norm, 0.995))
  const stretch = (v: number) => Math.max(0, Math.min(255, ((v - lo) / (hi - lo)) * 255))

  for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
    if (filter === 'grayscale') {
      const v = stretch(norm[i])
      out[j] = out[j + 1] = out[j + 2] = v
    } else {
      // enhanced: نطبّق كسب الإضاءة نفسه على القنوات الثلاث فنحافظ على الألوان (أختام، توقيعات بالأزرق)
      const gain = 255 / bg[i]
      for (let c = 0; c < 3; c++) out[j + c] = stretch(Math.min(255, src.data[j + c] * gain))
    }
    out[j + 3] = 255
  }
  return { data: out, width: w, height: h }
}

/** في الواجهة: يطبّق المرشح على صورة ويعيد JPEG. */
export async function filterImageBytes(bytes: Uint8Array, filter: ScanFilter, maxSide = 2400, quality = 0.86): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const bitmap = await createImageBitmap(new Blob([bytes]))
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  if (filter !== 'original') {
    const img = ctx.getImageData(0, 0, w, h)
    const res = applyScanFilter({ data: img.data, width: w, height: h }, filter)
    ctx.putImageData(new ImageData(res.data as unknown as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0)
  }
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality))
  if (!blob) throw new Error('toBlob failed')
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: w, height: h }
}
