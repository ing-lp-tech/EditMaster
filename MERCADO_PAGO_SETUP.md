# ✅ Setup de Mercado Pago - Checklist Final

## 📋 Cambios Implementados

Estos archivos fueron modificados o creados:

### ✅ Nuevos Archivos
- `api/webhook-mercado-pago.js` - Recibe notificaciones de pagos desde MP
- `supabase/22_webhook_mercado_pago.sql` - Migración de BD
- `MERCADO_PAGO_INTEGRACION.md` - Documentación completa

### ✅ Archivos Modificados
- `api/create-preference.js` - Ahora incluye `external_reference`
- `src/pages/InscripcionPage.jsx` - Crea solicitud ANTES de generar preferencia
- `vite.config.js` - Agregado webhook a rutas de API local
- `src/context/AppSettingsContext.jsx` - Plan de Prueba ($100) soportado
- `src/pages/admin/ConfiguracionPage.jsx` - UI para activar Plan de Prueba
- `src/pages/LandingPage.jsx` - Muestra botón Plan de Prueba si activo
- `src/pages/admin/EstudiantesPage.jsx` - Excluye admins automáticamente

---

## 🔑 PASO 1: Configurar Credenciales

### 1.1 Obtener credenciales de Mercado Pago

**Para TESTING (Sandbox):**
1. Ve a https://www.mercadopago.com.ar/developers
2. Inicia sesión (crea cuenta si no tienes)
3. Ve a **Credenciales** → **Pruebas**
4. Copia:
   - `Public Key` (comienza con `APP_USR...`)
   - `Access Token` (token largo)

**Para PRODUCCIÓN:**
- Repite el mismo proceso pero selecciona **Producción** en lugar de Pruebas

### 1.2 Guardar en archivo local (`.env.local`)

Crea o edita `.env.local` en la raíz del proyecto:

```bash
# Mercado Pago - Sandbox (Testing)
VITE_MP_PUBLIC_KEY=APP_USR_xxxxxxxxxxxxxxxxxxxx
MP_ACCESS_TOKEN=APP_USR_xxxxxxxxxxxxxxxxxxxx

# Supabase (ya deberías tener)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxx
SUPABASE_SERVICE_ROLE_KEY=xxxx
```

**⚠️ IMPORTANTE:** Nunca commits `.env.local` a Git. Ya está en `.gitignore`.

### 1.3 Agregar a Vercel (Producción)

Cuando desplieges a Vercel:

1. Ve a tu proyecto en https://vercel.com/dashboard
2. **Settings** → **Environment Variables**
3. Agrega:
   ```
   MP_ACCESS_TOKEN = (tu token de PRODUCCIÓN)
   VITE_MP_PUBLIC_KEY = (tu public key de PRODUCCIÓN)
   ```

---

## 🗄️ PASO 2: Ejecutar Migración SQL

1. Ve a tu proyecto en Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. **SQL Editor** → **New Query**
4. Copia el contenido de `supabase/22_webhook_mercado_pago.sql`
5. Pega en el editor
6. Click **Run**

Debería decir "Query result: Success" ✓

---

## 🪝 PASO 3: Registrar Webhook en Mercado Pago

### Para TESTING (Sandbox)

1. Ve a https://www.mercadopago.com.ar/developers/panel
2. **Webhooks** → **Crear Webhook**
3. **URL:** `http://localhost:4173/api/webhook-mercado-pago`
4. **Eventos:** Selecciona `payment.created` y `payment.updated`
5. Click **Guardar**

### Para PRODUCCIÓN

Repite lo anterior pero con:
- **URL:** `https://editmaster.vercel.app/api/webhook-mercado-pago` (o tu dominio real)
- Usa las credenciales de PRODUCCIÓN

---

## 🧪 PASO 4: Testear en Local

### 4.1 Iniciar servidor

```bash
npm run dev
# O si prefieres con webhooks activos:
npm run dev:api
```

### 4.2 Abrir navegador

```
http://localhost:5173
```

### 4.3 Ir a inscripción

1. Haz click en **"Inscríbete"** en la landing
2. Llena el formulario
3. Selecciona un plan (ej: Pago Completo)
4. Click **"Procesar Pago"**

### 4.4 Usar tarjeta de prueba

Se abrirá el formulario de Mercado Pago. Usa:

**Para pago APROBADO:**
- Número: `4111 1111 1111 1111`
- Mes: `12`
- Año: `25` (o cualquier futuro)
- CVV: `123`
- Nombre: `TEST USER`

Completa y verás: "Pago Aprobado ✓"

### 4.5 Verificar en Supabase

1. Ve a tu proyecto en Supabase
2. **Table Editor** → `solicitudes_inscripcion`
3. Deberías ver una nueva fila con estado: **"pagado"**
4. Verifica que existe una fila en `perfiles` con rol: **"estudiante"**
5. Verifica que existe una fila en `finanzas` con el usuario nuevo

### 4.6 Ver logs

Abre la consola del navegador (`F12`) y busca logs como:
```
[INSCRIPCION] Solicitud creada: 123
[INSCRIPCION] Preferencia creada: 456
[MP_WEBHOOK] Evento recibido: payment
[MP_WEBHOOK] Payment Status: approved
[MP_WEBHOOK] ✅ Auth user creado: uuid
[MP_WEBHOOK] ✅ Perfil estudiante creado
[MP_WEBHOOK] ✅ Registro finanzas creado
```

---

## 🔍 Debugging

### Si el pago se aprueba pero NO se crea usuario:

1. **Verifica SERVICE_ROLE_KEY**
   - En `.env.local`, ¿está la variable `SUPABASE_SERVICE_ROLE_KEY`?
   - ¿Coincide con la que hay en Supabase Dashboard → Settings → API Keys?

2. **Mira los logs del webhook**
   - En Mercado Pago Developers → Webhooks → Tu webhook → Eventos
   - ¿Dice "Delivered" o "Failed"?
   - Si falló, ¿cuál fue el error?

3. **Ejecuta el SQL manualmente**
   ```sql
   SELECT * FROM solicitudes_inscripcion ORDER BY id DESC LIMIT 1;
   SELECT * FROM perfiles WHERE rol = 'estudiante' ORDER BY created_at DESC LIMIT 1;
   SELECT * FROM finanzas ORDER BY id DESC LIMIT 1;
   ```

### Si ve "Error al procesar el pago":

1. Abre **DevTools** (F12)
2. Ve a **Network** → **Fetch/XHR**
3. Busca la solicitud a `/api/create-preference`
4. Ve la **Response** para ver el error exacto

---

## ✅ Verificación Final

Ejecuta este SQL para verificar que todo está bien configurado:

```sql
-- 1. Verificar que solicitudes_inscripcion tiene las columnas
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name='solicitudes_inscripcion' 
ORDER BY column_name;

-- 2. Verificar tabla pagos existe
SELECT * FROM pagos LIMIT 1;

-- 3. Contar registros
SELECT 
  (SELECT COUNT(*) FROM solicitudes_inscripcion) as solicitudes,
  (SELECT COUNT(*) FROM perfiles WHERE rol='estudiante') as estudiantes,
  (SELECT COUNT(*) FROM finanzas) as registros_finanzas;
```

---

## 📞 Próximos Pasos (Opcional)

### Mejorar UX:

1. **Email de confirmación** - Enviar email tras pago aprobado
   - Usa SendGrid, Resend, o similar
   - Implementa en `webhook-mercado-pago.js` línea ~123

2. **Dashboard de estudiante** - Mostrar estado del pago
   - En `src/pages/student/` agregar vista de "Mi Inscripción"
   - Mostrar si pagó todo, pendiente, etc.

3. **Admin - Gestionar pagos** - Ver lista de pagos y estudiantes
   - Crear `src/pages/admin/PagosPage.jsx`
   - Conectar a tabla `pagos`

### Antes de pasar a PRODUCCIÓN:

1. ✅ Probar completamente con tarjetas fake
2. ✅ Verificar que usuarios se crean correctamente
3. ✅ Verificar que emails se reciben (si implementaste)
4. ✅ Cambiar credenciales a PRODUCCIÓN en Vercel
5. ✅ Probar en Vercel staging URL
6. ✅ Deploy a producción
7. ✅ Hacer un pago de prueba real (pequeño monto)
8. ✅ Verificar en BD que todo se registró

---

## 🎉 ¡Listo!

Tu integración de Mercado Pago está completa. ¿Dudas? Revisa:

- 📖 Docs completas: `MERCADO_PAGO_INTEGRACION.md`
- 🤖 Logs de webhook: Mercado Pago Developers → Webhooks
- 💾 BD: Supabase SQL Editor
- 🔧 Código: `/api/webhook-mercado-pago.js` y `src/pages/InscripcionPage.jsx`
