-- v2.8 (T1.3): la bitácora registra también la consulta de la lista de pacientes (muestra alergias y disponibilidad).
-- Para bases existentes. Ejecutar después de 016_bitacora.sql. Se puede repetir sin problema.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_bitacora_recurso'
                 AND pg_get_constraintdef(oid) LIKE '%paciente%') THEN
    ALTER TABLE bitacora_clinica DROP CONSTRAINT IF EXISTS chk_bitacora_recurso;
    ALTER TABLE bitacora_clinica ADD CONSTRAINT chk_bitacora_recurso CHECK (recurso IN
      ('valoracion','nota','archivo','control','seguimiento','lesion','historia','antropometria','identificacion','paciente'));
  END IF;
END $$;
COMMIT;
