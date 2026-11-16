import { blobOf } from '../platform/bytes'
/**
 * تحسين صور المسح (بعد أن يكشف VisionKit الحدود ويصحح المنظور ويقص):
 *   - enhanced : تصحيح الإضاءة غير المتساوية (إزالة الظلال) بقسمة كل قناة على لون الورق المقدَّر، ثم تبييض الورق وتعميق الحبر
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

  // خلفية الورق لكل قناة (تقليص ← توسيع «max» يمحو الحبر ← تنعيم ← تكبير): بلا هالات حول النص
  const paper = paperBackground(src)
  const norm = new Float32Array(w * h * 3)
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    for (let c = 0; c < 3; c++) norm[i * 3 + c] = Math.min(255, (src.data[j + c] / Math.max(1, paper[i * 3 + c])) * 255)
  }
  // مستوى الحبر: نسبة 2% من الإضاءة بعد التطبيع؛ الورق يُبيَّض فوق ~90% (يمحو الضجيج والصبغة الصفراء)
  const l = new Float32Array(w * h)
  for (let i = 0; i < l.length; i++) l[i] = lum(norm[i * 3], norm[i * 3 + 1], norm[i * 3 + 2])
  const lo = Math.min(140, percentile(l, 0.02))
  const white = 232
  const curve = (v: number) => {
    const t = Math.max(0, Math.min(1, (v - lo) / (white - lo)))
    return 255 * Math.pow(t, 1.15) // تعميق خفيف للحبر
  }
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    if (filter === 'grayscale') {
      out[j] = out[j + 1] = out[j + 2] = curve(l[i])
    } else {
      // enhanced: الألوان محفوظة (أختام، توقيع بالأزرق)، والورق أبيض
      for (let c = 0; c < 3; c++) out[j + c] = curve(norm[i * 3 + c])
    }
    out[j + 3] = 255
  }
  return { data: out, width: w, height: h }
}

/**
 * تقدير لون الورق في كل بكسل (RGB): متوسط كتل صغيرة ← توسيع (أعلى قيمة في الجوار) يحذف الحبر لأنه أغمق
 * ← تنعيم ← تكبير خطي. ينتج إضاءة/ظلًا متدرجًا ناعمًا دون أن «يرى» الحروف.
 */
function paperBackground(src: Pixels): Float32Array {
  const { width: w, height: h, data } = src
  const f = Math.max(2, Math.round(Math.min(w, h) / 160))
  const sw = Math.ceil(w / f)
  const sh = Math.ceil(h / f)
  const small = new Float32Array(sw * sh * 3)
  const counts = new Float32Array(sw * sh)
  for (let y = 0; y < h; y++) {
    const sy = Math.floor(y / f)
    for (let x = 0; x < w; x++) {
      const k = sy * sw + Math.floor(x / f)
      const j = (y * w + x) * 4
      small[k * 3] += data[j]
      small[k * 3 + 1] += data[j + 1]
      small[k * 3 + 2] += data[j + 2]
      counts[k]++
    }
  }
  for (let k = 0; k < counts.length; k++) for (let c = 0; c < 3; c++) small[k * 3 + c] /= counts[k] || 1
  const dilated = filter2(small, sw, sh, 3, 'max')
  const smooth = filter2(dilated, sw, sh, 4, 'mean')
  // تكبير خطي إلى المقاس الأصلي
  const out = new Float32Array(w * h * 3)
  for (let y = 0; y < h; y++) {
    const fy = Math.min(sh - 1, Math.max(0, (y + 0.5) / f - 0.5))
    const y0 = Math.floor(fy), y1 = Math.min(sh - 1, y0 + 1), ty = fy - y0
    for (let x = 0; x < w; x++) {
      const fx = Math.min(sw - 1, Math.max(0, (x + 0.5) / f - 0.5))
      const x0 = Math.floor(fx), x1 = Math.min(sw - 1, x0 + 1), tx = fx - x0
      for (let c = 0; c < 3; c++) {
        const a = smooth[(y0 * sw + x0) * 3 + c] * (1 - tx) + smooth[(y0 * sw + x1) * 3 + c] * tx
        const b = smooth[(y1 * sw + x0) * 3 + c] * (1 - tx) + smooth[(y1 * sw + x1) * 3 + c] * tx
        out[(y * w + x) * 3 + c] = a * (1 - ty) + b * ty
      }
    }
  }
  return out
}

/** مرشح مربع منفصل (أفقي ثم عمودي) على صورة RGB صغيرة: max أو mean. */
function filter2(src: Float32Array, w: number, h: number, r: number, mode: 'max' | 'mean'): Float32Array {
  const pass = (input: Float32Array, horizontal: boolean) => {
    const out = new Float32Array(input.length)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let c = 0; c < 3; c++) {
          let acc = mode === 'max' ? 0 : 0
          let n = 0
          for (let d = -r; d <= r; d++) {
            const xx = horizontal ? x + d : x
            const yy = horizontal ? y : y + d
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
            const v = input[(yy * w + xx) * 3 + c]
            if (mode === 'max') acc = Math.max(acc, v)
            else acc += v
            n++
          }
          out[(y * w + x) * 3 + c] = mode === 'max' ? acc : acc / n
        }
      }
    }
    return out
  }
  return pass(pass(src, true), false)
}

/** في الواجهة: يطبّق المرشح على صورة ويعيد JPEG. */
export async function filterImageBytes(bytes: Uint8Array, filter: ScanFilter, maxSide = 2400, quality = 0.86): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const bitmap = await createImageBitmap(blobOf(bytes))
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
