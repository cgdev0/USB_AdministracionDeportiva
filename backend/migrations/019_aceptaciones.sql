-- v2.9 (T2.4 del plan de historia clínica; D9 y D10): aceptaciones de los avisos de manejo de datos.
-- Para bases existentes. Ejecutar después de 018_consentimientos.sql. Se puede repetir sin problema.
--
-- Cada aceptación guarda qué texto se aceptó (aviso, versión y huella SHA-256 del texto exacto), quién y cómo:
--   cuenta    la persona en su propia cuenta (el personal, su compromiso; el deportista, su aviso de privacidad)
--   tableta   el deportista en el dispositivo del profesional, que queda como testigo
--   papel     con la autorización de datos personales firmada (consentimiento de la T2.1)
--   registro  quien registra a un deportista declara que lo informó y que autorizó
--   carga     quien carga un archivo con varias personas declara lo mismo para todas
-- No se modifican ni se borran (como la bitácora y la historia clínica).
BEGIN;

CREATE TABLE IF NOT EXISTS aceptaciones (
  id                SERIAL PRIMARY KEY,
  aviso             VARCHAR(30) NOT NULL,
  version           VARCHAR(40) NOT NULL,
  texto_sha256      CHAR(64) NOT NULL,
  via               VARCHAR(12) NOT NULL,
  usuario_id        INT REFERENCES usuarios(id) ON DELETE RESTRICT,     -- quien aceptó o declaró desde su cuenta
  usuario_nombre    VARCHAR(150),                                      -- copia, por si la cuenta cambia
  usuario_rol       VARCHAR(30),
  jugador_id        INT REFERENCES jugadores(id) ON DELETE RESTRICT,    -- el deportista de quien se trata
  aceptante_nombre  VARCHAR(150),                                      -- quien aceptó en la tableta (o su acudiente)
  testigo_id        INT REFERENCES usuarios(id) ON DELETE RESTRICT,    -- el profesional presente
  consentimiento_id INT REFERENCES consentimientos(id) ON DELETE RESTRICT,
  carga_id          INT,                                               -- la carga masiva (tabla de la T2.6)
  ip                VARCHAR(64),
  aceptado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_aceptaciones_aviso CHECK (aviso IN ('compromiso_personal','aviso_deportista','declaracion_registro','declaracion_carga')),
  CONSTRAINT chk_aceptaciones_via CHECK (via IN ('cuenta','tableta','papel','registro','carga')),
  CONSTRAINT chk_aceptaciones_sha CHECK (texto_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_aceptaciones_datos CHECK (
       (via = 'cuenta'   AND usuario_id IS NOT NULL)
    OR (via = 'tableta'  AND jugador_id IS NOT NULL AND testigo_id IS NOT NULL AND length(btrim(aceptante_nombre)) > 0)
    OR (via = 'papel'    AND jugador_id IS NOT NULL AND consentimiento_id IS NOT NULL)
    OR (via = 'registro' AND usuario_id IS NOT NULL AND jugador_id IS NOT NULL)
    OR (via = 'carga'    AND usuario_id IS NOT NULL AND carga_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_aceptaciones_usuario ON aceptaciones(usuario_id, aviso, version);
CREATE INDEX IF NOT EXISTS idx_aceptaciones_jugador ON aceptaciones(jugador_id, aviso, version);
CREATE INDEX IF NOT EXISTS idx_aceptaciones_fecha ON aceptaciones(aceptado_en DESC);

CREATE OR REPLACE FUNCTION fn_proteger_aceptacion() RETURNS trigger AS $$
BEGIN
  IF current_setting('dt.mantenimiento', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Las aceptaciones no se modifican ni se borran.'
    USING ERRCODE = 'check_violation', CONSTRAINT = 'aceptacion_inalterable';
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_aceptacion ON aceptaciones;
CREATE TRIGGER trg_aceptacion BEFORE UPDATE OR DELETE ON aceptaciones
  FOR EACH ROW EXECUTE FUNCTION fn_proteger_aceptacion();

COMMIT;
