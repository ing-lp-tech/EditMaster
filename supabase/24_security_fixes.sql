-- ══════════════════════════════════════════════════════════════════
-- EDIT MASTER — CORRECCIONES DE SEGURIDAD
-- Ejecutar en: Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- FIX 1: RLS tabla `pagos` — reemplazar política débil por is_admin()
-- La política anterior usaba admin_permisos.email == jwt.email,
-- lo que podía ser bypasseado si la tabla admin_permisos era comprometida.
-- ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_view_pagos" ON public.pagos;

CREATE POLICY "admin_view_pagos" ON public.pagos
  FOR SELECT
  USING (public.is_admin());

-- También corregir INSERT: solo service role (webhook) puede insertar,
-- no cualquier usuario autenticado.
DROP POLICY IF EXISTS "admin_insert_pagos" ON public.pagos;

CREATE POLICY "admin_insert_pagos" ON public.pagos
  FOR INSERT
  WITH CHECK (public.is_admin());

-- La tabla pagos en este proyecto no tiene columna estudiante_id,
-- se vincula a usuarios a través de solicitud_id → solicitudes_inscripcion.
-- Por eso toda la gestión de pagos es solo para admins.
DROP POLICY IF EXISTS "pagos_select_own"   ON public.pagos;
DROP POLICY IF EXISTS "pagos_insert_own"   ON public.pagos;
DROP POLICY IF EXISTS "pagos_update_admin" ON public.pagos;
DROP POLICY IF EXISTS "pagos_delete_admin" ON public.pagos;

CREATE POLICY "pagos_update_admin"
  ON public.pagos FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "pagos_delete_admin"
  ON public.pagos FOR DELETE
  USING (public.is_admin());


-- ────────────────────────────────────────────────────────────────
-- FIX 2: Eliminar columna ultima_password (contraseña en texto plano)
-- Las contraseñas ya están hasheadas en auth.users.
-- Guardarlas en texto plano en perfiles es una violación de seguridad.
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.perfiles
  DROP COLUMN IF EXISTS ultima_password;


-- ────────────────────────────────────────────────────────────────
-- FIX 3: RLS en tabla solicitudes_inscripcion
-- Asegurar que los estudiantes no puedan leer solicitudes ajenas
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.solicitudes_inscripcion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "solicitudes_admin_all"    ON public.solicitudes_inscripcion;
DROP POLICY IF EXISTS "solicitudes_insert_anon"  ON public.solicitudes_inscripcion;

-- Solo admin puede ver todas las solicitudes
CREATE POLICY "solicitudes_admin_all"
  ON public.solicitudes_inscripcion FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Cualquiera puede insertar una solicitud (es el formulario público de inscripción)
-- pero no puede leer ni modificar las existentes
CREATE POLICY "solicitudes_insert_anon"
  ON public.solicitudes_inscripcion FOR INSERT
  WITH CHECK (true);


-- ────────────────────────────────────────────────────────────────
-- Verificación final
-- ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Verificar que ultima_password ya no existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'perfiles'
      AND column_name  = 'ultima_password'
  ) THEN
    RAISE EXCEPTION 'ERROR: la columna ultima_password sigue existiendo en perfiles';
  ELSE
    RAISE NOTICE 'OK: columna ultima_password eliminada correctamente';
  END IF;

  -- Verificar que is_admin() existe
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
  ) THEN
    RAISE NOTICE 'OK: función is_admin() encontrada';
  ELSE
    RAISE EXCEPTION 'ERROR: función is_admin() no encontrada — ejecutar 05_rls_politicas_seguridad.sql primero';
  END IF;
END;
$$;
