import { blobOf } from '../../platform/bytes'
/** توحيد الصور قبل تحويلها إلى PDF: فك ترميز أي صيغة يدعمها النظام (HEIC/PNG/JPEG)، تصغير معقول، JPEG. */
export async function normalizeImages(list: Uint8Array[], maxSide = 2400): Promise<{ bytes: Uint8Array; width: number; height: number }[]> {
  const out = []
  for (const bytes of list) {
    const bitmap = await createImageBitmap(blobOf(bytes))
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.88))
    if (!blob) continue
    out.push({ bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height })
  }
  return out
}

export async function rotateImage(bytes: Uint8Array, quarterTurns: number): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const bitmap = await createImageBitmap(blobOf(bytes))
  const turns = ((quarterTurns % 4) + 4) % 4
  const swap = turns % 2 === 1
  const canvas = document.createElement('canvas')
  canvas.width = swap ? bitmap.height : bitmap.width
  canvas.height = swap ? bitmap.width : bitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((turns * Math.PI) / 2)
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
  bitmap.close()
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9))
  return { bytes: new Uint8Array(await blob!.arrayBuffer()), width: canvas.width, height: canvas.height }
}
