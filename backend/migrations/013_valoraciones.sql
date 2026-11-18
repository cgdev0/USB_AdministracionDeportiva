-- v2.7 (T0.3): historia clínica secuencial e inalterable.
-- Para bases existentes. Ejecutar después de 012_quien_atiende.sql. Se puede repetir sin problema.
-- Resolución 1995 de 1999: cada atención queda como un registro aparte (fecha, hora y quien atiende) y lo
-- registrado no se altera; las correcciones se hacen con notas aclaratorias. Antes, la historia era una sola fila
-- por deportista y cada guardado reemplazaba la anterior (DEF-052).
BEGIN;
CREATE TABLE IF NOT EXISTS valoraciones (
  id              SERIAL PRIMARY KEY,
  jugador_id      INT NOT NULL REFERENCES jugadores(id) ON DELETE RESTRICT,
  profesional_id  INT REFERENCES usuarios(id) ON DELETE RESTRICT,
  tipo            VARCHAR(20) NOT NULL DEFAULT 'control',
  fecha_hora      TIMESTAMPTZ NOT NULL DEFAULT now(),
  estado          VARCHAR(10) NOT NULL DEFAULT 'borrador',
  contenido       JSONB NOT NULL DEFAULT '{}'::jsonb,
  quien_atiende   JSONB,
  cerrada_en      TIMESTAMPTZ,
  hash_cierre     CHAR(64),
  version         INT NOT NULL DEFAULT 1,
  origen          VARCHAR(10) NOT NULL DEFAULT 'app',
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_valoraciones_tipo CHECK (tipo IN ('inicial','control','pretemporada','post_lesion','registro_previo')),
  CONSTRAINT chk_valoraciones_estado CHECK (estado IN ('borrador','cerrada')),
  CONSTRAINT chk_valoraciones_cierre CHECK (estado = 'borrador' OR cerrada_en IS NOT NULL),
  CONSTRAINT chk_valoraciones_origen CHECK (origen IN ('app','migrada'))
);
CREATE INDEX IF NOT EXISTS idx_valoraciones_jugador ON valoraciones(jugador_id, fecha_hora DESC);

-- Única forma de corregir una valoración cerrada. Las notas tampoco se modifican ni se borran.
CREATE TABLE IF NOT EXISTS notas_aclaratorias (
  id             SERIAL PRIMARY KEY,
  valoracion_id  INT NOT NULL REFERENCES valoraciones(id) ON DELETE RESTRICT,
  texto          TEXT NOT NULL CONSTRAINT chk_notas_texto CHECK (length(btrim(texto)) > 0),
  profesional_id INT REFERENCES usuarios(id) ON DELETE RESTRICT,
  quien_atiende  JSONB,
  creada_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notas_valoracion ON notas_aclaratorias(valoracion_id, creada_en);

-- La base de datos misma impide cambiar o borrar lo cerrado, aunque alguien lo intente sin pasar por la API.
-- Solo el mantenimiento explícito (SET dt.mantenimiento = 'on', por ejemplo para limpiar la base de pruebas) lo permite.
CREATE OR REPLACE FUNCTION fn_proteger_valoracion_cerrada() RETURNS trigger AS $$
BEGIN
  IF current_setting('dt.mantenimiento', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF OLD.estado = 'cerrada' THEN
    RAISE EXCEPTION 'La valoración % está cerrada: no se puede modificar ni borrar. Agrega una nota aclaratoria.', OLD.id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'valoracion_cerrada';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_valoracion_cerrada ON valoraciones;
CREATE TRIGGER trg_valoracion_cerrada BEFORE UPDATE OR DELETE ON valoraciones
  FOR EACH ROW EXECUTE FUNCTION fn_proteger_valoracion_cerrada();

CREATE OR REPLACE FUNCTION fn_proteger_nota_aclaratoria() RETURNS trigger AS $$
BEGIN
  IF current_setting('dt.mantenimiento', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Las notas aclaratorias no se modifican ni se borran.'
    USING ERRCODE = 'check_violation', CONSTRAINT = 'nota_aclaratoria_inalterable';
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_nota_aclaratoria ON notas_aclaratorias;
CREATE TRIGGER trg_nota_aclaratoria BEFORE UPDATE OR DELETE ON notas_aclaratorias
  FOR EACH ROW EXECUTE FUNCTION fn_proteger_nota_aclaratoria();

-- Las historias de antes pasan a ser la primera valoración de cada deportista: cerrada, con su fecha y su autor.
-- No tienen código de integridad (se registraron antes de que existiera). La tabla vieja queda solo de lectura.
INSERT INTO valoraciones (jugador_id, profesional_id, tipo, fecha_hora, estado, contenido, quien_atiende, cerrada_en, origen)
SELECT h.jugador_id, u.id, 'registro_previo', h.updated_at, 'cerrada',
       jsonb_strip_nulls(jsonb_build_object(
         'antecedentes', jsonb_strip_nulls(jsonb_build_object(
           'personales', NULLIF(btrim(h.antecedentes), ''), 'alergias', NULLIF(btrim(h.alergias), ''),
           'medicamentos', NULLIF(btrim(h.medicamentos), ''), 'cirugias', NULLIF(btrim(h.cirugias), ''),
           'enfermedades', NULLIF(btrim(h.enfermedades), ''), 'historial_deportivo', NULLIF(btrim(h.historial_deportivo), ''))),
         'observaciones', NULLIF(btrim(h.observaciones), ''))),
       CASE WHEN u.id IS NULL THEN NULL
            ELSE jsonb_build_object('usuario_id', u.id, 'nombre', u.nombre, 'descripcion', 'Registro anterior a la v2.7') END,
       h.updated_at, 'migrada'
  FROM historias_clinicas h LEFT JOIN usuarios u ON u.id = h.actualizado_por
 WHERE NOT EXISTS (SELECT 1 FROM valoraciones v WHERE v.origen = 'migrada' AND v.jugador_id = h.jugador_id);
COMMIT;
