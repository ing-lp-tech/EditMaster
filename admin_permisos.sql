-- =================================================
-- SISTEMA DE PERMISOS PARA SUB-ADMINS
-- Ejecutar en: Supabase → SQL Editor → Run
-- =================================================

-- 1. Crear tabla de permisos por sección para sub-admins
CREATE TABLE IF NOT EXISTS public.admin_permisos (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT         NOT NULL UNIQUE,
  nombre              TEXT         NOT NULL DEFAULT '',
  -- Acceso por sección (true = puede ver, false = bloqueado)
  perm_dashboard      BOOLEAN      NOT NULL DEFAULT true,
  perm_estudiantes    BOOLEAN      NOT NULL DEFAULT true,
  perm_recursos       BOOLEAN      NOT NULL DEFAULT true,
  perm_pedidos        BOOLEAN      NOT NULL DEFAULT true,
  perm_finanzas       BOOLEAN      NOT NULL DEFAULT false,
  perm_cupones        BOOLEAN      NOT NULL DEFAULT false,
  perm_certificados   BOOLEAN      NOT NULL DEFAULT true,
  perm_tablero        BOOLEAN      NOT NULL DEFAULT true,
  perm_configuracion  BOOLEAN      NOT NULL DEFAULT false,
  -- Permiso de eliminación en las secciones que puede ver
  puede_eliminar      BOOLEAN      NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 2. Activar Row Level Security
ALTER TABLE public.admin_permisos ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS

-- Solo el super admin puede crear, editar y eliminar registros
CREATE POLICY "super_admin_full_access" ON public.admin_permisos
  FOR ALL
  TO authenticated
  USING   (auth.jwt() ->> 'email' = 'ing.lp.tech@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'ing.lp.tech@gmail.com');

-- Los sub-admins pueden leer su propia fila (para cargar sus permisos al iniciar sesión)
CREATE POLICY "sub_admin_read_own" ON public.admin_permisos
  FOR SELECT
  TO authenticated
  USING (lower(auth.jwt() ->> 'email') = lower(email));

-- 4. Permisos de acceso a la tabla
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_permisos TO authenticated;

-- 5. Función y trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_permisos_updated_at ON public.admin_permisos;
CREATE TRIGGER admin_permisos_updated_at
  BEFORE UPDATE ON public.admin_permisos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
