// Textos de los avisos de manejo de datos (v2.9, T2.4 del plan de historia clínica; D9 y D10).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const cargar = () => import(pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'avisos.js')).href);
const titulos = (aviso) => aviso.secciones.map(([t]) => t);

test('CP-UNI-031 [RF-32] Cada rol del personal acepta lo general y lo de su función; salud, además, la responsabilidad clínica', async () => {
  const { compromisoPara, ROLES_PERSONAL, VERSIONES_AVISO } = await cargar();
  assert.deepEqual(ROLES_PERSONAL, ['administrador', 'head_coach', 'entrenador', 'personal_salud']);
  for (const rol of ROLES_PERSONAL) {
    const c = compromisoPara(rol);
    assert.equal(c.aviso, 'compromiso_personal');
    assert.equal(c.version, VERSIONES_AVISO.compromiso_personal);
    assert.ok(titulos(c).includes('Protección de datos personales') && titulos(c).includes('Lineamientos del deporte y de la salud'), rol);
    assert.equal(titulos(c).at(-1), 'Cumplimiento', `${rol}: el cumplimiento va al final`);
    assert.match(c.casilla, /Leí este compromiso y lo acepto/);
  }
  assert.ok(titulos(compromisoPara('personal_salud')).includes('Historia clínica'));
  assert.ok(titulos(compromisoPara('personal_salud')).includes('Ejercicio profesional y supervisión'));
  assert.ok(!titulos(compromisoPara('entrenador')).includes('Historia clínica'));
  assert.ok(titulos(compromisoPara('administrador')).includes('Administración de cuentas'));
  // Las normas que se citan
  const todo = compromisoPara('personal_salud').secciones.map(([, x]) => x).join(' ');
  for (const norma of ['Ley 1581 de 2012', 'Resolución 1995 de 1999', 'Ley 181 de 1995', 'Ley 528 de 1999']) assert.ok(todo.includes(norma), norma);
});

test('CP-UNI-032 [RF-32] El aviso del deportista tiene versión para menores, y la huella del texto cambia si cambia el texto', async () => {
  const { avisoDeportista, declaracionRegistro, declaracionCarga, textoCanonico, partesAviso } = await cargar();
  const mayor = avisoDeportista();
  const menor = avisoDeportista({ menor: true });
  assert.notEqual(mayor.titulo, menor.titulo);
  assert.ok(titulos(mayor).includes('Tus derechos'));
  assert.match(menor.secciones[0][1], /Tu acudiente ya autorizó/);
  assert.match(declaracionRegistro().casilla, /informé al deportista, o a su acudiente/);
  assert.match(declaracionCarga().casilla, /cada persona de este archivo/);
  // La huella identifica el texto exacto y su versión
  const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
  const texto = textoCanonico(mayor);
  assert.match(texto, /Versión: borrador-2026-11$/);
  assert.equal(sha(texto), sha(textoCanonico(avisoDeportista())), 'mismo texto, misma huella');
  assert.notEqual(sha(texto), sha(textoCanonico({ ...mayor, version: 'v1-2026-12' })), 'otra versión, otra huella');
  // Lo que falta completar se distingue para resaltarlo
  const partes = partesAviso(mayor.secciones[0][1]);
  assert.ok(partes.some(p => p.completar && p.texto.startsWith('[Completar:')));
});
