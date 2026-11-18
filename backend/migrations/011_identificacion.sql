-- v2.7 (T0.1): identificación y contacto del deportista.
-- Para bases existentes. Ejecutar después de 010_metricas_y_admin.sql. Se puede repetir sin problema.
-- Resolución 1995 de 1999: la historia clínica se identifica con el documento de identidad.
-- Los tipos de documento son los códigos de la guía FHIR del Resumen Digital de Atención (RDA) del MinSalud.
-- Pertenencia étnica y discapacidad son datos sensibles (Ley 1581 de 2012): solo el personal de salud.
BEGIN;
ALTER TABLE jugadores
  ADD COLUMN IF NOT EXISTS tipo_documento                 VARCHAR(3),
  ADD COLUMN IF NOT EXISTS numero_documento               VARCHAR(20),
  ADD COLUMN IF NOT EXISTS telefono                       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS eps                            VARCHAR(100),
  ADD COLUMN IF NOT EXISTS municipio_residencia           VARCHAR(100),
  ADD COLUMN IF NOT EXISTS zona_residencia                VARCHAR(10),
  ADD COLUMN IF NOT EXISTS nacionalidad                   VARCHAR(2),
  ADD COLUMN IF NOT EXISTS pertenencia_etnica             VARCHAR(20),
  ADD COLUMN IF NOT EXISTS discapacidad                   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS contacto_emergencia_nombre     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS contacto_emergencia_parentesco VARCHAR(40),
  ADD COLUMN IF NOT EXISTS contacto_emergencia_telefono   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS acudiente_nombre               VARCHAR(100),
  ADD COLUMN IF NOT EXISTS acudiente_tipo_documento       VARCHAR(3),
  ADD COLUMN IF NOT EXISTS acudiente_numero_documento     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS acudiente_parentesco           VARCHAR(40),
  ADD COLUMN IF NOT EXISTS acudiente_telefono             VARCHAR(20);

-- Un número de documento identifica a una sola persona, sin importar el tipo: al cumplir 18 años la tarjeta
-- de identidad pasa a cédula con el mismo número (NUIP). Así la misma persona no queda registrada dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS uq_jugadores_documento ON jugadores(numero_documento) WHERE numero_documento IS NOT NULL;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('chk_jugadores_tipo_documento', 'tipo_documento IN (''CC'',''TI'',''RC'',''CE'',''PA'',''PPT'',''PE'')'),
    ('chk_jugadores_documento_completo', '(tipo_documento IS NULL) = (numero_documento IS NULL)'),
    ('chk_jugadores_acudiente_tipo_documento', 'acudiente_tipo_documento IN (''CC'',''TI'',''RC'',''CE'',''PA'',''PPT'',''PE'')'),
    ('chk_jugadores_zona', 'zona_residencia IN (''urbana'',''rural'')'),
    ('chk_jugadores_nacionalidad', 'nacionalidad ~ ''^[A-Z]{2}$'''),
    ('chk_jugadores_pertenencia_etnica', 'pertenencia_etnica IN (''ninguna'',''indigena'',''rom'',''raizal'',''palenquero'',''afrocolombiano'')'),
    ('chk_jugadores_discapacidad', 'discapacidad IN (''ninguna'',''fisica'',''auditiva'',''visual'',''sordoceguera'',''intelectual'',''psicosocial'',''multiple'')')
  ) AS t(nombre, regla)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = r.nombre) THEN
      EXECUTE format('ALTER TABLE jugadores ADD CONSTRAINT %I CHECK (%s)', r.nombre, r.regla);
    END IF;
  END LOOP;
END $$;
COMMIT;
