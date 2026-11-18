-- v2.7 (T0.5): archivos clínicos protegidos (consentimientos escaneados, fotos de postura, exámenes).
-- Para bases existentes. Ejecutar después de 014_conservacion.sql. Se puede repetir sin problema.
-- Antes todo archivo subido quedaba en /uploads, una ruta pública que se abre sin iniciar sesión (DEF-054).
-- Los archivos clínicos se guardan en otra carpeta (CLINICO_DIR), con nombre aleatorio, y solo se descargan por
-- la API con sesión y permiso. Como el resto de la historia clínica, no se modifican ni se borran.
BEGIN;
CREATE TABLE IF NOT EXISTS archivos_clinicos (
  id              SERIAL PRIMARY KEY,
  jugador_id      INT NOT NULL REFERENCES jugadores(id) ON DELETE CASCADE,  -- protegido por trigger (T0.4)
  valoracion_id   INT REFERENCES valoraciones(id) ON DELETE RESTRICT,
  tipo            VARCHAR(20) NOT NULL DEFAULT 'otro',
  nombre_archivo  VARCHAR(80) NOT NULL UNIQUE,      -- aleatorio, en disco; nunca se envía al navegador
  nombre_original VARCHAR(200),
  mime            VARCHAR(40) NOT NULL,
  tamano          INT NOT NULL,
  sha256          CHAR(64) NOT NULL,
  descripcion     VARCHAR(200),
  subido_por      INT REFERENCES usuarios(id) ON DELETE RESTRICT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_archivos_tipo CHECK (tipo IN ('consentimiento','postura','examen','otro')),
  CONSTRAINT chk_archivos_mime CHECK (mime IN ('image/jpeg','image/png','application/pdf')),
  CONSTRAINT chk_archivos_tamano CHECK (tamano > 0 AND tamano <= 5242880)
);
CREATE INDEX IF NOT EXISTS idx_archivos_jugador ON archivos_clinicos(jugador_id, creado_en DESC);

CREATE OR REPLACE FUNCTION fn_proteger_archivo_clinico() RETURNS trigger AS $$
BEGIN
  IF current_setting('dt.mantenimiento', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Los archivos clínicos no se modifican ni se borran.'
    USING ERRCODE = 'check_violation', CONSTRAINT = 'archivo_clinico_inalterable';
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_archivo_clinico ON archivos_clinicos;
CREATE TRIGGER trg_archivo_clinico BEFORE UPDATE OR DELETE ON archivos_clinicos
  FOR EACH ROW EXECUTE FUNCTION fn_proteger_archivo_clinico();

-- La regla de la T0.4 incluye ahora los archivos clínicos: quien los tiene tampoco se puede eliminar
CREATE OR REPLACE FUNCTION fn_proteger_jugador_con_historia() RETURNS trigger AS $$
BEGIN
  IF current_setting('dt.mantenimiento', true) = 'on' THEN RETURN OLD; END IF;
  IF EXISTS (SELECT 1 FROM valoraciones WHERE jugador_id = OLD.id)
     OR EXISTS (SELECT 1 FROM historias_clinicas WHERE jugador_id = OLD.id)
     OR EXISTS (SELECT 1 FROM controles_medicos WHERE jugador_id = OLD.id)
     OR EXISTS (SELECT 1 FROM lesiones WHERE jugador_id = OLD.id)
     OR EXISTS (SELECT 1 FROM antropometria WHERE jugador_id = OLD.id)
     OR EXISTS (SELECT 1 FROM archivos_clinicos WHERE jugador_id = OLD.id) THEN
    RAISE EXCEPTION 'El deportista % tiene historia clínica: no se puede eliminar. Retíralo; sus registros se conservan.', OLD.id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'jugador_con_historia_clinica';
  END IF;
  RETURN OLD;
END $$ LANGUAGE plpgsql;
COMMIT;
