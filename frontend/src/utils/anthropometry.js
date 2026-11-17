/**
 * Cálculos antropométricos y de composición corporal (protocolo ISAK).
 *
 * Fuente única: este archivo lo usan la pantalla de Antropometría (cálculo en vivo) y el backend
 * (backend/controllers/antropometria.controller.js), así ambos dan siempre el mismo resultado.
 *
 * Unidades: peso en kg · estatura en m (o cm) · pliegues en mm · perímetros y diámetros en cm.
 *
 * Regla general (v2.5): si falta una medición que exige la fórmula, el resultado queda vacío (null).
 * Antes se completaban con valores por defecto (diámetros de 6,8 y 9,5 cm, masa ósea = 14,5 % del peso,
 * brazo relajado en lugar de contraído) y se mostraban resultados que no salían de una medición real.
 *
 * Referencias:
 *  - % grasa: Yuhasz modificada por Carter (1982), 6 pliegues · Faulkner (1968), 4 pliegues ·
 *    Durnin y Womersley (1974), 4 pliegues con coeficientes por sexo y edad + ecuación de Siri (1961).
 *  - Masa ósea: Von Döbeln modificada por Rocha (1975), con diámetros biestiloideo (muñeca) y bicondíleo del fémur.
 *  - Masa residual: Würch (1974), 24,1 % del peso en hombres y 20,9 % en mujeres.
 *  - Masa muscular: por diferencia (modelo de 4 componentes de De Rose y Guimarães).
 *  - Somatotipo: Heath y Carter (1967; Carter y Heath, 1990).
 */

const positivo = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}
const redondear = (v, decimales = 2) => (v === null ? null : Number(v.toFixed(decimales)))
const esMujer = (genero) => ['femenino', 'f', 'F'].includes(genero)

// Durnin y Womersley (1974): densidad = c − m · log10(Σ bíceps + tríceps + subescapular + cresta ilíaca)
// Coeficientes por sexo y grupo de edad. Sin edad conocida se usa la ecuación general (17–72 años / 16–68 años).
const DURNIN_WOMERSLEY = {
  masculino: { general: [1.1765, 0.0744], grupos: [[19, 1.1620, 0.0630], [29, 1.1631, 0.0632], [39, 1.1422, 0.0544], [49, 1.1620, 0.0700], [Infinity, 1.1715, 0.0779]] },
  femenino:  { general: [1.1567, 0.0717], grupos: [[19, 1.1549, 0.0678], [29, 1.1599, 0.0717], [39, 1.1423, 0.0632], [49, 1.1333, 0.0612], [Infinity, 1.1339, 0.0645]] },
}

function coeficientesDurnin(mujer, edad) {
  const tabla = DURNIN_WOMERSLEY[mujer ? 'femenino' : 'masculino']
  const anios = positivo(edad)
  if (!anios) return tabla.general
  const [, c, m] = tabla.grupos.find(([hasta]) => anios <= hasta)
  return [c, m]
}

// % de grasa: se usa la primera ecuación cuyos pliegues estén todos medidos.
function porcentajeGrasa(p, mujer, edad) {
  const { tri, sub, supraesp, abd, muslo, pierna, biceps, iliaco } = p

  // Yuhasz modificada por Carter: tríceps, subescapular, supraespinal, abdominal, muslo anterior y pierna medial
  if (tri && sub && supraesp && abd && muslo && pierna) {
    const suma6 = tri + sub + supraesp + abd + muslo + pierna
    return { valor: mujer ? 0.1548 * suma6 + 3.580 : 0.1051 * suma6 + 2.585, ecuacion: 'Yuhasz-Carter (6 pliegues)' }
  }
  // Faulkner: tríceps, subescapular, suprailíaco (se acepta el supraespinal ISAK) y abdominal
  const supra = iliaco || supraesp
  if (tri && sub && supra && abd) {
    return { valor: 5.783 + 0.153 * (tri + sub + supra + abd), ecuacion: 'Faulkner (4 pliegues)' }
  }
  // Durnin y Womersley + Siri: bíceps, tríceps, subescapular y cresta ilíaca
  if (biceps && tri && sub && iliaco) {
    const [c, m] = coeficientesDurnin(mujer, edad)
    const densidad = c - m * Math.log10(biceps + tri + sub + iliaco)
    return { valor: (4.95 / densidad - 4.5) * 100, ecuacion: 'Durnin-Womersley + Siri (4 pliegues)' }
  }
  return { valor: null, ecuacion: null }
}

// Masa ósea de Rocha: 3,02 · (estatura² · diámetro biestiloideo · diámetro del fémur · 400)^0,712 (todo en metros)
export function masaOseaRocha(estaturaM, diametroMunecaCm, diametroFemurCm) {
  const h = positivo(estaturaM), r = positivo(diametroMunecaCm), f = positivo(diametroFemurCm)
  if (!h || !r || !f) return null
  return redondear(3.02 * Math.pow(h * h * (r / 100) * (f / 100) * 400, 0.712))
}

// Masa muscular por diferencia: peso − (grasa + ósea + residual). Null si falta un componente o el resultado no es válido.
export function masaMuscularPorDiferencia(peso, porcentajeGrasaValor, masaOsea, genero) {
  const kg = positivo(peso), grasa = positivo(porcentajeGrasaValor), osea = positivo(masaOsea)
  if (!kg || !grasa || !osea) return null
  const residual = kg * (esMujer(genero) ? 0.209 : 0.241)
  const musculo = kg - (kg * grasa / 100 + osea + residual)
  return musculo > 0 ? redondear(musculo) : null
}

export function calculateAnthropometry(data = {}, genero = 'masculino', edad = null) {
  const mujer = esMujer(genero)
  const peso = positivo(data.peso)
  const estatura = positivo(data.estatura)
  const estaturaCm = estatura > 3 ? estatura : estatura * 100 // se acepta en metros o en centímetros
  const estaturaM = estaturaCm / 100

  const p = {
    biceps: positivo(data.pliegue_biceps),
    tri: positivo(data.pliegue_triceps),
    sub: positivo(data.pliegue_subescapular),
    iliaco: positivo(data.pliegue_suprailiaco),
    supraesp: positivo(data.pliegue_supraespinal),
    abd: positivo(data.pliegue_abdominal),
    muslo: positivo(data.pliegue_muslo_anterior),
    pierna: positivo(data.pliegue_pierna_medial),
  }
  const brazoContraido = positivo(data.perimetro_brazo_contraido)
  const perimetroPierna = positivo(data.perimetro_pierna)
  const diamHumero = positivo(data.diametro_humero)
  const diamMuneca = positivo(data.diametro_muneca)
  const diamFemur = positivo(data.diametro_femur)

  // 1. IMC
  const imc = peso && estaturaM ? redondear(peso / (estaturaM * estaturaM)) : null

  // 2. % de grasa (acotado a un rango fisiológico)
  const grasa = porcentajeGrasa(p, mujer, edad)
  const porcentaje_grasa = grasa.valor === null ? null : redondear(Math.max(3, Math.min(55, grasa.valor)), 1)

  // 3. Fraccionamiento en 4 componentes
  const masa_grasa_kg = peso && porcentaje_grasa !== null ? redondear(peso * porcentaje_grasa / 100) : null
  const masa_mineral_osea = masaOseaRocha(estaturaM, diamMuneca, diamFemur)
  const masa_residual_kg = peso ? redondear(peso * (mujer ? 0.209 : 0.241)) : null
  const masa_muscular_esqueletica = masaMuscularPorDiferencia(peso, porcentaje_grasa, masa_mineral_osea, genero)
  const porcentaje_musculo = masa_muscular_esqueletica !== null ? redondear(masa_muscular_esqueletica / peso * 100, 1) : null

  // 4. Somatotipo Heath-Carter. Un componente con valor ≤ 0 se registra como 0,1 (regla del método).
  const componente = (v) => redondear(Math.max(0.1, v))
  let endomorfia = null, mesomorfia = null, ectomorfia = null

  // Endomorfia: tríceps + subescapular + supraespinal, corregidos por estatura
  if (estaturaCm && p.tri && p.sub && p.supraesp) {
    const x = (p.tri + p.sub + p.supraesp) * (170.18 / estaturaCm)
    endomorfia = componente(-0.7182 + 0.1451 * x - 0.00068 * x ** 2 + 0.0000014 * x ** 3)
  }
  // Mesomorfia: diámetros de húmero y fémur, brazo flexionado y contraído y pierna, corregidos por su pliegue
  if (estaturaCm && diamHumero && diamFemur && brazoContraido && perimetroPierna && p.tri && p.pierna) {
    const brazoCorregido = brazoContraido - p.tri / 10
    const piernaCorregida = perimetroPierna - p.pierna / 10
    mesomorfia = componente(0.858 * diamHumero + 0.601 * diamFemur + 0.188 * brazoCorregido + 0.161 * piernaCorregida - 0.131 * estaturaCm + 4.5)
  }
  // Ectomorfia: índice ponderal (estatura / ∛peso)
  if (estaturaCm && peso) {
    const ip = estaturaCm / Math.cbrt(peso)
    ectomorfia = componente(ip >= 40.75 ? 0.732 * ip - 28.58 : ip > 38.25 ? 0.463 * ip - 17.63 : 0.1)
  }

  const somatotipoCompleto = endomorfia !== null && mesomorfia !== null && ectomorfia !== null
  const x_somatocarta = somatotipoCompleto ? redondear(ectomorfia - endomorfia) : null
  const y_somatocarta = somatotipoCompleto ? redondear(2 * mesomorfia - (endomorfia + ectomorfia)) : null

  const sumaPliegues = Object.values(p).reduce((a, b) => a + b, 0)

  return {
    imc,
    porcentaje_grasa,
    ecuacion_grasa: grasa.ecuacion,
    masa_grasa_kg,
    masa_mineral_osea,
    masa_residual_kg,
    masa_muscular_esqueletica,
    porcentaje_musculo,
    endomorfia,
    mesomorfia,
    ectomorfia,
    x_somatocarta,
    y_somatocarta,
    sumatoria_pliegues: sumaPliegues ? redondear(sumaPliegues, 1) : null,
  }
}
