/** اختيار ملفات في المتصفح عبر <input type=file> (بديل UIDocumentPicker في وضع الويب). */
export interface PickedWebFile {
  name: string
  bytes: Uint8Array
  mimeType: string
  url: string
}

export function pickWebFiles(accept: string, multiple: boolean, capture?: 'environment'): Promise<PickedWebFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    if (capture) input.setAttribute('capture', capture)
    input.style.display = 'none'
    document.body.appendChild(input)
    let settled = false
    const done = async () => {
      if (settled) return
      settled = true
      const files = Array.from(input.files ?? [])
      const out: PickedWebFile[] = []
      for (const f of files) {
        const bytes = new Uint8Array(await f.arrayBuffer())
        out.push({ name: f.name, bytes, mimeType: f.type || 'application/octet-stream', url: URL.createObjectURL(f) })
      }
      input.remove()
      resolve(out)
    }
    input.addEventListener('change', () => void done())
    input.addEventListener('cancel', () => {
      settled = true
      input.remove()
      resolve([])
    })
    input.click()
  })
}
