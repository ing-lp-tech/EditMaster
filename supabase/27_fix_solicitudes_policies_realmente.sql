-- Fix definitivo: las políticas REALES en producción para solicitudes_inscripcion
-- (verificado con pg_policies) no usaban public.is_admin() en absoluto — chequeaban
-- directo EXISTS (SELECT 1 FROM admin_permisos WHERE email = auth.jwt()->>'email').
-- El archivo 20_solicitudes_inscripcion.sql del repo describía otra cosa (USING
-- public.is_admin()), pero la base real tenía esta versión distinta aplicada
-- (probablemente editada a mano desde el dashboard en algún momento).
--
-- Como ing.lp.tech@gmail.com (super-admin) nunca fue agregado a admin_permisos,
-- esa cuenta veía 0 filas siempre en Estudiantes > Solicitudes Web, sin importar
-- el fix de is_admin() en 26 (esa función ni se llamaba acá).

DROP POLICY IF EXISTS "solicitudes_admin_select" ON public.solicitudes_inscripcion;
DROP POLICY IF EXISTS "solicitudes_admin_update" ON public.solicitudes_inscripcion;
DROP POLICY IF EXISTS "solicitudes_admin_delete" ON public.solicitudes_inscripcion;

CREATE POLICY "solicitudes_admin_select" ON public.solicitudes_inscripcion
  FOR SELECT USING (public.is_admin());

CREATE POLICY "solicitudes_admin_update" ON public.solicitudes_inscripcion
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "solicitudes_admin_delete" ON public.solicitudes_inscripcion
  FOR DELETE USING (public.is_admin());

-- Verificación
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'solicitudes_inscripcion';
