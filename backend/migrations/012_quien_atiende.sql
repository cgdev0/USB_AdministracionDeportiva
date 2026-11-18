-- v2.7 (T0.2): datos de quien atiende en el área de salud.
-- Para bases existentes. Ejecutar después de 011_identificacion.sql. Se puede repetir sin problema.
-- Decisión D1 del plan: el registro profesional (RETHUS) es opcional, porque los primeros en usar el sistema serán
-- practicantes de fisioterapia y estudiantes del área de salud. Pueden tener un docente supervisor (opcional).
BEGIN;
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS profesion            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS vinculo              VARCHAR(15),
  ADD COLUMN IF NOT EXISTS registro_profesional VARCHAR(30),
  ADD COLUMN IF NOT EXISTS supervisor_id        INT REFERENCES usuarios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_supervisor ON usuarios(supervisor_id);

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('chk_usuarios_profesion', 'profesion IN (''fisioterapia'',''medicina'',''enfermeria'',''nutricion'',''psicologia'',''otra'')'),
    ('chk_usuarios_vinculo', 'vinculo IN (''profesional'',''practicante'',''estudiante'')'),
    ('chk_usuarios_supervisor_distinto', 'supervisor_id <> id')
  ) AS t(nombre, regla)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = r.nombre) THEN
      EXECUTE format('ALTER TABLE usuarios ADD CONSTRAINT %I CHECK (%s)', r.nombre, r.regla);
    END IF;
  END LOOP;
END $$;
COMMIT;
