-- ============================================================================
-- Supabase SQL combinado
-- Ejecutar en el SQL Editor de Supabase en el orden presentado.
-- Cada sección corresponde a un archivo de migración en el proyecto.
-- ============================================================================

-- 00_fix_admins.sql
-- ══════════════════════════════════════════════════════════════════
-- PASO 1: CONFIGURAR ADMINS
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- Marcar los admins con rol = 'admin' en la tabla perfiles
UPDATE public.perfiles SET rol = 'admin'
WHERE email IN ('ing.lp.tech@gmail.com', 'cristian590@gmail.com');

-- Verificar (debería mostrar 2 filas con rol = 'admin')
SELECT id, nombre, email, rol FROM public.perfiles
WHERE email IN ('ing.lp.tech@gmail.com', 'cristian590@gmail.com');

-- 01_crear_tabla_cupones.sql
-- ══════════════════════════════════════════════════════
-- 1. TABLA CUPONES
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.cupones (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value       numeric NOT NULL CHECK (value > 0),
  description text,
  expires_at  timestamptz,
  max_uses    integer NOT NULL DEFAULT 0,
  used_count  integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  is_flash    boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- Índice único case-insensitive para evitar códigos duplicados
CREATE UNIQUE INDEX IF NOT EXISTS cupones_code_unique_idx
  ON public.cupones (UPPER(code));

-- 02_rls_cupones.sql
-- ══════════════════════════════════════════════════════
-- 2. RLS PARA CUPONES
-- ══════════════════════════════════════════════════════
ALTER TABLE public.cupones ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede leer (para validar cupones en la página
-- de inscripción sin necesidad de estar logueado)
CREATE POLICY "cupones_public_select"
  ON public.cupones FOR SELECT
  USING (true);

-- Solo admin puede crear cupones
CREATE POLICY "cupones_admin_insert"
  ON public.cupones FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- Solo admin puede editar cupones
CREATE POLICY "cupones_admin_update"
  ON public.cupones FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- Solo admin puede eliminar cupones
CREATE POLICY "cupones_admin_delete"
  ON public.cupones FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- 03_columnas_pagos.sql
-- ══════════════════════════════════════════════════════
-- 3. NUEVAS COLUMNAS EN LA TABLA PAGOS
-- ══════════════════════════════════════════════════════
ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS cupon_codigo       text,
  ADD COLUMN IF NOT EXISTS monto_original     numeric,
  ADD COLUMN IF NOT EXISTS descuento_aplicado numeric DEFAULT 0;

-- cupon_codigo       → código del cupón usado (NULL = sin descuento)
-- monto_original     → precio antes del descuento
-- descuento_aplicado → cuánto se ahorró el cliente

-- 04_funcion_incremento_cupones.sql
-- ══════════════════════════════════════════════════════
-- 4. FUNCIÓN PARA INCREMENTO ATÓMICO DE USOS DE CUPÓN
--    Evita race conditions si dos personas usan el
--    mismo cupón exactamente al mismo tiempo.
-- ══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.increment_cupon_used_count(cupon_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.cupones
  SET used_count = used_count + 1
  WHERE id = cupon_id;
$$;

-- 05_rls_politicas_seguridad.sql
-- ══════════════════════════════════════════════════════════════════
-- MOLDI TEX — POLÍTICAS DE SEGURIDAD (RLS) COMPLETAS
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ── Helper: función reutilizable para verificar si el usuario es admin ──────
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
  );
$$;

-- ══════════════════════════════════════════════════════════════════
-- TABLA: perfiles
-- Cada usuario solo ve y edita su propio perfil.
-- El admin puede ver y editar todos.
-- ══════════════════════════════════════════════════════════
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- Borrar políticas viejas si existen
DROP POLICY IF EXISTS "perfiles_select_own"    ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_select_admin"  ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_update_own"    ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_update_admin"  ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_insert_own"    ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_delete_admin"  ON public.perfiles;

-- SELECT: usuario ve solo el suyo; admin ve todos
CREATE POLICY "perfiles_select_own"
  ON public.perfiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

-- INSERT: solo el propio usuario (lo crea el trigger de auth, pero por si acaso)
CREATE POLICY "perfiles_insert_own"
  ON public.perfiles FOR INSERT
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- UPDATE: usuario actualiza el suyo (pero NO puede cambiar rol ni activo)
--         Admin puede actualizar cualquiera
CREATE POLICY "perfiles_update_own"
  ON public.perfiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (
    -- Si no es admin, no puede cambiar rol ni activo
    public.is_admin()
    OR (
      auth.uid() = id
      AND (SELECT rol FROM public.perfiles WHERE id = auth.uid()) = 'estudiante'
    )
  );

-- DELETE: solo admin
CREATE POLICY "perfiles_delete_admin"
  ON public.perfiles FOR DELETE
  USING (public.is_admin());


-- ══════════════════════════════════════════════════════════════════
-- TABLA: pagos
-- Estudiante puede ver y crear sus propios pagos.
-- Admin puede ver, crear y actualizar todos.
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pagos_select_own"    ON public.pagos;
DROP POLICY IF EXISTS "pagos_select_admin"  ON public.pagos;
DROP POLICY IF EXISTS "pagos_insert_own"    ON public.pagos;
DROP POLICY IF EXISTS "pagos_update_admin"  ON public.pagos;
DROP POLICY IF EXISTS "pagos_delete_admin"  ON public.pagos;

-- SELECT: estudiante ve los suyos; admin ve todos
CREATE POLICY "pagos_select_own"
  ON public.pagos FOR SELECT
  USING (auth.uid() = estudiante_id OR public.is_admin());

-- INSERT: el estudiante recién inscripto puede crear su propio pago
CREATE POLICY "pagos_insert_own"
  ON public.pagos FOR INSERT
  WITH CHECK (auth.uid() = estudiante_id OR public.is_admin());

-- UPDATE: solo admin puede confirmar / cambiar estado de pagos
CREATE POLICY "pagos_update_admin"
  ON public.pagos FOR UPDATE
  USING (public.is_admin());

-- DELETE: solo admin
CREATE POLICY "pagos_delete_admin"
  ON public.pagos FOR DELETE
  USING (public.is_admin());


-- ══════════════════════════════════════════════════════════════════
-- TABLA: finanzas
-- Solo admin puede ver y gestionar los movimientos financieros.
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE public.finanzas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finanzas_admin_all" ON public.finanzas;

CREATE POLICY "finanzas_admin_all"
  ON public.finanzas FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ══════════════════════════════════════════════════════════════════
-- TABLA: finanzas_state (snapshot JSONB del estado de finanzas)
-- Solo admin.
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE public.finanzas_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finanzas_state_admin_all" ON public.finanzas_state;

CREATE POLICY "finanzas_state_admin_all"
  ON public.finanzas_state FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ══════════════════════════════════════════════════════════════════
-- TABLA: tareas (Kanban)
-- Solo admin puede gestionar tareas.
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tareas_admin_all" ON public.tareas;

CREATE POLICY "tareas_admin_all"
  ON public.tareas FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ══════════════════════════════════════════════════════════════════
-- TABLA: app_settings
-- Lectura pública (test mode lo lee la página de inscripción sin login).
-- Escritura solo admin.
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_public_select" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_admin_write"   ON public.app_settings;

-- Cualquiera puede leer configuración pública
CREATE POLICY "app_settings_public_select"
  ON public.app_settings FOR SELECT
  USING (true);

-- Solo admin puede escribir configuración
CREATE POLICY "app_settings_admin_write"
  ON public.app_settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ══════════════════════════════════════════════════════════════════
-- TABLA: cupones (ya tiene RLS, reforzamos)
-- ══════════════════════════════════════════════════════════════════
-- Ya configurada en 02_rls_cupones.sql. Verificamos:
DROP POLICY IF EXISTS "cupones_public_select"  ON public.cupones;
DROP POLICY IF EXISTS "cupones_admin_insert"   ON public.cupones;
DROP POLICY IF EXISTS "cupones_admin_update"   ON public.cupones;
DROP POLICY IF EXISTS "cupones_admin_delete"   ON public.cupones;

CREATE POLICY "cupones_public_select"
  ON public.cupones FOR SELECT USING (true);

CREATE POLICY "cupones_admin_insert"
  ON public.cupones FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "cupones_admin_update"
  ON public.cupones FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "cupones_admin_delete"
  ON public.cupones FOR DELETE
  USING (public.is_admin());


-- ══════════════════════════════════════════════════════════════════
-- FUNCIÓN: prevenir que estudiantes cambien su propio rol
-- Trigger que se ejecuta antes de UPDATE en perfiles
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.prevent_rol_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si el usuario que hace el UPDATE no es admin
  IF NOT public.is_admin() THEN
    -- Restaurar campos protegidos al valor original
    NEW.rol    := OLD.rol;
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


-- ══════════════════════════════════════════════════════════════════
-- FUNCIÓN: rate limiting básico en pagos
-- Evita que un mismo email cree más de 5 pagos en 1 hora
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.check_pago_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.pagos
  WHERE estudiante_id = NEW.estudiante_id
    AND created_at > NOW() - INTERVAL '1 hour';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Demasiados intentos de pago. Esperá un momento antes de intentar de nuevo.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rate_limit_pagos ON public.pagos;
CREATE TRIGGER rate_limit_pagos
  BEFORE INSERT ON public.pagos
  FOR EACH ROW
  EXECUTE FUNCTION public.check_pago_rate_limit();


-- ══════════════════════════════════════════════════════════════════
-- GRANT permisos explícitos al rol anon (usuarios no logueados)
-- Solo pueden leer cupones y app_settings (necesario para validar
-- cupones y leer test_mode antes de loguearse).
-- ══════════════════════════════════════════════════════════════════
GRANT SELECT ON public.cupones     TO anon;
GRANT SELECT ON public.app_settings TO anon;

-- ══════════════════════════════════════════════════════════════════
-- GRANT permisos al rol authenticated (usuarios logueados)
-- ══════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT ON public.pagos    TO authenticated;
GRANT SELECT, UPDATE ON public.perfiles TO authenticated;
GRANT SELECT         ON public.cupones  TO authenticated;

-- 06_tabla_certificados.sql
-- ══════════════════════════════════════════════════════════════════
-- MOLDI TEX — TABLA CERTIFICADOS
-- Registra cada certificado emitido a un estudiante
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.certificados (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  estudiante_id         uuid REFERENCES public.perfiles(id) ON DELETE CASCADE NOT NULL,
  nombre_en_certificado text NOT NULL,
  fecha_emision         date NOT NULL,
  firmante1             text,
  firmante2             text,
  cargo1                text,
  cargo2                text,
  emitido_por           uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at            timestamptz DEFAULT now() NOT NULL
);

-- Índice para buscar certificados por estudiante
CREATE INDEX IF NOT EXISTS certificados_estudiante_id_idx ON public.certificados (estudiante_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.certificados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "certificados_admin_all"   ON public.certificados;
DROP POLICY IF EXISTS "certificados_select_own"  ON public.certificados;

-- Admin puede hacer todo
CREATE POLICY "certificados_admin_all"
  ON public.certificados FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- El propio estudiante puede ver sus certificados (útil para el portal)
CREATE POLICY "certificados_select_own"
  ON public.certificados FOR SELECT
  USING (auth.uid() = estudiante_id);

-- Permisos para el rol authenticated
GRANT SELECT ON public.certificados TO authenticated;

-- 07_tabla_recursos.sql
-- ══════════════════════════════════════════════════════════════════
-- MOLDI TEX — TABLA RECURSOS (videos, PDFs, links)
-- Los alumnos activos los ven en su portal
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.recursos (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo      text    NOT NULL,
  descripcion text,
  tipo        text    NOT NULL CHECK (tipo IN ('video', 'pdf', 'link')),
  url         text    NOT NULL,
  modulo      int,
  orden       int     DEFAULT 0,
  activo      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS recursos_modulo_orden_idx ON public.recursos (modulo, orden);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.recursos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recursos_admin_all"            ON public.recursos;
DROP POLICY IF EXISTS "recursos_select_authenticated"  ON public.recursos;

-- Admin gestiona todo
CREATE POLICY "recursos_admin_all"
  ON public.recursos FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Solo alumnos ACTIVOS pueden leer recursos activos
CREATE POLICY "recursos_select_authenticated"
  ON public.recursos FOR SELECT
  USING (
    activo = true
    AND EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid()
        AND rol = 'estudiante'
        AND activo = true
    )
  );

-- Admin puede gestionar todo, alumnos autenticados solo leer los activos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recursos TO authenticated;

-- 08_fix_rls_kanban.sql
-- ══════════════════════════════════════════════════════════════════
-- FIX: Habilitar RLS en tablas Kanban
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- columnas_kanban: ya tiene policy, solo falta activar RLS
ALTER TABLE public.columnas_kanban ENABLE ROW LEVEL SECURITY;

-- kanban_state: activar RLS + crear policy de admin
ALTER TABLE public.kanban_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_state_admin_all" ON public.kanban_state;
CREATE POLICY "kanban_state_admin_all"
  ON public.kanban_state FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 09_tabla_finanzas.sql
-- ============================================================
-- 09_tabla_finanzas.sql
-- Tabla de movimientos financieros (ingresos y egresos)
-- con soporte para deudas integradas.
-- ============================================================

-- 1. Eliminar tabla vieja de blob si existía
DROP TABLE IF EXISTS public.finanzas_state;

-- 2. Crear tabla de movimientos
CREATE TABLE IF NOT EXISTS public.finanzas_movimientos (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('ingreso', 'egreso')),
  categoria     text not null,
  descripcion   text not null,
  monto         numeric(12, 2) not null check (monto >= 0),
  fecha         date not null,
  metodo        text default 'Transferencia bancaria',
  cobrador      text,
  beneficiario  text,
  notas         text,

  -- Deuda integrada:
  -- ingreso + tiene_deuda = "me deben" (cobro pendiente)
  -- egreso  + tiene_deuda = "les debo" (pago pendiente)
  tiene_deuda   boolean not null default false,
  deuda_estado  text check (deuda_estado in ('pendiente', 'pagado')) default 'pendiente',

  comprobantes  text[] default '{}',
  created_at    timestamptz default now()
);

-- 3. Índices útiles
CREATE INDEX IF NOT EXISTS idx_finanzas_tipo  ON public.finanzas_movimientos (tipo);
CREATE INDEX IF NOT EXISTS idx_finanzas_fecha ON public.finanzas_movimientos (fecha desc);
CREATE INDEX IF NOT EXISTS idx_finanzas_deuda ON public.finanzas_movimientos (tiene_deuda) WHERE tiene_deuda = true;

-- 4. RLS
ALTER TABLE public.finanzas_movimientos ENABLE ROW LEVEL SECURITY;

-- Permite acceso total a usuarios autenticados (admin)
CREATE POLICY "Acceso total a autenticados"
  ON public.finanzas_movimientos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Si querés también acceso anon (ej. anon key desde frontend sin auth):
CREATE POLICY "Acceso total anon"
  ON public.finanzas_movimientos
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- 5. Bucket para comprobantes (ejecutar solo si no existe)
-- Ir a Storage en Supabase y crear bucket "comprobantes" como público,
-- o ejecutar esto si tenés permisos de service_role:
-- insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', true) on conflict do nothing;

-- 10_finanzas_pagos_parciales.sql
-- ============================================================
-- 10_finanzas_pagos_parciales.sql
-- Agrega soporte de pagos parciales a finanzas_movimientos:
--   · monto       = precio total acordado / facturado
--   · pagos       = JSONB array de abonos [{id, fecha, monto, metodo, notas}]
--   · monto_pagado = calculado automáticamente por trigger (suma de pagos)
--   · deuda_restante = monto - monto_pagado  (trigger)
--   · deuda_estado  = 'pendiente' | 'pagado'  (trigger, auto al llegar a 0)
-- ============================================================

-- 1. Nuevas columnas (seguro si ya corriste 09)
ALTER TABLE public.finanzas_movimientos
  ADD COLUMN IF NOT EXISTS pagos          jsonb           not null default '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS monto_pagado   numeric(12, 2)  not null default 0,
  ADD COLUMN IF NOT EXISTS deuda_restante numeric(12, 2)  not null default 0;

-- 2. Backfill columnas existentes
--    · Registros sin deuda → monto_pagado = monto, deuda_restante = 0
--    · Registros con deuda (tiene_deuda = true) → monto_pagado = 0, deuda_restante = monto
UPDATE public.finanzas_movimientos
SET
  monto_pagado   = CASE WHEN tiene_deuda THEN 0           ELSE monto END,
  deuda_restante = CASE WHEN tiene_deuda THEN monto       ELSE 0     END
WHERE monto_pagado = 0;

-- 3. Función del trigger
CREATE OR REPLACE FUNCTION public.fn_calcular_deuda_pagos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
declare
  total_pagado numeric(12, 2);
begin
  if new.tiene_deuda then
    -- Suma todos los abonos del array JSONB
    select coalesce(sum((p ->> 'monto')::numeric), 0)
    into   total_pagado
    from   jsonb_array_elements(coalesce(new.pagos, '[]'::jsonb)) as p;

    new.monto_pagado   := total_pagado;
    new.deuda_restante := greatest(coalesce(new.monto, 0) - total_pagado, 0);

    -- Pasa a pagado automáticamente cuando se cubre el total
    if new.deuda_restante = 0 and new.monto > 0 then
      new.deuda_estado := 'pagado';
    else
      new.deuda_estado := 'pendiente';
    end if;
  else
    -- Sin deuda: todo se considera pagado
    new.monto_pagado   := coalesce(new.monto, 0);
    new.deuda_restante := 0;
  end if;

  return new;
end;
$$;

-- 4. Trigger (antes de insert/update)
DROP TRIGGER IF EXISTS trg_calcular_deuda_pagos ON public.finanzas_movimientos;
CREATE TRIGGER trg_calcular_deuda_pagos
  BEFORE INSERT OR UPDATE
  ON public.finanzas_movimientos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_calcular_deuda_pagos();

-- 5. Re-ejecutar trigger sobre filas existentes para que todo cuadre
UPDATE public.finanzas_movimientos SET monto = monto;

-- 6. Índice para consultas de deuda pendiente
CREATE INDEX IF NOT EXISTS idx_finanzas_deuda_restante
  ON public.finanzas_movimientos (deuda_restante)
  WHERE tiene_deuda = true;

-- 11_fix_finanzas_trigger.sql
-- ============================================================
-- 11_fix_finanzas_trigger.sql
-- Script seguro: corre aunque ya hayas corrido 09 y 10.
-- Asegura que todas las columnas, trigger y RLS estén correctos.
-- ============================================================

-- 1. Crear tabla si no existe (con TODAS las columnas)
CREATE TABLE IF NOT EXISTS public.finanzas_movimientos (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('ingreso', 'egreso')),
  categoria     text not null,
  descripcion   text not null,
  monto         numeric(12, 2) not null check (monto >= 0),
  fecha         date not null,
  metodo        text default 'Transferencia bancaria',
  cobrador      text,
  beneficiario  text,
  notas         text,
  tiene_deuda   boolean not null default false,
  deuda_estado  text check (deuda_estado in ('pendiente', 'pagado')) default 'pendiente',
  pagos         jsonb not null default '[]'::jsonb,
  monto_pagado  numeric(12, 2) not null default 0,
  deuda_restante numeric(12, 2) not null default 0,
  comprobantes  text[] default '{}',
  created_at    timestamptz default now()
);

-- 2. Agregar columnas faltantes (sin error si ya existen)
ALTER TABLE public.finanzas_movimientos
  ADD COLUMN IF NOT EXISTS pagos          jsonb          not null default '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS monto_pagado   numeric(12,2)  not null default 0,
  ADD COLUMN IF NOT EXISTS deuda_restante numeric(12,2)  not null default 0,
  ADD COLUMN IF NOT EXISTS beneficiario   text,
  ADD COLUMN IF NOT EXISTS cobrador       text;

-- 3. Drop + Recrear trigger para garantizar que está actualizado
DROP TRIGGER IF EXISTS trg_calcular_deuda_pagos ON public.finanzas_movimientos;
DROP FUNCTION IF EXISTS public.fn_calcular_deuda_pagos();
DROP TRIGGER IF EXISTS trg_calcular_deuda ON public.finanzas_movimientos;
DROP FUNCTION IF EXISTS public.fn_calcular_deuda();

-- 4. Función del trigger (versión robusta)
CREATE OR REPLACE FUNCTION public.fn_calcular_deuda_pagos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
declare
  v_total_pagado numeric(12, 2) := 0;
  v_monto        numeric(12, 2);
begin
  v_monto := coalesce(new.monto, 0);

  if new.tiene_deuda then
    -- Suma todos los abonos del array JSONB
    select coalesce(
      sum( (p ->> 'monto')::numeric ),
      0
    )
    into v_total_pagado
    from jsonb_array_elements( coalesce(new.pagos, '[]'::jsonb) ) as p;

    new.monto_pagado   := v_total_pagado;
    new.deuda_restante := greatest(v_monto - v_total_pagado, 0);

    -- Auto-saldo cuando se cubre el total
    if new.deuda_restante = 0 and v_monto > 0 then
      new.deuda_estado := 'pagado';
    else
      new.deuda_estado := 'pendiente';
    end if;

  else
    -- Pago completo al contado
    new.monto_pagado   := v_monto;
    new.deuda_restante := 0;
    new.deuda_estado   := 'pendiente'; -- no aplica para no-deudas
  end if;

  return new;
end;
$$;

-- 5. Crear el trigger
CREATE TRIGGER trg_calcular_deuda_pagos
  BEFORE INSERT OR UPDATE
  ON public.finanzas_movimientos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_calcular_deuda_pagos();

-- 6. Recalcular TODAS las filas existentes con el trigger nuevo
--    (esto también corrige registros viejos que tenían monto_pagado = 0)
UPDATE public.finanzas_movimientos
SET updated_at = coalesce(updated_at, now())  -- dummy update para disparar el trigger
WHERE true;

-- Si la columna updated_at no existe, usá esta línea en su lugar:
-- update public.finanzas_movimientos set monto = monto where true;

-- 7. RLS (seguro aunque ya exista)
ALTER TABLE public.finanzas_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total a autenticados" on public.finanzas_movimientos;
DROP POLICY IF EXISTS "Acceso total anon"            on public.finanzas_movimientos;

CREATE POLICY "Acceso total a autenticados"
  on public.finanzas_movimientos for all to authenticated
  using (true) with check (true);

CREATE POLICY "Acceso total anon"
  on public.finanzas_movimientos for all to anon
  using (true) with check (true);

-- 8. Índices
CREATE INDEX IF NOT EXISTS idx_finanzas_tipo           on public.finanzas_movimientos (tipo);
CREATE INDEX IF NOT EXISTS idx_finanzas_fecha          on public.finanzas_movimientos (fecha desc);
CREATE INDEX IF NOT EXISTS idx_finanzas_deuda          on public.finanzas_movimientos (tiene_deuda) where tiene_deuda = true;
CREATE INDEX IF NOT EXISTS idx_finanzas_deuda_restante on public.finanzas_movimientos (deuda_restante) where tiene_deuda = true;

-- 9. Verificación: muestra el estado actual
SELECT
  descripcion,
  monto          as "precio_total",
  monto_pagado   as "pagado",
  deuda_restante as "restante",
  deuda_estado,
  jsonb_array_length(pagos) as "num_abonos"
from public.finanzas_movimientos
order by created_at desc
limit 10;

-- 12_verificar_y_recalcular.sql
-- ============================================================
-- 12_verificar_y_recalcular.sql
-- Corre este script DESPUÉS del 11.
-- El 11 fallaba en el paso 6 porque no existe columna updated_at.
-- Este script lo corrige y verifica que todo esté funcionando.
-- ============================================================

-- 1. Recalcular TODAS las filas existentes disparando el trigger
--    (usa monto = monto que siempre funciona)
UPDATE public.finanzas_movimientos
SET monto = monto;

-- 2. Verificar que el trigger existe
SELECT
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'finanzas_movimientos'
  AND trigger_schema = 'public';

-- 3. Ver estado actual de todos los registros
SELECT
  descripcion,
  tipo,
  monto          as "total",
  monto_pagado   as "pagado",
  deuda_restante as "restante",
  deuda_estado,
  tiene_deuda,
  jsonb_array_length(coalesce(pagos, '[]'::jsonb)) as "num_abonos"
FROM public.finanzas_movimientos
ORDER BY created_at desc;

-- 13_app_settings_curso.sql
-- ══════════════════════════════════════════════════════════════════
-- MOLDI TEX — Configuración dinámica del curso
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- Paso 1: convertir la columna value de boolean a text
-- (el valor existente true/false queda como 'true'/'false')
ALTER TABLE public.app_settings
  ALTER COLUMN value TYPE text USING value::text;

-- Paso 2: insertar configuración por defecto
INSERT INTO public.app_settings (id, value)
VALUES
  ('precio_base',    '400000'),
  ('precio_tachado', '650000'),
  ('fecha_inicio',   '13 de Marzo')
ON CONFLICT (id) DO NOTHING;

-- 14_cursadas_y_cobrador.sql
-- ══════════════════════════════════════════════════════════════════
-- MOLDI TEX — Cursadas + cobrador por abono
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Columna cursada en perfiles ──────────────────────────────────
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS cursada TEXT DEFAULT 'Cursada 1';

-- Todos los estudiantes existentes van a Cursada 1
UPDATE public.perfiles
  SET cursada = 'Cursada 1'
  WHERE rol = 'estudiante' AND (cursada IS NULL OR cursada = '');

-- ── Nota sobre cobrador por abono ───────────────────────────────────
-- No requiere cambio en la DB.
-- El campo "cobrador" se agrega dentro del JSONB de cada pago
-- en la columna finanzas_movimientos.pagos (array de objetos).
-- El trigger existente solo suma el campo "monto" → no se ve afectado.
-- ════════════════════════════════════════════════════════════════════

-- 15_add_alumno_data.sql
-- ============================================================
-- 15_add_alumno_data.sql
-- EJECUTAR EN: Supabase → SQL Editor
--
-- Agrega la columna alumno_data (JSONB) a finanzas_movimientos
-- para guardar los datos del alumno al registrar una Matrícula.
-- Script 100% seguro (no rompe nada si ya existe).
-- ============================================================

-- 1. Agregar columna alumno_data (si no existe)
ALTER TABLE public.finanzas_movimientos
  ADD COLUMN IF NOT EXISTS alumno_data JSONB DEFAULT NULL;

-- 2. Comentario descriptivo
COMMENT ON COLUMN public.finanzas_movimientos.alumno_data IS
  'Datos del alumno { nombre, apellido, email, telefono, cursada } — solo se llena cuando categoria = Matrícula';

-- 3. Índice para consultas rápidas desde EstudiantesPage
--    (filtra rápido los movimientos con alumno_data relleno)
CREATE INDEX IF NOT EXISTS idx_finanzas_alumno_data
  ON public.finanzas_movimientos (categoria)
  WHERE alumno_data IS NOT NULL;

-- 4. Recargar el schema cache de PostgREST para que la API REST
--    reconozca la nueva columna sin necesidad de reiniciar
NOTIFY pgrst, 'reload schema';

-- 5. Verificación: muestra las columnas actuales de la tabla
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'finanzas_movimientos'
ORDER BY ordinal_position;

-- 16_normalizar_cursadas.sql
-- ============================================================
-- 16_normalizar_cursadas.sql
-- EJECUTAR EN: Supabase → SQL Editor
--
-- Normaliza todos los valores de cursada al formato "Cursada N"
-- en las tablas perfiles y finanzas_movimientos.alumno_data
-- ============================================================

-- ── 1. Normalizar perfiles.cursada ────────────────────────────────────────────
UPDATE public.perfiles
SET cursada = CASE
  -- "1", "2", " 3 " → "Cursada 1", "Cursada 2", "Cursada 3"
  WHEN TRIM(cursada) ~ '^[0-9]+$'
    THEN 'Cursada ' || TRIM(cursada)
  -- "cursada 2", "Cursada2", "CURSADA  2" → "Cursada 2"
  WHEN TRIM(cursada) ~* '^cursada\s*[0-9]+$'
    THEN 'Cursada ' || REGEXP_REPLACE(TRIM(cursada), '[^0-9]', '', 'g')
  ELSE TRIM(cursada)
END
WHERE cursada IS NOT NULL AND cursada <> '';

-- ── 2. Normalizar alumno_data.cursada en finanzas_movimientos ─────────────────
UPDATE public.finanzas_movimientos
SET alumno_data = jsonb_set(
  alumno_data,
  '{cursada}',
  to_jsonb(
    CASE
      WHEN TRIM(alumno_data->>'cursada') ~ '^[0-9]+$'
        THEN 'Cursada ' || TRIM(alumno_data->>'cursada')
      WHEN TRIM(alumno_data->>'cursada') ~* '^cursada\s*[0-9]+$'
        THEN 'Cursada ' || REGEXP_REPLACE(TRIM(alumno_data->>'cursada'), '[^0-9]', '', 'g')
      ELSE TRIM(alumno_data->>'cursada')
    END
  )
)
WHERE alumno_data IS NOT NULL
  AND alumno_data ? 'cursada'
  AND alumno_data->>'cursada' IS NOT NULL;

-- ── 3. Verificación ───────────────────────────────────────────────────────────
SELECT 'perfiles' AS tabla, cursada, COUNT(*) AS cantidad
FROM public.perfiles
WHERE cursada IS NOT NULL
GROUP BY cursada
UNION ALL
SELECT 'finanzas' AS tabla, alumno_data->>'cursada', COUNT(*)
FROM public.finanzas_movimientos
WHERE alumno_data->>'cursada' IS NOT NULL
GROUP BY alumno_data->>'cursada'
ORDER BY tabla, cursada;

-- 17_tabla_finanzas_notas.sql
-- ============================================================
-- 17_tabla_finanzas_notas.sql
-- EJECUTAR EN: Supabase → SQL Editor
--
-- Tabla para anotaciones, recordatorios y ajustes de cuentas
-- dentro de la sección Finanzas del panel admin.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.finanzas_notas (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha           DATE         NOT NULL DEFAULT CURRENT_DATE,
  autor           TEXT         NOT NULL,
  texto           TEXT         NOT NULL,
  comprobante_url TEXT         DEFAULT NULL,
  created_at      TIMESTAMPTZ  DEFAULT now()
);

-- Índice para ordenar por fecha descendente
CREATE INDEX IF NOT EXISTS idx_finanzas_notas_fecha
  ON public.finanzas_notas (fecha DESC);

-- Acceso: el anon key puede leer/escribir (la seguridad la maneja el panel admin)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finanzas_notas TO authenticated;
GRANT SELECT, INSERT, DELETE         ON public.finanzas_notas TO anon;

-- Notificar a PostgREST para que reconozca la nueva tabla
NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT 'Tabla finanzas_notas creada correctamente ✓' AS status;

-- 18_costos_alumnos.sql
-- ============================================================
-- 18_costos_alumnos.sql
-- EJECUTAR EN: Supabase → SQL Editor
-- Tabla de calculadora de costos por alumno
-- ============================================================

CREATE TABLE IF NOT EXISTS public.costos_alumnos (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id       UUID          NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  nombre_proyecto     TEXT          NOT NULL,
  fecha               DATE          NOT NULL DEFAULT CURRENT_DATE,
  unidad_tela         TEXT          NOT NULL DEFAULT 'metros',
  cantidad_prendas    NUMERIC(10,2) NOT NULL DEFAULT 1,
  fabric_qty          NUMERIC(12,2) NOT NULL DEFAULT 0,
  fabric_price        NUMERIC(12,2) NOT NULL DEFAULT 0,
  costo_costura       NUMERIC(12,2) NOT NULL DEFAULT 0,
  detalle_insumos     JSONB         NOT NULL DEFAULT '[]',
  margen_ganancia     NUMERIC(5,2)  NOT NULL DEFAULT 30,
  -- Resultados calculados (guardados para historial)
  costo_tela_total    NUMERIC(14,2) NOT NULL DEFAULT 0,
  costo_costura_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  costo_insumos_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  costo_total         NUMERIC(14,2) NOT NULL DEFAULT 0,
  costo_unitario      NUMERIC(14,2) NOT NULL DEFAULT 0,
  precio_venta        NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ   DEFAULT now(),
  updated_at          TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_costos_alumnos_estudiante
  ON public.costos_alumnos (estudiante_id, created_at DESC);

-- RLS: cada alumno ve/edita solo los suyos; admin ve todos
ALTER TABLE public.costos_alumnos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "costos_select" ON public.costos_alumnos;
DROP POLICY IF EXISTS "costos_insert" ON public.costos_alumnos;
DROP POLICY IF EXISTS "costos_update" ON public.costos_alumnos;
DROP POLICY IF EXISTS "costos_delete" ON public.costos_alumnos;

CREATE POLICY "costos_select" ON public.costos_alumnos FOR SELECT
  USING (auth.uid() = estudiante_id OR public.is_admin());

CREATE POLICY "costos_insert" ON public.costos_alumnos FOR INSERT
  WITH CHECK (auth.uid() = estudiante_id OR public.is_admin());

CREATE POLICY "costos_update" ON public.costos_alumnos FOR UPDATE
  USING (auth.uid() = estudiante_id OR public.is_admin());

CREATE POLICY "costos_delete" ON public.costos_alumnos FOR DELETE
  USING (auth.uid() = estudiante_id OR public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.costos_alumnos TO authenticated;

NOTIFY pgrst, 'reload schema';

SELECT 'Tabla costos_alumnos creada correctamente ✓' AS status;

-- 19_papelera_auditoria.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 19: Papelera de reciclaje + Auditoría
-- Agrega columnas de borrado lógico a todas las tablas relevantes
-- y crea la tabla de auditoría de acciones.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Borrado lógico en perfiles (estudiantes) ──────────────────────────────────
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS eliminado_en        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eliminado_por       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS eliminado_por_email TEXT;

-- ── Borrado lógico en cupones ─────────────────────────────────────────────────
ALTER TABLE cupones
  ADD COLUMN IF NOT EXISTS eliminado_en        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eliminado_por       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS eliminado_por_email TEXT;

-- ── Borrado lógico en recursos ────────────────────────────────────────────────
ALTER TABLE recursos
  ADD COLUMN IF NOT EXISTS eliminado_en        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eliminado_por       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS eliminado_por_email TEXT;

-- ── Borrado lógico en finanzas_movimientos ────────────────────────────────────
ALTER TABLE finanzas_movimientos
  ADD COLUMN IF NOT EXISTS eliminado_en        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eliminado_por       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS eliminado_por_email TEXT;

-- ── Borrado lógico en finanzas_notas ─────────────────────────────────────────
ALTER TABLE finanzas_notas
  ADD COLUMN IF NOT EXISTS eliminado_en        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eliminado_por       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS eliminado_por_email TEXT;

-- ── Borrado lógico en costos_alumnos ─────────────────────────────────────────
ALTER TABLE costos_alumnos
  ADD COLUMN IF NOT EXISTS eliminado_en        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eliminado_por       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS eliminado_por_email TEXT;

-- ── Tabla de auditoría ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auditoria (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tabla_origen        TEXT        NOT NULL,
  registro_id         TEXT        NOT NULL,
  accion              TEXT        NOT NULL CHECK (accion IN ('eliminacion', 'modificacion', 'restauracion', 'creacion')),
  descripcion         TEXT,
  datos_anteriores    JSONB,
  datos_nuevos        JSONB,
  realizado_por       UUID        REFERENCES auth.users(id),
  realizado_por_email TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

-- Solo admin puede ver la auditoría
CREATE POLICY "admin_ver_auditoria" ON auditoria
  FOR SELECT USING (public.is_admin());

-- Cualquier usuario autenticado puede insertar (para registrar sus propias acciones)
CREATE POLICY "auth_registrar_auditoria" ON auditoria
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 20_carpetas.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 20: Carpetas de recursos
-- Agrupa recursos en carpetas con nombres personalizados.
-- Migra automáticamente los módulos existentes a carpetas.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Tabla carpetas ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.carpetas (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     TEXT        NOT NULL,
  orden      INT         DEFAULT 0,
  activo     BOOLEAN     DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.carpetas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_carpetas"  ON public.carpetas;
DROP POLICY IF EXISTS "auth_ver_carpetas"   ON public.carpetas;

CREATE POLICY "admin_all_carpetas" ON public.carpetas
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "auth_ver_carpetas" ON public.carpetas
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid() AND rol = 'estudiante' AND activo = true
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carpetas TO authenticated;

-- ── 2. Columna carpeta_id en recursos ────────────────────────────────────────
ALTER TABLE public.recursos
  ADD COLUMN IF NOT EXISTS carpeta_id UUID REFERENCES public.carpetas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS recursos_carpeta_id_idx ON public.recursos (carpeta_id, orden);

-- ── 3. Actualizar CHECK para agregar tipo 'imagen' ───────────────────────────
ALTER TABLE public.recursos DROP CONSTRAINT IF EXISTS recursos_tipo_check;
ALTER TABLE public.recursos
  ADD CONSTRAINT recursos_tipo_check CHECK (tipo IN ('video', 'pdf', 'link', 'imagen'));

-- ── 4. Migrar módulos existentes → carpetas ──────────────────────────────────
DO $$
DECLARE
  m   INT;
  cid UUID;
BEGIN
  FOR m IN
    SELECT DISTINCT modulo FROM public.recursos WHERE modulo IS NOT NULL ORDER BY modulo
  LOOP
    SELECT id INTO cid FROM public.carpetas WHERE nombre = 'Módulo ' || m;

    IF cid IS NULL THEN
      INSERT INTO public.carpetas (nombre, orden)
      VALUES ('Módulo ' || m, m)
      RETURNING id INTO cid;
    END IF;

    UPDATE public.recursos
    SET carpeta_id = cid
    WHERE modulo = m AND carpeta_id IS NULL;
  END LOOP;
END $$;

-- 20_solicitudes_inscripcion.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 20: Solicitudes de inscripción web
-- Almacena los datos del formulario de inscripción ANTES de verificar el pago.
-- El admin verifica manualmente en MercadoPago y luego da de alta al alumno.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS solicitudes_inscripcion (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre              TEXT        NOT NULL,
  apellido            TEXT        NOT NULL,
  email               TEXT        NOT NULL,
  telefono            TEXT,
  consulta            TEXT,
  plan_id             TEXT,
  plan_label          TEXT,
  monto               NUMERIC,
  monto_original      NUMERIC,
  descuento_aplicado  NUMERIC     DEFAULT 0,
  cupon_codigo        TEXT,
  mp_preference_id    TEXT,
  estado              TEXT        DEFAULT 'pendiente'
                                  CHECK (estado IN ('pendiente', 'dado_de_alta', 'rechazado')),
  notas_admin         TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE solicitudes_inscripcion ENABLE ROW LEVEL SECURITY;

-- Cualquier visitante puede enviar el formulario de inscripción
CREATE POLICY "solicitudes_insert_publica" ON solicitudes_inscripcion
  FOR INSERT WITH CHECK (true);

-- Solo admin puede ver las solicitudes
CREATE POLICY "solicitudes_admin_select" ON solicitudes_inscripcion
  FOR SELECT USING (public.is_admin());

-- Solo admin puede actualizar el estado
CREATE POLICY "solicitudes_admin_update" ON solicitudes_inscripcion
  FOR UPDATE USING (public.is_admin());

-- Solo admin puede eliminar
CREATE POLICY "solicitudes_admin_delete" ON solicitudes_inscripcion
  FOR DELETE USING (public.is_admin());

-- Permisos de roles
GRANT INSERT                     ON public.solicitudes_inscripcion TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitudes_inscripcion TO authenticated;
