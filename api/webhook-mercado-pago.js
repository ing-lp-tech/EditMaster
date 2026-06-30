import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ── Cliente Supabase con permisos de admin (SERVICE_ROLE_KEY) ──
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Validación de firma MercadoPago ──────────────────────────────────────────
// MP envía: x-signature: ts=<timestamp>,v1=<hmac>  y  x-request-id: <uuid>
// Docs: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
function verifyMPSignature(req, paymentId) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[MP_WEBHOOK] MP_WEBHOOK_SECRET no configurado — omitiendo validación de firma');
    return true;
  }

  const xSignature = req.headers['x-signature'];
  const xRequestId = req.headers['x-request-id'];
  if (!xSignature || !xRequestId) return false;

  const parts = Object.fromEntries(
    xSignature.split(',').map(p => { const [k, v] = p.split('='); return [k.trim(), v?.trim()]; })
  );
  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  const manifest = `id:${paymentId};request-id:${xRequestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { type, data } = req.body;
    console.log('[MP_WEBHOOK] Evento recibido:', type, '| Payment ID:', data?.id);

    // Mercado Pago envía eventos de tipo 'payment'
    if (type === 'payment') {
      const paymentId = data.id;

      // Validar firma antes de procesar cualquier cosa
      if (!verifyMPSignature(req, paymentId)) {
        console.warn('[MP_WEBHOOK] Firma inválida — request rechazado');
        return res.status(401).json({ error: 'Firma inválida' });
      }

      // 1. Obtener detalles completos del pago desde API de MP
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      });

      if (!mpResponse.ok) {
        throw new Error(`MP API error: ${mpResponse.status}`);
      }

      const paymentData = await mpResponse.json();
      console.log('[MP_WEBHOOK] Payment Status:', paymentData.status);

      // 2. Verificar estado del pago
      if (paymentData.status === 'approved') {
        const externalReference = paymentData.external_reference; // ID de solicitud
        const transactionAmount = paymentData.transaction_amount;
        const payerEmail = paymentData.payer?.email || paymentData.payer?.identification?.number;

        console.log('[MP_WEBHOOK] Procesando pago aprobado:', {
          externalReference,
          transactionAmount,
          payerEmail,
        });

        // 3. Buscar la solicitud de inscripción
        const { data: solicitud, error: errorSolicitud } = await supabaseAdmin
          .from('solicitudes_inscripcion')
          .select('*')
          .eq('id', externalReference)
          .single();

        if (errorSolicitud || !solicitud) {
          console.error('[MP_WEBHOOK] Solicitud no encontrada:', externalReference);
          return res.status(404).json({ error: 'Solicitud no encontrada' });
        }

        // 4. Actualizar estado de la solicitud
        const { error: updateError } = await supabaseAdmin
          .from('solicitudes_inscripcion')
          .update({
            estado: 'pagado',
            mp_payment_id: paymentId,
            fecha_pago: new Date().toISOString(),
          })
          .eq('id', externalReference);

        if (updateError) {
          console.error('[MP_WEBHOOK] Error actualizando solicitud:', updateError);
        }

        // 5. Crear usuario en Supabase Auth
        const tempPassword = Math.random().toString(36).slice(-16);
        const emailToUse = solicitud.email.toLowerCase().trim();

        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: emailToUse,
          password: tempPassword,
          email_confirm: true,
        });

        if (authError) {
          console.error('[MP_WEBHOOK] Error creando Auth user:', authError);
          // No fallar, continuar de todas formas
        } else {
          const uid = authUser.user.id;
          console.log('[MP_WEBHOOK] ✅ Auth user creado:', uid);

          // 6. Crear perfil de estudiante
          const { error: perfilError } = await supabaseAdmin
            .from('perfiles')
            .insert({
              uid,
              rol: 'estudiante',
              nombre: solicitud.nombre,
              apellido: solicitud.apellido,
              email: emailToUse,
              telefono: solicitud.telefono || null,
              activo: true,
            });

          if (perfilError) {
            console.error('[MP_WEBHOOK] Error creando perfil:', perfilError);
          } else {
            console.log('[MP_WEBHOOK] ✅ Perfil estudiante creado');
          }

          // 7. Crear entrada en finanzas
          const esAnticipo = solicitud.plan_id && 
            (solicitud.plan_id.includes('anticipo_50') || solicitud.plan_id.includes('anticipo_25'));
          
          const saldoDeuda = esAnticipo 
            ? (solicitud.monto_original - solicitud.monto)
            : 0; // 0 si es pago completo

          const { error: finanzasError } = await supabaseAdmin
            .from('finanzas')
            .insert({
              uid,
              email: emailToUse,
              valor_total: solicitud.monto_original,
              monto_pagado: solicitud.monto,
              saldo_deuda: Math.max(0, saldoDeuda),
              estado: 'pagado',
              metodo_pago: 'mercado_pago',
              transferencia_number: paymentId,
              plan: solicitud.plan_label || 'completo',
            });

          if (finanzasError) {
            console.error('[MP_WEBHOOK] Error creando finanzas:', finanzasError);
          } else {
            console.log('[MP_WEBHOOK] ✅ Registro finanzas creado');
          }
        }

        // 8. Registrar pago en tabla de auditoría (opcional)
        try {
          await supabaseAdmin
            .from('papelera_auditoria')
            .insert({
              tabla: 'pagos',
              accion: 'pago_aprobado',
              datos_nuevos: {
                solicitud_id: externalReference,
                mp_payment_id: paymentId,
                monto: transactionAmount,
                estado: 'aprobado',
              },
              usuario_id: null,
              timestamp: new Date().toISOString(),
            });
        } catch {
          console.log('[MP_WEBHOOK] Tabla auditoria no existe, continuando...');
        }

        return res.status(200).json({ success: true, message: 'Pago aprobado procesado' });
      }

      // Si está pendiente
      if (paymentData.status === 'pending') {
        console.log('[MP_WEBHOOK] ⏳ Pago pendiente');
        await supabaseAdmin
          .from('solicitudes_inscripcion')
          .update({ 
            estado: 'pendiente',
            mp_payment_id: paymentId,
          })
          .eq('mp_preference_id', paymentData.preference_id)
          .catch(() => {});
      }

      // Si fue rechazado
      if (paymentData.status === 'rejected') {
        console.log('[MP_WEBHOOK] ❌ Pago rechazado');
        await supabaseAdmin
          .from('solicitudes_inscripcion')
          .update({ 
            estado: 'rechazado',
            mp_payment_id: paymentId,
          })
          .eq('mp_preference_id', paymentData.preference_id)
          .catch(() => {});
      }

      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('[MP_WEBHOOK_ERROR]', error.message);
    return res.status(500).json({ error: error.message });
  }
}
