-- Fix: is_admin() solo revisaba perfiles.rol = 'admin', pero el frontend
-- (AuthContext.jsx) también reconoce como admin a cualquier email presente
-- y activo en admin_permisos (sub-admins). Como is_admin() es la función que
-- usan las políticas RLS de solicitudes_inscripcion, pagos, finanzas,
-- finanzas_state, tareas y cupones, cualquier sub-admin logueado veía esas
-- tablas completamente vacías (RLS los trataba como no-admin) aunque el
-- panel los dejara entrar sin problema.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid()
      AND rol = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.admin_permisos ap
    JOIN auth.users u ON u.email = ap.email
    WHERE u.id = auth.uid()
      AND ap.activo IS NOT FALSE
  );
$$;
