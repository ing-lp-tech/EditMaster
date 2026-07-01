-- Separa dos niveles de acceso que hasta ahora compartían is_admin():
--
--   is_admin()       → super admin O sub-admin activo en admin_permisos.
--                       Se usa para lo que SÍ deben poder hacer los admins
--                       normales: estudiantes, finanzas, solicitudes, etc.
--
--   is_super_admin()  → SOLO ing.lp.tech@gmail.com.
--                       Se usa para lo que NO deben poder hacer los admins
--                       normales: ver Papelera/Auditoría, o cambiar el
--                       'rol' de un perfil (crear/promover otros admins).
--
-- admin_permisos ya estaba correctamente restringido a super admin
-- (política "super_admin_full_access"), no se toca acá.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT (auth.jwt() ->> 'email') = 'ing.lp.tech@gmail.com';
$$;

-- ── Papelera / Auditoría: solo super admin ────────────────────────────────
DROP POLICY IF EXISTS "audit_admin_select" ON public.auditoria;
CREATE POLICY "audit_admin_select" ON public.auditoria
  FOR SELECT USING (public.is_super_admin());

-- ── perfiles: solo super admin puede cambiar 'rol' (crear/promover admins).
-- Admins normales (is_admin()) siguen pudiendo cambiar 'activo' y el resto
-- de los datos de un alumno (eso es "dar de alta / gestionar alumnos").
CREATE OR REPLACE FUNCTION public.prevent_rol_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    NEW.rol := OLD.rol;
  END IF;
  IF NOT public.is_admin() THEN
    NEW.activo := OLD.activo;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_rol_on_update ON public.perfiles;
CREATE TRIGGER protect_rol_on_update
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_rol_change();

-- Verificación
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'auditoria';
