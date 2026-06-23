-- Migración: Actualizar tabla solicitudes_inscripcion para soportar webhooks
-- Ejecutar en: Supabase SQL Editor

-- Agregar columnas si no existen
ALTER TABLE solicitudes_inscripcion
ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'pagado', 'rechazado'
ADD COLUMN IF NOT EXISTS mp_payment_id TEXT,
ADD COLUMN IF NOT EXISTS fecha_pago TIMESTAMP;

-- Crear índice para búsquedas rápidas por estado
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes_inscripcion(estado);

-- Crear índice para búsquedas por payment_id
CREATE INDEX IF NOT EXISTS idx_solicitudes_mp_payment ON solicitudes_inscripcion(mp_payment_id);

-- Crear índice para búsquedas por email
CREATE INDEX IF NOT EXISTS idx_solicitudes_email ON solicitudes_inscripcion(email);

-- Crear tabla de historial de pagos (para auditoría)
-- CORRECCIÓN: solicitud_id es UUID (no BIGINT) para coincidir con solicitudes_inscripcion.id
CREATE TABLE IF NOT EXISTS pagos (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  solicitud_id UUID NOT NULL,
  mp_payment_id TEXT NOT NULL UNIQUE,
  mp_preference_id TEXT,
  monto DECIMAL(10, 2) NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  metodo_pago TEXT DEFAULT 'mercado_pago',
  fecha TIMESTAMP DEFAULT NOW(),
  confirmado_en TIMESTAMP,
  FOREIGN KEY (solicitud_id) REFERENCES solicitudes_inscripcion(id) ON DELETE CASCADE
);

-- Índices para tabla pagos
CREATE INDEX IF NOT EXISTS idx_pagos_mp_payment ON pagos(mp_payment_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos(fecha DESC);

-- RLS para tabla pagos (solo admins pueden ver)
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_view_pagos" ON pagos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_permisos
      WHERE admin_permisos.email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "admin_insert_pagos" ON pagos
  FOR INSERT
  WITH CHECK (true); -- Sistema puede insertar

-- Comentarios para documentación
COMMENT ON TABLE solicitudes_inscripcion IS 'Solicitudes de inscripción antes de crear usuario';
COMMENT ON COLUMN solicitudes_inscripcion.estado IS 'Estado del pago: pendiente, pagado, rechazado';
COMMENT ON COLUMN solicitudes_inscripcion.mp_payment_id IS 'ID del pago en Mercado Pago (linkeo webhook)';
COMMENT ON COLUMN solicitudes_inscripcion.fecha_pago IS 'Timestamp cuando se confirmó el pago';

COMMENT ON TABLE pagos IS 'Historial completo de pagos (auditoría)';
COMMENT ON COLUMN pagos.mp_payment_id IS 'ID único de pago en Mercado Pago';
COMMENT ON COLUMN pagos.mp_preference_id IS 'ID de preferencia (sesión de pago)';
COMMENT ON COLUMN pagos.estado IS 'Estado del pago: pendiente, aprobado, rechazado';
COMMENT ON COLUMN pagos.solicitud_id IS 'ID UUID de la solicitud de inscripción (referencia a solicitudes_inscripcion.id)';
