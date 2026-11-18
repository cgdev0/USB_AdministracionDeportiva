// Tipo de pantalla para los formularios clínicos (v2.8, T1.1 del plan de historia clínica).
//   celular: hasta 719 px · tableta (vertical): 720 a 1023 px · amplio (tableta horizontal y computador): 1024 px o más
// Son los mismos cortes del diseño "Cancha" (index.css): desde 1024 px aparece el menú lateral.
import { useEffect, useState } from 'react'

export const CONSULTAS = {
  celular: '(max-width: 719px)',
  tableta: '(min-width: 720px) and (max-width: 1023px)',
}

function calcular() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'amplio'
  if (window.matchMedia(CONSULTAS.celular).matches) return 'celular'
  if (window.matchMedia(CONSULTAS.tableta).matches) return 'tableta'
  return 'amplio'
}

export default function usarModoPantalla() {
  const [modo, setModo] = useState(calcular)
  useEffect(() => {
    const listas = Object.values(CONSULTAS).map(c => window.matchMedia(c))
    const alCambiar = () => setModo(calcular())
    listas.forEach(l => l.addEventListener('change', alCambiar))
    return () => listas.forEach(l => l.removeEventListener('change', alCambiar))
  }, [])
  return modo
}

// Una consulta de medios cualquiera, que se actualiza al girar la pantalla o cambiar el tamaño de la ventana.
// Por ejemplo, la lista de pacientes muestra la tabla solo en computador: usarConsulta(COMPUTADOR).
export const COMPUTADOR = '(min-width: 1280px)'
export function usarConsulta(consulta) {
  const cumple = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(consulta).matches
  const [valor, setValor] = useState(cumple)
  useEffect(() => {
    const lista = window.matchMedia(consulta)
    const alCambiar = () => setValor(lista.matches)
    alCambiar()
    lista.addEventListener('change', alCambiar)
    return () => lista.removeEventListener('change', alCambiar)
  }, [consulta])
  return valor
}
