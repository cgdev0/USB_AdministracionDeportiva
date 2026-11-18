// Foto o documento clínico (v2.8, T1.1 del plan de historia clínica): consentimiento firmado (Fase 2), fotos de
// postura (T3.4) o exámenes. En el celular y la tableta, "Tomar foto" abre la cámara trasera; "Elegir archivo" abre la
// galería o los archivos. Antes de subirla, la foto se endereza (orientación de la cámara) y se reduce a máximo
// 1600 px por lado en JPG: pesa poco aunque la señal sea mala, y se lee bien. Un PDF se entrega tal cual.
// Muestra la vista previa con su tamaño. Entrega el archivo listo (File) a `onCambio`; quien la usa la sube a
// /api/archivos-clinicos (T0.5), que acepta JPG, PNG y PDF de hasta 5 MB.
import { useEffect, useRef, useState } from 'react'

const MAX_BYTES = 5 * 1024 * 1024
const pesoLegible = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

async function cargarImagen(archivo) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(archivo, { imageOrientation: 'from-image' }) } catch { /* se intenta con <img> */ }
  }
  const url = URL.createObjectURL(archivo)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Reduce la foto a máximo `maxLado` px por lado y la guarda en JPG con la calidad indicada
export async function comprimirFoto(archivo, { maxLado = 1600, calidad = 0.85 } = {}) {
  const imagen = await cargarImagen(archivo)
  const ancho = imagen.width, alto = imagen.height
  const escala = Math.min(1, maxLado / Math.max(ancho, alto))
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.round(ancho * escala)
  lienzo.height = Math.round(alto * escala)
  lienzo.getContext('2d').drawImage(imagen, 0, 0, lienzo.width, lienzo.height)
  imagen.close?.()
  const blob = await new Promise((ok, mal) => lienzo.toBlob(b => (b ? ok(b) : mal(new Error('No se pudo procesar la foto.'))), 'image/jpeg', calidad))
  const nombre = (archivo.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg'
  return { archivo: new File([blob], nombre, { type: 'image/jpeg' }), ancho: lienzo.width, alto: lienzo.height, original: archivo.size }
}

export default function CampoFoto({ id, etiqueta, onCambio, aceptaPdf = false, maxLado = 1600, calidad = 0.85, ayuda }) {
  const camara = useRef(null)
  const galeria = useRef(null)
  const [resultado, setResultado] = useState(null) // { archivo, url, ancho, alto, original, pdf }
  const [error, setError] = useState(null)
  const [procesando, setProcesando] = useState(false)

  useEffect(() => () => { if (resultado?.url) URL.revokeObjectURL(resultado.url) }, [resultado])

  const elegir = async (e) => {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setError(null)
    setProcesando(true)
    try {
      let r
      if (archivo.type === 'application/pdf') {
        if (!aceptaPdf) throw new Error('Aquí solo se aceptan fotos.')
        r = { archivo, pdf: true, original: archivo.size }
      } else if (/^image\//.test(archivo.type)) {
        const c = await comprimirFoto(archivo, { maxLado, calidad })
        r = { ...c, url: URL.createObjectURL(c.archivo) }
      } else {
        throw new Error(aceptaPdf ? 'Elige una foto o un PDF.' : 'Elige una foto.')
      }
      if (r.archivo.size > MAX_BYTES) throw new Error('El archivo supera los 5 MB. Comprime el PDF o toma la foto de nuevo.')
      setResultado(r)
      onCambio?.(r.archivo)
    } catch (err) {
      setError(err.message || 'No se pudo usar ese archivo.')
    } finally {
      setProcesando(false)
    }
  }
  const quitar = () => { setResultado(null); setError(null); onCambio?.(null) }

  return (
    <div className="form-group campo-foto">
      <span className="etiqueta-campo" id={`${id}-etiqueta`}>{etiqueta}</span>
      {ayuda && <small className="ayuda-campo">{ayuda}</small>}
      <input ref={camara} id={`${id}-camara`} type="file" accept="image/*" capture="environment" hidden onChange={elegir} />
      <input ref={galeria} id={`${id}-archivo`} type="file" accept={aceptaPdf ? 'image/*,application/pdf' : 'image/*'} hidden onChange={elegir} />

      {resultado ? (
        <div className="campo-foto-vista" role="group" aria-labelledby={`${id}-etiqueta`}>
          {resultado.pdf
            ? <div className="campo-foto-pdf"><i className="fa-solid fa-file-pdf" aria-hidden="true"></i> {resultado.archivo.name}</div>
            : <img src={resultado.url} alt={`Vista previa: ${etiqueta}`} />}
          <p className="ayuda-campo campo-foto-info">
            {resultado.pdf
              ? `PDF · ${pesoLegible(resultado.archivo.size)}`
              : `${resultado.ancho} × ${resultado.alto} px · ${pesoLegible(resultado.archivo.size)} (original: ${pesoLegible(resultado.original)})`}
          </p>
          <div className="campo-foto-botones">
            <button type="button" className="btn btn-secondary" onClick={() => camara.current.click()}><i className="fa-solid fa-camera" aria-hidden="true"></i> Tomar otra</button>
            <button type="button" className="btn btn-ghost" onClick={quitar}><i className="fa-solid fa-xmark" aria-hidden="true"></i> Quitar</button>
          </div>
        </div>
      ) : (
        <div className="campo-foto-botones" role="group" aria-labelledby={`${id}-etiqueta`}>
          <button type="button" className="btn btn-primary" onClick={() => camara.current.click()} disabled={procesando}>
            <i className="fa-solid fa-camera" aria-hidden="true"></i> Tomar foto
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => galeria.current.click()} disabled={procesando}>
            <i className="fa-solid fa-image" aria-hidden="true"></i> Elegir archivo
          </button>
        </div>
      )}
      {procesando && <p className="ayuda-campo" role="status">Preparando la foto…</p>}
      {error && <p className="alerta alerta-error" role="alert">{error}</p>}
    </div>
  )
}
