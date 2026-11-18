-- v2.7 (T0.4): conservación de la historia clínica.
-- Para bases existentes. Ejecutar después de 013_valoraciones.sql. Se puede repetir sin problema.
-- Resolución 839 de 2017: la historia clínica se conserva mínimo 15 años desde la última atención. Antes, eliminar
-- un deportista borraba en cascada sus lesiones, controles, seguimientos y antropometría (DEF-053).
-- Ahora el deportista se RETIRA (deja el plantel actual y conserva todo) y la base impide borrar a quien tiene
-- historia clínica. Se usa un trigger en lugar de cambiar las llaves a RESTRICT para que el modo de mantenimiento
-- (SET dt.mantenimiento = 'on', por ejemplo para limpiar la base de pruebas) pueda seguir borrando en cascada.
BEGIN;
ALTER TABLE jugadores
  ADD COLUMN IF NOT EXISTS activo        BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS retirado_en   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_retiro VARCHAR(200);
CREATE INDEX IF NOT EXISTS idx_jugadores_activo ON jugadores(activo);

CREATE OR REPLACE FUNCTION fn_proteger_jugador_con_historia() RETURNS trigger AS $$
BEGIN
  IF current_setting('dt.mantenimiento', true) = 'on' THEN RETURN OLD; END IF;
  IF EXISTS (SELECT 1 FROM valoraciones WHERE jugador_id = OLD.id)
     OR EXISTS (SELECT 1 FROM historias_clinicas WHERE jugador_id = OLD.id)
     OR EXISTS (SELECT 1 FROM controles_medicos WHERE jugador_id = OLD.id)
     OR EXISTS (SELECT 1 FROM lesiones WHERE jugador_id = OLD.id)
     OR EXISTS (SELECT 1 FROM antropometria WHERE jugador_id = OLD.id) THEN
    RAISE EXCEPTION 'El deportista % tiene historia clínica: no se puede eliminar. Retíralo; sus registros se conservan.', OLD.id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'jugador_con_historia_clinica';
  END IF;
  RETURN OLD;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_jugador_con_historia ON jugadores;
CREATE TRIGGER trg_jugador_con_historia BEFORE DELETE ON jugadores
  FOR EACH ROW EXECUTE FUNCTION fn_proteger_jugador_con_historia();

-- Una lesión con seguimientos clínicos tampoco se borra (antes se llevaba sus seguimientos en cascada)
CREATE OR REPLACE FUNCTION fn_proteger_lesion_con_seguimiento() RETURNS trigger AS $$
BEGIN
  IF current_setting('dt.mantenimiento', true) = 'on' THEN RETURN OLD; END IF;
  IF EXISTS (SELECT 1 FROM seguimiento_lesiones WHERE lesion_id = OLD.id) THEN
    RAISE EXCEPTION 'La lesión % tiene seguimientos clínicos: no se puede eliminar.', OLD.id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'lesion_con_seguimiento';
  END IF;
  RETURN OLD;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_lesion_con_seguimiento ON lesiones;
CREATE TRIGGER trg_lesion_con_seguimiento BEFORE DELETE ON lesiones
  FOR EACH ROW EXECUTE FUNCTION fn_proteger_lesion_con_seguimiento();
COMMIT;
