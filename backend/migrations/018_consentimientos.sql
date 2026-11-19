-- v2.9 (T2.1 del plan de historia clínica; RF-27): consentimientos firmados a mano, con su estado y la imagen del papel.
-- Para bases existentes. Ejecutar después de 017_bitacora_paciente.sql. Se puede repetir sin problema.
--
-- Cada acto (firma, rechazo o revocación) es un registro aparte que no se modifica ni se borra: el estado de cada
-- tipo es el de su último registro (sin registros, "pendiente"). Revocar crea un registro nuevo y deja el historial.
-- Tipos separados: la atención, el tratamiento de datos personales (Ley 1581 de 2012) y el uso en investigación
-- (Res. 8430 de 1993), que es opcional e independiente: negarlo no afecta la atención.
BEGIN;

CREATE TABLE IF NOT EXISTS consentimientos (
  id                         SERIAL PRIMARY KEY,
  jugador_id                 INT NOT NULL REFERENCES jugadores(id) ON DELETE RESTRICT,
  tipo                       VARCHAR(20) NOT NULL,
  estado                     VARCHAR(12) NOT NULL,
  fecha                      DATE NOT NULL DEFAULT CURRENT_DATE,  -- de la firma, el rechazo o la revocación
  firma_quien                VARCHAR(12),                        -- el deportista o su acudiente
  firmante_nombre            VARCHAR(150),
  firmante_tipo_documento    VARCHAR(5),
  firmante_numero_documento  VARCHAR(20),
  firmante_parentesco        VARCHAR(40),
  asentimiento               BOOLEAN,                            -- solo menores de edad; vacío si es mayor
  archivo_id                 INT REFERENCES archivos_clinicos(id) ON DELETE RESTRICT,  -- foto o PDF del papel
  version_formato            VARCHAR(40),
  motivo                     VARCHAR(500),                       -- de la revocación (obligatorio) o del rechazo
  revoca_id                  INT REFERENCES consentimientos(id) ON DELETE RESTRICT,
  registrado_por             INT REFERENCES usuarios(id) ON DELETE RESTRICT,
  quien_atiende              JSONB,                              -- copia de los datos de quien lo registró (T0.2)
  registrado_en              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_consentimientos_tipo CHECK (tipo IN ('atencion','datos_personales','investigacion')),
  CONSTRAINT chk_consentimientos_estado CHECK (estado IN ('pendiente','firmado','rechazado','revocado')),
  CONSTRAINT chk_consentimientos_firma_quien CHECK (firma_quien IS NULL OR firma_quien IN ('deportista','acudiente')),
  CONSTRAINT chk_consentimientos_firmado_con_archivo CHECK (estado <> 'firmado' OR archivo_id IS NOT NULL),
  CONSTRAINT chk_consentimientos_firmado_con_firmante CHECK (estado <> 'firmado' OR (firma_quien IS NOT NULL AND length(btrim(firmante_nombre)) > 0)),
  CONSTRAINT chk_consentimientos_revocado CHECK (estado <> 'revocado' OR (revoca_id IS NOT NULL AND length(btrim(motivo)) > 0))
);
CREATE INDEX IF NOT EXISTS idx_consentimientos_jugador ON consentimientos(jugador_id, tipo, registrado_en DESC, id DESC);

-- Como el resto de la historia clínica: no se modifican ni se borran (salvo el mantenimiento de la base de pruebas)
CREATE OR REPLACE FUNCTION fn_proteger_consentimiento() RETURNS trigger AS $$
BEGIN
  IF current_setting('dt.mantenimiento', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Los consentimientos no se modifican ni se borran: para retirarlo, regístralo como revocado.'
    USING ERRCODE = 'check_violation', CONSTRAINT = 'consentimiento_inalterable';
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_consentimiento ON consentimientos;
CREATE TRIGGER trg_consentimiento BEFORE UPDATE OR DELETE ON consentimientos
  FOR EACH ROW EXECUTE FUNCTION fn_proteger_consentimiento();

-- La regla de la T0.4 (no borrar a quien tiene historia clínica) incluye los consentimientos
CREATE OR REPLACE FUNCTION fn_proteger_jugador_con_historia() RETURNS trigger AS $$
BEGIN
  IF current_setting('dt.mantenimiento', true) = 'on' THEN RETURN OLD; END IF;
  IF EXISTS (SELECT 1 FROM valoraciones WHERE jugador_id = OLD.id)
     OR EXISTS (SELECT 1 FROM historias_clinicas WHERE jugador_id = OLD.id)
     OR EXISTS (SELECT 1 FROM controles_medicos WHERE jugador_id = OLD.id)
     OR EXISTS (SELECT 1 FROM lesiones WHERE jugador_id = OLD.id)
     OR EXISTS (SELECT 1 FROM antropometria WHERE jugador_id = OLD.id)
     OR EXISTS (SELECT 1 FROM archivos_clinicos WHERE jugador_id = OLD.id)
     OR EXISTS (SELECT 1 FROM consentimientos WHERE jugador_id = OLD.id) THEN
    RAISE EXCEPTION 'El deportista % tiene historia clínica: no se puede eliminar. Retíralo; sus registros se conservan.', OLD.id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'jugador_con_historia_clinica';
  END IF;
  RETURN OLD;
END $$ LANGUAGE plpgsql;

-- La bitácora registra también la consulta y el registro de consentimientos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_bitacora_recurso'
                 AND pg_get_constraintdef(oid) LIKE '%consentimiento%') THEN
    ALTER TABLE bitacora_clinica DROP CONSTRAINT IF EXISTS chk_bitacora_recurso;
    ALTER TABLE bitacora_clinica ADD CONSTRAINT chk_bitacora_recurso CHECK (recurso IN
      ('valoracion','nota','archivo','control','seguimiento','lesion','historia','antropometria','identificacion','paciente','consentimiento'));
  END IF;
END $$;

-- y la revocación de un consentimiento como una acción propia ("revocó")
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_bitacora_accion'
                 AND pg_get_constraintdef(oid) LIKE '%revocar%') THEN
    ALTER TABLE bitacora_clinica DROP CONSTRAINT IF EXISTS chk_bitacora_accion;
    ALTER TABLE bitacora_clinica ADD CONSTRAINT chk_bitacora_accion CHECK (accion IN
      ('listar','ver','crear','editar','cerrar','descartar','descargar','verificar','exportar','eliminar','revocar'));
  END IF;
END $$;

COMMIT;
