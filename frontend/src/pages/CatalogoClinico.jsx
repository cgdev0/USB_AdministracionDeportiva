// Catálogo de los componentes clínicos (v2.8, T1.1 del plan de historia clínica).
// Solo existe en la compilación de pruebas (VITE_CATALOGO=1, ver playwright.config.js): las pruebas de interfaz lo usan
// para revisar los componentes en celular, tableta y computador antes de usarlos en las pantallas clínicas.
// En Railway no se compila (la ruta y su código no llegan al navegador).
import { useState } from 'react'
import { FormularioPorSecciones, CampoMedida, OpcionesBoton, SelectorLado, CampoFoto, EstadoGuardado, SeccionOpcional } from '../components/clinico'

const NORMAL_ALTERADO = [['normal', 'Normal', { tono: 'ok' }], ['alterado', 'Alterado', { tono: 'aviso' }]]
const RESULTADO = [['positivo', 'Positivo', { tono: 'alerta' }], ['negativo', 'Negativo', { tono: 'ok' }], ['no_concluyente', 'No concluyente']]
const ESTADOS = [['guardado', 'Guardado'], ['guardando', 'Guardando'], ['sin_conexion', 'Sin conexión'], ['error', 'Error']]

export default function CatalogoClinico() {
  const [actual, setActual] = useState('vitales')
  const [medidas, setMedidas] = useState({ fc: '', pas: '', peso: '' })
  const [hombros, setHombros] = useState('')
  const [lado, setLado] = useState('')
  const [lachman, setLachman] = useState('')
  const [noEvaluado, setNoEvaluado] = useState(false)
  const [archivo, setArchivo] = useState(null)
  const [estado, setEstado] = useState('guardado')
  const [guardadoEn] = useState(() => new Date())
  const medida = (campo) => (valor) => setMedidas(m => ({ ...m, [campo]: valor }))

  const secciones = [
    {
      id: 'vitales', titulo: 'Signos vitales', estado: medidas.fc ? 'completa' : 'pendiente',
      contenido: (
        <div className="form-grid">
          <CampoMedida id="cat-fc" etiqueta="Frecuencia cardiaca" unidad="lpm" decimales={0} valor={medidas.fc} onCambio={medida('fc')} limites={[20, 250]} habitual={[40, 100]} />
          <CampoMedida id="cat-pas" etiqueta="Presión sistólica" unidad="mmHg" decimales={0} valor={medidas.pas} onCambio={medida('pas')} limites={[50, 260]} habitual={[90, 140]} />
          <CampoMedida id="cat-peso" etiqueta="Peso" unidad="kg" valor={medidas.peso} onCambio={medida('peso')} limites={[20, 250]} habitual={[40, 130]} ayuda="Con un decimal, por ejemplo 72,5." />
        </div>
      ),
    },
    {
      id: 'postura', titulo: 'Observación postural', estado: hombros ? 'completa' : 'pendiente',
      contenido: (
        <>
          <OpcionesBoton id="cat-hombros" etiqueta="Hombros (vista anterior)" opciones={NORMAL_ALTERADO} valor={hombros} onCambio={setHombros} />
          {hombros === 'alterado' && <SelectorLado id="cat-lado" etiqueta="Hombro elevado" valor={lado} onCambio={setLado} conBilateral={false} />}
        </>
      ),
    },
    {
      id: 'semiologicas', titulo: 'Pruebas semiológicas', estado: noEvaluado ? 'no_evaluado' : lachman ? 'completa' : 'pendiente',
      contenido: (
        <SeccionOpcional id="cat-rodilla" titulo="Rodilla" noEvaluado={noEvaluado} onNoEvaluado={setNoEvaluado} ayuda="Registra solo las pruebas que hiciste.">
          <OpcionesBoton id="cat-lachman" etiqueta="Lachman" opciones={RESULTADO} valor={lachman} onCambio={setLachman} />
        </SeccionOpcional>
      ),
    },
    {
      id: 'fotos', titulo: 'Fotos y documentos', estado: archivo ? 'completa' : 'pendiente',
      contenido: <CampoFoto id="cat-foto" etiqueta="Foto de la vista anterior" aceptaPdf onCambio={setArchivo} ayuda="La foto se reduce a 1600 px antes de subirla." />,
    },
  ]

  return (
    <main className="main-content catalogo-clinico">
      <div className="page-header">
        <h1>Componentes clínicos</h1>
        <p>Catálogo para las pruebas de interfaz (no se publica).</p>
      </div>
      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <OpcionesBoton id="cat-estado" etiqueta="Estado del guardado (demostración)" opciones={ESTADOS} valor={estado}
          onCambio={v => setEstado(v || 'guardado')} permitirVacio={false} />
        <EstadoGuardado estado={estado} guardadoEn={guardadoEn} />
      </div>
      <div className="card" style={{ padding: 18 }}>
        <FormularioPorSecciones id="cat" secciones={secciones} actual={actual} onCambiar={setActual}
          acciones={<button type="button" className="btn btn-primary"><i className="fa-solid fa-floppy-disk" aria-hidden="true"></i> Guardar borrador</button>} />
      </div>
    </main>
  )
}
