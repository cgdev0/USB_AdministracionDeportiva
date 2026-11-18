-- v2.7 (T0.6): bitácora de accesos a la historia clínica.
-- Para bases existentes. Ejecutar después de 015_archivos_clinicos.sql. Se puede repetir sin problema.
-- Quién vio, creó, cambió, cerró o descargó cada registro clínico, y cuándo. Así se puede demostrar la
-- confidencialidad que exigen la Resolución 1995 de 1999 (reserva de la historia) y la Ley 1581 de 2012.
-- Solo se agregan filas: no se modifican ni se borran (trigger). No guarda contenido clínico, solo quién, qué y
-- cuándo. Sin llaves foráneas a propósito: la bitácora se conserva aunque cambien las cuentas, y guarda una copia
-- del nombre y el rol de quien accedió.
BEGIN;
CREATE TABLE IF NOT EXISTS bitacora_clinica (
  id              BIGSERIAL PRIMARY KEY,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_id      INT,
  usuario_nombre  VARCHAR(100),
  usuario_rol     VARCHAR(20),
  jugador_id      INT,
  accion          VARCHAR(12) NOT NULL,
  recurso         VARCHAR(20) NOT NULL,
  recurso_id      INT,
  ip              VARCHAR(64),
  CONSTRAINT chk_bitacora_accion CHECK (accion IN ('listar','ver','crear','editar','cerrar','descartar','descargar','verificar','exportar','eliminar')),
  CONSTRAINT chk_bitacora_recurso CHECK (recurso IN ('valoracion','nota','archivo','control','seguimiento','lesion','historia','antropometria','identificacion'))
);
CREATE INDEX IF NOT EXISTS idx_bitacora_jugador ON bitacora_clinica(jugador_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_usuario ON bitacora_clinica(usuario_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_fecha ON bitacora_clinica(creado_en DESC);

CREATE OR REPLACE FUNCTION fn_proteger_bitacora() RETURNS trigger AS $$
BEGIN
  IF current_setting('dt.mantenimiento', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'La bitácora de accesos no se modifica ni se borra.'
    USING ERRCODE = 'check_violation', CONSTRAINT = 'bitacora_inalterable';
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_bitacora ON bitacora_clinica;
CREATE TRIGGER trg_bitacora BEFORE UPDATE OR DELETE ON bitacora_clinica
  FOR EACH ROW EXECUTE FUNCTION fn_proteger_bitacora();
COMMIT;
