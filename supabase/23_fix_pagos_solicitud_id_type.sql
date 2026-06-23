-- Migración 23: DEPRECATED - La corrección ya está en migración 22_webhook_mercado_pago.sql
-- 
-- En la migración 22, el tipo de solicitud_id fue corregido de BIGINT → UUID
-- para que coincida correctamente con solicitudes_inscripcion.id (que es UUID)
--
-- Esta migración anterior no es necesaria ejecutar.
-- La tabla pagos se crea con el tipo correcto en migración 22.

