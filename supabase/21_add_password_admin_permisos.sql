-- =================================================
-- Agregar columna de contraseña a admin_permisos
-- Ejecutar en: Supabase → SQL Editor → Run
-- =================================================

-- Agregar columna password si no existe
ALTER TABLE public.admin_permisos
ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '';

-- Actualizar columna para que no sea nula por defecto
ALTER TABLE public.admin_permisos
ALTER COLUMN password SET NOT NULL DEFAULT '';

-- Comentario explicativo
COMMENT ON COLUMN public.admin_permisos.password IS 'Contraseña temporal para el administrador, se envía por WhatsApp';
