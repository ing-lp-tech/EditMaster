# Resumen de SQL para Supabase

Este archivo resume qué ejecutar en Supabase y qué hacer para que el backend funcione igual al proyecto actual.

## Archivo combinado

- `supabase/supabase-all.sql`
- Contiene todos los scripts SQL del directorio `supabase/` en el orden actual.
- Está listo para copiar y ejecutar en el SQL Editor de Supabase.

## Pasos recomendados

1. Abre `supabase/supabase-all.sql`.
2. Copia todo el contenido.
3. Abre el SQL Editor en tu proyecto de Supabase.
4. Pega el contenido en el editor.
5. Ejecuta el script.

## Qué incluye

- Creación y actualización de tablas: `cupones`, `pagos`, `certificados`, `recursos`, `finanzas_movimientos`, `finanzas_notas`, `costos_alumnos`, `carpetas`, `solicitudes_inscripcion`, entre otras.
- Políticas RLS para seguridad de `public.perfiles`, `public.pagos`, `public.cupones`, `public.recursos`, `public.certificados`, `public.finanzas_movimientos`, `public.carpetas`, `public.solicitudes_inscripcion`, `public.auditoria`, etc.
- Funciones y triggers: control de cupones, límite de pagos, cálculo de pagos parciales, normalización de datos.
- Configuración dinámica del curso y datos de app settings.
- Índices de búsqueda y mantenimiento de esquema.

## Verificaciones clave

- Verifica que la tabla `public.perfiles` exista.
- Asegúrate de que los emails de admin estén marcados con `rol = 'admin'`.
- Revisa que `public.app_settings` contenga las claves `precio_base`, `precio_tachado` y `fecha_inicio`.
- Comprueba que las políticas RLS se hayan aplicado sin errores.

## Nota importante de rebranding

El frontend del proyecto todavía no está reorientado a:

- edición de video
- redes sociales
- anuncios (ads)

Los archivos principales de frontend que requieren rebranding son:

- `src/pages/LandingPage.jsx`
- `src/pages/TemarioPage.jsx`
- `src/pages/VentajasPage.jsx`
- `src/pages/InscripcionPage.jsx`
- `src/components/Navbar.jsx`
- `src/pages/MoldesPage.jsx`
- `src/context/AppSettingsContext.jsx`
- `src/App.jsx`

También puede ser necesario revisar estilos y textos en:

- `src/index.css`
- `src/pages/LoginPage.jsx`
- `src/pages/InscripcionPage.jsx`

## Siguiente paso

- Ejecutar `supabase/supabase-all.sql` en el SQL Editor.
- Luego puedo hacer la conversión del frontend a contenido enfocado en edición de video y redes sociales.

---

Archivo generado automáticamente para ayudarte a ejecutar la configuración SQL de Supabase y avanzar con el rebranding del proyecto.
