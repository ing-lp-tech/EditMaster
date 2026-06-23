# 📋 Guía Completa: Integración de Mercado Pago en EditMaster

## 🎯 Estado Actual
✅ **Ya tienes:**
- Endpoint `/api/create-preference` configurado
- Página de inscripción con plans
- Sistema de cupones funcional
- Tabla `solicitudes_inscripcion` en Supabase

❌ **Te falta:**
- Webhooks para confirmar pagos
- Creación automática de estudiantes tras pago aprobado
- Manejo de pagos pendientes/fallidos
- Documentación de credenciales

---

## 🔑 PASO 1: Obtener Credenciales de Mercado Pago

### 1.1 Crear cuenta en Mercado Pago Developers
1. Ve a [https://www.mercadopago.com.ar/developers](https://www.mercadopago.com.ar/developers)
2. Click en **"Tu cuenta"** → **"Crear cuenta como vendedor"** (si no tienes)
3. Verifica tu identidad

### 1.2 Obtener las API Keys
1. Dentro de Developers, ve a **"Credenciales"**
2. Habrá dos secciones: **Pruebas (Sandbox)** y **Producción**

**IMPORTANTE:**
- **Public Key (Sandbox)**: `APP_USR_xxxxxxx...` (empieza con APP_USR)
- **Access Token (Sandbox)**: `APP_USR_xxxxxxx...` (token largo)
- Repetir lo mismo para PRODUCCIÓN

### 1.3 Guardar en `.env.local` (LOCAL)
```bash
# .env.local (NO commitar a git)
VITE_MP_PUBLIC_KEY=APP_USR_xxxx...  # Sandbox
MP_ACCESS_TOKEN=APP_USR_xxxx...     # Sandbox
```

### 1.4 Guardar en Vercel (PRODUCCIÓN)
1. Ve a [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Tu proyecto → **Settings** → **Environment Variables**
3. Agrega:
```
MP_ACCESS_TOKEN = (Token de Producción)
VITE_MP_PUBLIC_KEY = (Public Key de Producción)
```

---

## 🪝 PASO 2: Configurar Webhooks (CRÍTICO)

Los webhooks reciben confirmación de pagos desde Mercado Pago. **Sin esto, no sabrás si el pago fue aprobado.**

### 2.1 Crear endpoint de Webhook

Crear archivo: `api/webhook-mercado-pago.js`

```javascript
// api/webhook-mercado-pago.js
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase (con SERVICE_ROLE_KEY para permisos totales)
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { type, data } = req.body;

    console.log('[MP_WEBHOOK] Evento recibido:', type);

    // Mercado Pago envía notificaciones de diferentes tipos
    if (type === 'payment') {
      const paymentId = data.id;
      console.log('[MP_WEBHOOK] Payment ID:', paymentId);

      // 1. Obtener detalles del pago desde MP API
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      });

      const paymentData = await mpResponse.json();
      console.log('[MP_WEBHOOK] Payment Status:', paymentData.status);

      // 2. Si el estado es "approved", procesar el pago
      if (paymentData.status === 'approved') {
        const externalReference = paymentData.external_reference; // ID de solicitud
        const transactionAmount = paymentData.transaction_amount;
        const payerEmail = paymentData.payer?.email;

        // 3. Buscar la solicitud de inscripción
        const { data: solicitud, error: errorSolicitud } = await supabaseAdmin
          .from('solicitudes_inscripcion')
          .select('*')
          .eq('id', externalReference)
          .single();

        if (errorSolicitud) {
          console.error('[MP_WEBHOOK] Solicitud no encontrada:', externalReference);
          return res.status(404).json({ error: 'Solicitud no encontrada' });
        }

        // 4. Actualizar estado de la solicitud
        await supabaseAdmin
          .from('solicitudes_inscripcion')
          .update({
            estado: 'pagado',
            mp_payment_id: paymentId,
            fecha_pago: new Date().toISOString(),
          })
          .eq('id', externalReference);

        // 5. Crear usuario en Supabase Auth
        const userData = await supabaseAdmin.auth.admin.createUser({
          email: payerEmail || solicitud.email,
          password: Math.random().toString(36).slice(-16), // Password aleatorio
          email_confirm: true,
        });

        if (userData.error) {
          console.error('[MP_WEBHOOK] Error creando Auth user:', userData.error);
          // Continuar de todas formas
        } else {
          const uid = userData.data.user.id;

          // 6. Crear perfil de estudiante
          await supabaseAdmin
            .from('perfiles')
            .insert({
              uid,
              rol: 'estudiante',
              nombre: solicitud.nombre,
              apellido: solicitud.apellido,
              email: solicitud.email,
              telefono: solicitud.telefono,
            });

          // 7. Crear entrada en finanzas
          const cuotaTotal = solicitud.monto;
          const { data: finanza } = await supabaseAdmin
            .from('finanzas')
            .insert({
              uid,
              email: solicitud.email,
              valor_total: cuotaTotal,
              saldo_deuda: solicitud.plan_id.includes('anticipo') 
                ? (solicitud.monto_original - solicitud.monto)
                : 0, // 0 si es pago completo
              estado: 'pagado',
              metodo_pago: 'mercado_pago',
              transferencia_number: paymentId,
            });

          console.log('[MP_WEBHOOK] ✅ Usuario creado:', uid);
        }

        // 8. Registrar pago en tabla de pagos (si la tienes)
        await supabaseAdmin
          .from('pagos')
          .insert({
            solicitud_id: externalReference,
            mp_payment_id: paymentId,
            monto: transactionAmount,
            estado: 'aprobado',
            fecha: new Date().toISOString(),
          })
          .catch(() => console.log('[MP_WEBHOOK] Tabla pagos no existe, OK'));

        // 9. Enviar email de confirmación (opcional, puedes usar SendGrid)
        console.log('[MP_WEBHOOK] 📧 (Aquí implementarías envío de email)');

        return res.status(200).json({ success: true, message: 'Pago procesado' });
      }

      // Si está pendiente
      if (paymentData.status === 'pending') {
        console.log('[MP_WEBHOOK] Pago pendiente');
        await supabaseAdmin
          .from('solicitudes_inscripcion')
          .update({ estado: 'pendiente' })
          .eq('mp_preference_id', paymentData.preference_id);
      }

      // Si fue rechazado
      if (paymentData.status === 'rejected') {
        console.log('[MP_WEBHOOK] Pago rechazado');
        await supabaseAdmin
          .from('solicitudes_inscripcion')
          .update({ estado: 'rechazado' })
          .eq('mp_preference_id', paymentData.preference_id);
      }

      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[MP_WEBHOOK_ERROR]', error.message);
    return res.status(500).json({ error: error.message });
  }
}
```

### 2.2 Registrar webhook en Mercado Pago

1. Ve a [https://www.mercadopago.com.ar/developers/panel](https://www.mercadopago.com.ar/developers/panel)
2. **Webhooks** → **Crear Webhook**
3. **URL**: `https://tudominio.com/api/webhook-mercado-pago`
   - Local: `http://localhost:4173/api/webhook-mercado-pago` (con `vercel dev`)
   - Producción: `https://editmaster.vercel.app/api/webhook-mercado-pago`
4. **Eventos**: Selecciona:
   - `payment.created`
   - `payment.updated`
5. **Guardar**

---

## 💾 PASO 3: Actualizar `create-preference.js`

Necesitas incluir el `external_reference` (ID de solicitud) para trackear pagos:

```javascript
// api/create-preference.js (línea ~85)

const response = await preference.create({
  body: {
    items: sanitizedItems,
    payer: { email: payer_email.toLowerCase().trim() },
    external_reference: externalReference, // ← AGREGAR ESTO
    back_urls: {
      success: `${baseUrl}/inscripcion?status=success`,
      pending: `${baseUrl}/inscripcion?status=pending`,
      failure: `${baseUrl}/inscripcion?status=failure`,
    },
    // ... resto del código
  },
});
```

**PERO ANTES**, en InscripcionPage, obtén el ID de la solicitud:

```javascript
// src/pages/InscripcionPage.jsx (en handleSubmit)

// ANTES de generar la preferencia:
const { data: newSolicitud, error: insertError } = await supabase
  .from('solicitudes_inscripcion')
  .insert([/* ... */])
  .select('id')
  .single();

if (insertError) throw new Error('Error al guardar solicitud');

// LUEGO, generar preferencia CON el ID:
const res = await fetch('/api/create-preference', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    payer_email: form.email,
    items: [/* ... */],
    externalReference: newSolicitud.id, // ← PASAR EL ID
  }),
});
```

---

## 📊 PASO 4: Actualizar Schema de Supabase

Agrega estas columnas a `solicitudes_inscripcion`:

```sql
-- En Supabase SQL Editor

ALTER TABLE solicitudes_inscripcion
ADD COLUMN estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'pagado', 'rechazado'
ADD COLUMN mp_payment_id TEXT,
ADD COLUMN fecha_pago TIMESTAMP;

-- Crear tabla de historial de pagos (opcional pero recomendado)
CREATE TABLE pagos (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  solicitud_id BIGINT NOT NULL,
  mp_payment_id TEXT NOT NULL,
  monto DECIMAL(10, 2),
  estado TEXT,
  fecha TIMESTAMP,
  FOREIGN KEY (solicitud_id) REFERENCES solicitudes_inscripcion(id)
);
```

---

## 🧪 PASO 5: Testing en Modo Sandbox

### 5.1 Tarjetas de prueba
Mercado Pago ofrece tarjetas fake para testear:

**Tarjeta de prueba APROBADA:**
- Número: `4111 1111 1111 1111`
- Vencimiento: `12/25`
- CVV: `123`
- Titular: `TEST USER`

**Tarjeta de prueba RECHAZADA:**
- Número: `4000 0000 0000 0002`
- Vencimiento: `12/25`
- CVV: `123`

### 5.2 Probar con `vercel dev`
```bash
npm run dev:api
# Esto corre tu app con webhooks activos en local
```

### 5.3 Verificar webhooks localmente
Para recibir webhooks en local, usa **ngrok**:
```bash
# 1. Descargar ngrok desde https://ngrok.com
# 2. En otra terminal:
ngrok http 4173

# 3. Copia la URL (ej: https://1234-56-78-90.ngrok.io)
# 4. En Mercado Pago Developers, actualiza el webhook URL:
#    https://1234-56-78-90.ngrok.io/api/webhook-mercado-pago
```

---

## 🚀 PASO 6: Implementar Confirmación Automática de Pago

Actualiza `InscripcionPage.jsx` para que tras el pago aprobado, la solicitud se transforme en usuario:

```javascript
// src/pages/InscripcionPage.jsx

// Cuando vuelve con status=success, verifica el pago:
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('status') === 'approved' || params.get('status') === 'success') {
    setEstado('success');
    // Opcional: aquí podrías hacer una verificación adicional
    // del estado de la solicitud en Supabase
  }
}, []);
```

---

## 📝 PASO 7: Variables de Entorno Finales

### Local (`.env.local`)
```bash
VITE_MP_PUBLIC_KEY=APP_USR_xxxx_sandbox_xxxx
MP_ACCESS_TOKEN=APP_USR_xxxx_sandbox_xxxx
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxx
SUPABASE_SERVICE_ROLE_KEY=xxxx
```

### Vercel (Dashboard → Settings → Environment Variables)
```
MP_ACCESS_TOKEN = (PRODUCCIÓN TOKEN)
VITE_MP_PUBLIC_KEY = (PRODUCCIÓN PUBLIC KEY)
VITE_SUPABASE_URL = (misma que local)
VITE_SUPABASE_ANON_KEY = (misma que local)
SUPABASE_SERVICE_ROLE_KEY = (misma que local)
```

---

## ✅ CHECKLIST DE INTEGRACIÓN

- [ ] Credenciales obtenidas (Sandbox y Producción)
- [ ] Variables de entorno configuradas (local y Vercel)
- [ ] Webhook creado en `/api/webhook-mercado-pago.js`
- [ ] Webhook registrado en Mercado Pago Developers
- [ ] Schema Supabase actualizado (columnas en solicitudes_inscripcion)
- [ ] `create-preference.js` actualizado con `external_reference`
- [ ] `InscripcionPage.jsx` actualizado para pasar solicitud ID
- [ ] Probado con tarjetas fake en Sandbox
- [ ] Logs verificados en consola y Mercado Pago Developers
- [ ] Transición de solicitud → usuario → perfil funciona
- [ ] Deploy a Vercel y test en producción

---

## 🆘 Debugging

### Ver logs de webhooks en Mercado Pago:
1. Developers → **Webhooks**
2. Selecciona tu webhook
3. Click en **"Eventos"** para ver historial

### Ver logs en Vercel:
```bash
vercel logs
```

### Errores comunes:
| Problema | Solución |
|----------|----------|
| Webhook no recibe eventos | Verifica que la URL sea correcta (sin `/`) |
| Payment not found | El ID de pago no coincide con el guardado |
| Usuario no se crea | Verifica que SERVICE_ROLE_KEY sea válido |
| Pago aprobado pero estado no cambia | Webhook URL podría estar caída |

---

## 📞 Soporte Mercado Pago
- Docs: [https://www.mercadopago.com.ar/developers/es/docs](https://www.mercadopago.com.ar/developers/es/docs)
- Chat en Developers: Botón azul abajo a la derecha
