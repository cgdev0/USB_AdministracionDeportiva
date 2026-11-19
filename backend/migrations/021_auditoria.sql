-- v2.9 (T2.7 del plan de historia clínica; D12 y D13): registro de auditoría del administrador y ajustes del sistema.
-- Para bases existentes. Ejecutar después de 020_autorizacion_deportista.sql. Se puede repetir sin problema.
--
--  - auditoria: quién hizo qué con las personas y las cuentas, cuándo y desde dónde (altas, cambios de rol,
--    desactivaciones, cargas masivas, inicios de sesión fallidos, ajustes, exportaciones). Nunca guarda contenido
--    clínico (eso tiene su propia bitácora, bitacora_clinica). No se modifica ni se borra.
--  - ajustes: interruptores del sistema que cambia el administrador; cada cambio queda en la auditoría. El primero es
--    exigir el consentimiento de atención firmado para iniciar una valoración (D2), apagado hasta que el docente
--    apruebe los formatos (D12).
BEGIN;

CREATE TABLE IF NOT EXISTS auditoria (
  id              SERIAL PRIMARY KEY,
  usuario_id      INT REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nombre  VARCHAR(150),
  usuario_rol     VARCHAR(30),
  accion          VARCHAR(20) NOT NULL,
  recurso         VARCHAR(20) NOT NULL,
  recurso_id      INT,
  detalle         JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip              VARCHAR(64),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_auditoria_accion CHECK (accion IN ('crear','editar','cambiar_rol','desactivar','activar','restablecer_clave',
    'eliminar','retirar','reactivar','importar','sesion_fallida','sesion_bloqueada','ajuste','exportar')),
  CONSTRAINT chk_auditoria_recurso CHECK (recurso IN ('usuario','deportista','carga','sesion','ajuste','auditoria'))
);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_recurso ON auditoria(recurso, recurso_id);

-- No se modifica ni se borra. Solo se permite que la cuenta quede en blanco si se elimina el usuario (la copia del
-- nombre y del rol se conserva).
CREATE OR REPLACE FUNCTION fn_proteger_auditoria() RETURNS trigger AS $$
BEGIN
  IF current_setting('dt.mantenimiento', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.usuario_id IS NULL AND OLD.usuario_id IS NOT NULL
     AND (to_jsonb(NEW) - 'usuario_id') = (to_jsonb(OLD) - 'usuario_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'El registro de auditoría no se modifica ni se borra.'
    USING ERRCODE = 'check_violation', CONSTRAINT = 'auditoria_inalterable';
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_auditoria ON auditoria;
CREATE TRIGGER trg_auditoria BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION fn_proteger_auditoria();

CREATE TABLE IF NOT EXISTS ajustes (
  clave           VARCHAR(60) PRIMARY KEY,
  valor           JSONB NOT NULL,
  actualizado_por INT REFERENCES usuarios(id) ON DELETE SET NULL,
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO ajustes (clave, valor) VALUES ('exigir_consentimiento_atencion', 'false'::jsonb) ON CONFLICT (clave) DO NOTHING;

COMMIT;
