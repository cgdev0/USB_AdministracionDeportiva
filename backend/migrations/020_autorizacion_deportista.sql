-- v2.9 (T2.6 del plan de historia clínica; D10 y D11): autorización de cada deportista y registro de las cargas masivas.
-- Para bases existentes. Ejecutar después de 019_aceptaciones.sql. Se puede repetir sin problema.
--
--  - Cada carga masiva (CSV de deportistas o de usuarios) queda registrada: quién, qué archivo (nombre y huella
--    SHA-256), cuántas filas se crearon, se actualizaron o se rechazaron, y con qué declaración. No se modifica ni se
--    borra. Las declaraciones de la carga (tabla aceptaciones, via = 'carga') apuntan a ella.
--  - Los deportistas registrados antes de esta versión son de demostración (D11): quedan marcados con
--    autorizacion_previa y no se les exige autorización. Los que se registren desde ahora empiezan sin la marca.
BEGIN;

CREATE TABLE IF NOT EXISTS cargas_masivas (
  id                   SERIAL PRIMARY KEY,
  tipo                 VARCHAR(12) NOT NULL,
  usuario_id           INT REFERENCES usuarios(id) ON DELETE RESTRICT,
  usuario_nombre       VARCHAR(150),
  usuario_rol          VARCHAR(30),
  archivo_nombre       VARCHAR(200),
  archivo_sha256       CHAR(64),
  filas_total          INT NOT NULL DEFAULT 0,
  creadas              INT NOT NULL DEFAULT 0,
  actualizadas         INT NOT NULL DEFAULT 0,
  rechazadas           INT NOT NULL DEFAULT 0,
  detalle              JSONB NOT NULL DEFAULT '{}'::jsonb,       -- ids creados y errores por fila (sin datos de salud)
  declaracion_version  VARCHAR(40) NOT NULL,
  ip                   VARCHAR(64),
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_cargas_tipo CHECK (tipo IN ('deportistas','usuarios')),
  CONSTRAINT chk_cargas_sha CHECK (archivo_sha256 IS NULL OR archivo_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_cargas_conteos CHECK (filas_total >= 0 AND creadas >= 0 AND actualizadas >= 0 AND rechazadas >= 0)
);
CREATE INDEX IF NOT EXISTS idx_cargas_fecha ON cargas_masivas(creado_en DESC);

CREATE OR REPLACE FUNCTION fn_proteger_carga_masiva() RETURNS trigger AS $$
BEGIN
  IF current_setting('dt.mantenimiento', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'El registro de las cargas masivas no se modifica ni se borra.'
    USING ERRCODE = 'check_violation', CONSTRAINT = 'carga_masiva_inalterable';
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_carga_masiva ON cargas_masivas;
CREATE TRIGGER trg_carga_masiva BEFORE UPDATE OR DELETE ON cargas_masivas
  FOR EACH ROW EXECUTE FUNCTION fn_proteger_carga_masiva();

-- Las declaraciones de una carga apuntan a ella
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_aceptaciones_carga') THEN
    ALTER TABLE aceptaciones ADD CONSTRAINT fk_aceptaciones_carga FOREIGN KEY (carga_id) REFERENCES cargas_masivas(id) ON DELETE RESTRICT;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_aceptaciones_carga ON aceptaciones(carga_id);

-- Los deportistas que ya existen quedan como registrados antes de las autorizaciones; los nuevos, no
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jugadores' AND column_name = 'autorizacion_previa') THEN
    ALTER TABLE jugadores ADD COLUMN autorizacion_previa BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE jugadores ALTER COLUMN autorizacion_previa SET DEFAULT FALSE;
  END IF;
END $$;

-- Eliminar a un deportista sin historia clínica (por ejemplo, registrado por error) se lleva sus aceptaciones; nadie
-- más las puede borrar. Quien tiene historia clínica sigue sin poder eliminarse (T0.4).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aceptaciones_jugador_id_fkey' AND confdeltype <> 'c') THEN
    ALTER TABLE aceptaciones DROP CONSTRAINT aceptaciones_jugador_id_fkey;
    ALTER TABLE aceptaciones ADD CONSTRAINT aceptaciones_jugador_id_fkey FOREIGN KEY (jugador_id) REFERENCES jugadores(id) ON DELETE CASCADE;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION fn_proteger_aceptacion() RETURNS trigger AS $$
BEGIN
  IF current_setting('dt.mantenimiento', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  -- El borrado en cascada de un deportista eliminado: su fila ya no existe
  IF TG_OP = 'DELETE' AND OLD.jugador_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jugadores WHERE id = OLD.jugador_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Las aceptaciones no se modifican ni se borran.'
    USING ERRCODE = 'check_violation', CONSTRAINT = 'aceptacion_inalterable';
END $$ LANGUAGE plpgsql;

-- La aceptación por papel depende de su consentimiento: los consentimientos no se borran (trigger), salvo en la
-- limpieza de la base de pruebas, y entonces se lleva su aceptación
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aceptaciones_consentimiento_id_fkey' AND confdeltype <> 'c') THEN
    ALTER TABLE aceptaciones DROP CONSTRAINT aceptaciones_consentimiento_id_fkey;
    ALTER TABLE aceptaciones ADD CONSTRAINT aceptaciones_consentimiento_id_fkey FOREIGN KEY (consentimiento_id) REFERENCES consentimientos(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
