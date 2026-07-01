-- Fix: el CHECK constraint de solicitudes_inscripcion.estado nunca permitió
-- 'pagado', a pesar de que el webhook de Mercado Pago (api/webhook-mercado-pago.js)
-- siempre intenta setear estado='pagado' tras un pago aprobado.
--
-- Esto bloqueaba TODOS los pagos reales silenciosamente (Postgres error 23514,
-- "violates check constraint solicitudes_inscripcion_estado_check"), dejando
-- las solicitudes atascadas en 'pendiente' para siempre aunque Mercado Pago
-- ya hubiera aprobado el pago y cobrado la plata.

ALTER TABLE solicitudes_inscripcion
  DROP CONSTRAINT IF EXISTS solicitudes_inscripcion_estado_check;

ALTER TABLE solicitudes_inscripcion
  ADD CONSTRAINT solicitudes_inscripcion_estado_check
  CHECK (estado IN ('pendiente', 'dado_de_alta', 'rechazado', 'pagado'));
