import { readBarcodesFromImageData, prepareZXingModule } from 'zxing-wasm/reader'

prepareZXingModule({
  overrides: {
    locateFile: (path, prefix) => {
      if (path.endsWith('.wasm')) {
        return '/wasm/zxing_reader.wasm'
      }
      return prefix + path
    }
  }
})

function mapResults(results) {
  return results.map(r => ({
    rawValue: r.text ?? r.rawValue ?? '',
    format: r.format
  }))
}

export async function detectFromCanvas(canvas) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return []
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return detectFromImageData(imageData)
}

export async function detectFromImageData(imageData, opts) {
  const results = await readBarcodesFromImageData(imageData, opts || {
    formats: ['AllReadable'],
    tryHarder: true,
    maxNumberOfSymbols: 1
  })
  return mapResults(results)
}
