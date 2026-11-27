// Ayudas para los PDF adjuntos a la ficha del cliente (cotizaciones)

export const MAX_PDF_BYTES = 10 * 1024 * 1024

export const fmtSize = (b) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

/** null si el archivo sirve; si no, el motivo */
export function pdfProblem(file) {
  if (!file) return 'Elige un archivo'
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!isPdf) return 'Solo se pueden adjuntar archivos PDF'
  if (file.size > MAX_PDF_BYTES) return `El PDF pesa ${fmtSize(file.size)}; el máximo es 10 MB`
  return null
}
