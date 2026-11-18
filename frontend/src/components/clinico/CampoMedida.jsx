// Campo de una medida clínica (v2.8, T1.1 del plan de historia clínica): número con su unidad siempre visible
// (kg, cm, lpm, mmHg, rpm, %), teclado numérico con decimales y coma o punto (en Colombia se escribe 36,5).
//  - `limites` [min, max]: fuera de ese rango el valor es imposible → error que impide guardar.
//  - `habitual` [min, max]: fuera de ese rango es raro pero posible → solo un aviso ("Revisa el valor"); no bloquea,
//    porque un deportista puede tener, por ejemplo, una frecuencia cardiaca en reposo de 42 lpm.
// El valor se entrega con punto decimal (texto); vacío si no se midió.

// "36,5" → 36.5 · "" → null · texto inválido → NaN
export function numeroDe(valor) {
  const t = String(valor ?? '').trim().replace(',', '.')
  if (!t) return null
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN
}

// Para validar al guardar: devuelve el mensaje de error o null
export function errorDeMedida(valor, { etiqueta = 'El valor', limites, unidad = '' } = {}) {
  const n = numeroDe(valor)
  if (n === null) return null
  if (Number.isNaN(n)) return `${etiqueta}: escribe solo números.`
  if (limites && (n < limites[0] || n > limites[1])) return `${etiqueta}: debe estar entre ${limites[0]} y ${limites[1]} ${unidad}.`.replace(' .', '.')
  return null
}

const formato = (n) => String(n).replace('.', ',')

export default function CampoMedida({ id, etiqueta, valor, onCambio, unidad, limites, habitual, decimales = 1, ayuda, obligatorio = false }) {
  const n = numeroDe(valor)
  const error = errorDeMedida(valor, { etiqueta: 'Este valor', limites, unidad })
  const aviso = !error && n !== null && habitual && (n < habitual[0] || n > habitual[1])
    ? `Revisa el valor: lo habitual es entre ${formato(habitual[0])} y ${formato(habitual[1])} ${unidad}.`
    : null
  const cambiar = (e) => {
    // Solo dígitos, una coma o punto y el signo; se guarda con punto
    let t = e.target.value.replace(/[^\d.,-]/g, '').replace(',', '.')
    const [entero, ...resto] = t.split('.')
    if (resto.length) t = decimales > 0 ? `${entero}.${resto.join('').slice(0, decimales)}` : entero
    onCambio(t)
  }
  const descripcion = [ayuda && `${id}-ayuda`, error && `${id}-error`, aviso && `${id}-aviso`].filter(Boolean).join(' ') || undefined

  return (
    <div className="form-group campo-medida">
      <label htmlFor={id}>{etiqueta}{obligatorio ? ' *' : ''}</label>
      <div className={`campo-medida-caja${error ? ' con-error' : aviso ? ' con-aviso' : ''}`}>
        <input id={id} type="text" inputMode="decimal" autoComplete="off" value={String(valor ?? '').replace('.', ',')}
          onChange={cambiar} aria-invalid={error ? 'true' : undefined} aria-describedby={descripcion} required={obligatorio} />
        {unidad && <span className="campo-medida-unidad" aria-hidden="true">{unidad}</span>}
      </div>
      {ayuda && <small id={`${id}-ayuda`} className="ayuda-campo">{ayuda}</small>}
      {error && <small id={`${id}-error`} className="campo-medida-error" role="alert">{error}</small>}
      {aviso && <small id={`${id}-aviso`} className="campo-medida-aviso">{aviso}</small>}
      {unidad && <span className="sr-only">Unidad: {unidad}</span>}
    </div>
  )
}
