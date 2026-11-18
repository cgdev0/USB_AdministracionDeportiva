// Guardado automático de un borrador clínico (v2.8, T1.2 del plan de historia clínica).
// Para que no se pierda lo escrito si se cae la señal, el celular se bloquea o alguien cierra la pantalla:
//  - Guarda cada 20 segundos si hay cambios, al ocultarse la página (cambiar de app, bloquear el celular) y cuando
//    quien la usa lo pide (Guardar borrador, cambiar de sección, cerrar la ventana).
//  - Sin conexión: los cambios esperan EN MEMORIA (nunca en el almacenamiento del navegador, decisión D8 del plan:
//    los dispositivos pueden ser compartidos) y se reintentan cada 5 segundos y en cuanto vuelve la señal.
//  - Si el borrador cambió en otro dispositivo, el servidor responde 409 (número de versión): se detiene el guardado
//    automático y se avisa, para que la persona elija qué versión conservar. Nunca se pisa en silencio.
//  - Antes de salir de la página con cambios sin guardar, el navegador pide confirmación.
// `guardar(datos)` hace la petición; sus errores traen `status` (sin `status` = sin conexión).
import { useCallback, useEffect, useRef, useState } from 'react'

export default function usarGuardadoAutomatico({ datos, guardar, intervaloMs = 20_000, reintentoMs = 5_000 }) {
  const texto = JSON.stringify(datos)
  const textoRef = useRef(texto)
  textoRef.current = texto
  const guardarRef = useRef(guardar)
  guardarRef.current = guardar
  const base = useRef(texto)            // lo último que quedó guardado en el servidor
  const enCurso = useRef(null)
  const conflictoRef = useRef(null)
  const [estado, setEstado] = useState(null) // null | 'sin_guardar' | 'guardando' | 'guardado' | 'sin_conexion' | 'error'
  const [guardadoEn, setGuardadoEn] = useState(null)
  const [conflicto, setConflicto] = useState(null)
  const [error, setError] = useState(null)
  const sucio = texto !== base.current

  // Devuelve { ok, error?, sinConexion? }. `forzar`: guarda aunque no haya cambios (por ejemplo, el primer borrador).
  const guardarAhora = useCallback(async ({ forzar = false } = {}) => {
    if (enCurso.current) {
      await enCurso.current
      if (!forzar && textoRef.current === base.current) return { ok: true }
    }
    const actual = textoRef.current
    if (!forzar && actual === base.current) return { ok: true }
    if (conflictoRef.current && !forzar) return { ok: false, error: conflictoRef.current }
    setEstado('guardando')
    enCurso.current = (async () => {
      try {
        await guardarRef.current(JSON.parse(actual))
        base.current = actual
        setGuardadoEn(new Date())
        setError(null)
        setEstado(textoRef.current === actual ? 'guardado' : 'sin_guardar')
        return { ok: true }
      } catch (e) {
        if (!e.status) {
          setEstado('sin_conexion')
          return { ok: false, error: 'No hay conexión.', sinConexion: true }
        }
        if (e.status === 409) { conflictoRef.current = e.message; setConflicto(e.message) }
        setError(e.message)
        setEstado('error')
        return { ok: false, error: e.message }
      } finally {
        enCurso.current = null
      }
    })()
    return enCurso.current
  }, [])

  // Escribir marca "cambios sin guardar" (salvo mientras se espera la señal o hay un conflicto)
  useEffect(() => {
    if (texto !== base.current && !conflictoRef.current) {
      setEstado(e => (e === 'sin_conexion' || e === 'guardando' ? e : 'sin_guardar'))
    }
  }, [texto])

  // Cada 20 segundos, si hay cambios
  useEffect(() => {
    const t = setInterval(() => {
      if (textoRef.current !== base.current && !conflictoRef.current && !enCurso.current) guardarAhora()
    }, intervaloMs)
    return () => clearInterval(t)
  }, [guardarAhora, intervaloMs])

  // Sin conexión: reintenta cada 5 segundos y en cuanto vuelve la señal
  useEffect(() => {
    if (estado !== 'sin_conexion') return undefined
    const t = setInterval(() => { if (!enCurso.current) guardarAhora() }, reintentoMs)
    const alVolver = () => guardarAhora()
    window.addEventListener('online', alVolver)
    return () => { clearInterval(t); window.removeEventListener('online', alVolver) }
  }, [estado, guardarAhora, reintentoMs])

  // Al ocultarse la página (cambiar de aplicación, bloquear el celular) se guarda de una vez
  useEffect(() => {
    const alOcultar = () => { if (document.visibilityState === 'hidden') guardarAhora() }
    document.addEventListener('visibilitychange', alOcultar)
    return () => document.removeEventListener('visibilitychange', alOcultar)
  }, [guardarAhora])

  // Antes de salir de la página con cambios sin guardar, el navegador pide confirmación
  useEffect(() => {
    const alSalir = (e) => {
      if (textoRef.current !== base.current) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', alSalir)
    return () => window.removeEventListener('beforeunload', alSalir)
  }, [])

  // Tras elegir la versión del servidor: esos datos pasan a ser lo guardado
  const restablecer = useCallback((nuevos) => {
    base.current = JSON.stringify(nuevos)
    conflictoRef.current = null
    setConflicto(null)
    setError(null)
    setGuardadoEn(new Date())
    setEstado('guardado')
  }, [])
  const resolverConflicto = useCallback(() => { conflictoRef.current = null; setConflicto(null) }, [])

  return { estado, guardadoEn, conflicto, error, sucio, guardarAhora, restablecer, resolverConflicto }
}
