// Documento, contacto, emergencia y acudiente del deportista (v2.7, T0.1 del plan de historia clínica).
// Se usa al crear o editar un deportista (Deportistas), al crear su cuenta (Usuarios) y, con los datos sensibles,
// en la ficha para el personal de salud.
// Pensado para celular y tableta: secciones plegables para que el formulario no sea eterno, teclado numérico o de
// teléfono según el campo, zona urbana o rural con botones grandes, y el acudiente solo cuando es menor de edad.
import { useState } from 'react'
import {
  TIPOS_DOCUMENTO, ZONAS, PAISES, PERTENENCIAS_ETNICAS, DISCAPACIDADES, PARENTESCOS, tipoDocumento,
} from '../utils/identificacion'

// Sugerencias (se puede escribir cualquier otra)
const EPS_FRECUENTES = ['Nueva EPS', 'Sanitas', 'Sura', 'Salud Total', 'Coosalud', 'Famisanar', 'Compensar',
  'Mutual Ser', 'Asmet Salud', 'Aliansalud', 'Régimen especial o de excepción', 'Sin afiliación']

const algunoLleno = (valores, campos) => campos.some(c => String(valores[c] ?? '').trim() !== '')

export default function CamposIdentificacion({ valores, onCambio, menor = false, sensibles = false, esencial = false, id = 'ident' }) {
  const v = (campo) => valores[campo] ?? ''
  const cambiar = (campo) => (e) => onCambio(campo, e.target.value)
  const numerico = tipoDocumento(v('tipo_documento'))?.numerico
  const numericoAcudiente = tipoDocumento(v('acudiente_tipo_documento'))?.numerico
  const mostrarAcudiente = menor || algunoLleno(valores, ['acudiente_nombre', 'acudiente_telefono', 'acudiente_numero_documento'])

  // Las secciones con datos empiezan abiertas. Se calcula una sola vez para que no se cierren mientras se escribe.
  const [abiertas] = useState(() => ({
    contacto: algunoLleno(valores, ['telefono', 'eps', 'municipio_residencia', 'zona_residencia', 'nacionalidad']),
    emergencia: algunoLleno(valores, ['contacto_emergencia_nombre', 'contacto_emergencia_telefono']),
    sensibles: algunoLleno(valores, ['pertenencia_etnica', 'discapacidad']),
  }))

  return (
    <div className="campos-identificacion">
      <datalist id={`${id}-parentescos`}>{PARENTESCOS.map(p => <option key={p} value={p} />)}</datalist>

      <fieldset className="ident-grupo">
        <legend><i className="fa-solid fa-id-card" aria-hidden="true"></i> Documento de identidad</legend>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor={`${id}-tipo`}>Tipo de documento</label>
            <select id={`${id}-tipo`} value={v('tipo_documento')} onChange={cambiar('tipo_documento')}>
              <option value="">Sin registrar</option>
              {TIPOS_DOCUMENTO.map(t => <option key={t.codigo} value={t.codigo}>{t.codigo} · {t.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor={`${id}-numero`}>Número de documento</label>
            <input id={`${id}-numero`} value={v('numero_documento')} onChange={cambiar('numero_documento')}
              inputMode={numerico === false ? 'text' : 'numeric'} autoComplete="off" maxLength={20}
              placeholder={numerico === false ? 'Letras y números' : 'Solo números'} />
            <small className="ayuda-campo">Identifica la historia clínica. No se puede repetir.</small>
          </div>
        </div>
      </fieldset>

      {mostrarAcudiente && (
        <fieldset className={`ident-grupo${menor ? ' obligatorio' : ''}`}>
          <legend>
            <i className="fa-solid fa-user-shield" aria-hidden="true"></i> Acudiente
            {menor && <small>Menor de edad: nombre y teléfono obligatorios</small>}
          </legend>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor={`${id}-acu-nombre`}>Nombre del acudiente{menor ? ' *' : ''}</label>
              <input id={`${id}-acu-nombre`} value={v('acudiente_nombre')} onChange={cambiar('acudiente_nombre')}
                autoComplete="off" maxLength={100} required={menor} />
            </div>
            <div className="form-group">
              <label htmlFor={`${id}-acu-tel`}>Teléfono del acudiente{menor ? ' *' : ''}</label>
              <input id={`${id}-acu-tel`} type="tel" inputMode="tel" value={v('acudiente_telefono')} onChange={cambiar('acudiente_telefono')}
                autoComplete="off" maxLength={20} required={menor} placeholder="3001234567" />
            </div>
            <div className="form-group">
              <label htmlFor={`${id}-acu-par`}>Parentesco</label>
              <input id={`${id}-acu-par`} list={`${id}-parentescos`} value={v('acudiente_parentesco')} onChange={cambiar('acudiente_parentesco')}
                autoComplete="off" maxLength={40} placeholder="Madre, padre…" />
            </div>
            <div className="form-group">
              <label htmlFor={`${id}-acu-tipo`}>Documento del acudiente</label>
              <select id={`${id}-acu-tipo`} value={v('acudiente_tipo_documento')} onChange={cambiar('acudiente_tipo_documento')}>
                <option value="">Sin registrar</option>
                {TIPOS_DOCUMENTO.map(t => <option key={t.codigo} value={t.codigo}>{t.codigo} · {t.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor={`${id}-acu-num`}>Número del documento del acudiente</label>
              <input id={`${id}-acu-num`} value={v('acudiente_numero_documento')} onChange={cambiar('acudiente_numero_documento')}
                inputMode={numericoAcudiente === false ? 'text' : 'numeric'} autoComplete="off" maxLength={20} />
            </div>
          </div>
        </fieldset>
      )}

      {!esencial && (
        <details className="ident-grupo" open={abiertas.contacto}>
          <summary><i className="fa-solid fa-address-book" aria-hidden="true"></i> Contacto y residencia <small>Opcional</small></summary>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor={`${id}-tel`}>Teléfono celular</label>
              <input id={`${id}-tel`} type="tel" inputMode="tel" value={v('telefono')} onChange={cambiar('telefono')}
                autoComplete="off" maxLength={20} placeholder="3001234567" />
            </div>
            <div className="form-group">
              <label htmlFor={`${id}-eps`}>EPS</label>
              <input id={`${id}-eps`} list={`${id}-eps-lista`} value={v('eps')} onChange={cambiar('eps')} autoComplete="off" maxLength={100} />
              <datalist id={`${id}-eps-lista`}>{EPS_FRECUENTES.map(e => <option key={e} value={e} />)}</datalist>
            </div>
            <div className="form-group">
              <label htmlFor={`${id}-mun`}>Municipio de residencia</label>
              <input id={`${id}-mun`} value={v('municipio_residencia')} onChange={cambiar('municipio_residencia')}
                autoComplete="off" maxLength={100} placeholder="Cúcuta" />
            </div>
            <div className="form-group">
              <label htmlFor={`${id}-nac`}>Nacionalidad</label>
              <select id={`${id}-nac`} value={v('nacionalidad')} onChange={cambiar('nacionalidad')}>
                <option value="">Sin registrar</option>
                {PAISES.map(([codigo, nombre]) => <option key={codigo} value={codigo}>{nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <span className="etiqueta-campo" id={`${id}-zona`}>Zona de residencia</span>
              <div className="segmentado" role="group" aria-labelledby={`${id}-zona`}>
                {ZONAS.map(([valor, etiqueta]) => (
                  <button key={valor} type="button" aria-pressed={v('zona_residencia') === valor}
                    onClick={() => onCambio('zona_residencia', v('zona_residencia') === valor ? '' : valor)}>{etiqueta}</button>
                ))}
              </div>
            </div>
          </div>
        </details>
      )}

      {!esencial && (
        <details className="ident-grupo" open={abiertas.emergencia}>
          <summary><i className="fa-solid fa-phone-volume" aria-hidden="true"></i> Contacto de emergencia <small>Opcional</small></summary>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor={`${id}-eme-nombre`}>Nombre</label>
              <input id={`${id}-eme-nombre`} value={v('contacto_emergencia_nombre')} onChange={cambiar('contacto_emergencia_nombre')}
                autoComplete="off" maxLength={100} />
            </div>
            <div className="form-group">
              <label htmlFor={`${id}-eme-par`}>Parentesco</label>
              <input id={`${id}-eme-par`} list={`${id}-parentescos`} value={v('contacto_emergencia_parentesco')}
                onChange={cambiar('contacto_emergencia_parentesco')} autoComplete="off" maxLength={40} />
            </div>
            <div className="form-group">
              <label htmlFor={`${id}-eme-tel`}>Teléfono</label>
              <input id={`${id}-eme-tel`} type="tel" inputMode="tel" value={v('contacto_emergencia_telefono')}
                onChange={cambiar('contacto_emergencia_telefono')} autoComplete="off" maxLength={20} placeholder="3001234567" />
            </div>
          </div>
        </details>
      )}

      {sensibles && (
        <details className="ident-grupo sensibles" open={abiertas.sensibles}>
          <summary><i className="fa-solid fa-lock" aria-hidden="true"></i> Datos sensibles <small>Solo personal de salud</small></summary>
          <p className="ayuda-campo">Ley 1581 de 2012: solo los ven el personal de salud y el propio deportista. Se usan en la historia clínica.</p>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor={`${id}-etnia`}>Pertenencia étnica</label>
              <select id={`${id}-etnia`} value={v('pertenencia_etnica')} onChange={cambiar('pertenencia_etnica')}>
                <option value="">Sin registrar</option>
                {PERTENENCIAS_ETNICAS.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor={`${id}-disc`}>Discapacidad</label>
              <select id={`${id}-disc`} value={v('discapacidad')} onChange={cambiar('discapacidad')}>
                <option value="">Sin registrar</option>
                {DISCAPACIDADES.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
              </select>
            </div>
          </div>
        </details>
      )}
    </div>
  )
}
