-- ============================================================
--  EDIT MASTER — Schema Supabase COMPLETO
--  Basado en todos los archivos de migración del proyecto base.
--  Ejecutar de una sola vez en el SQL Editor de Supabase.
-- ============================================================

-- ─── EXTENSIONES ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── FUNCIÓN: updated_at automático ─────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 1. PERFILES
-- Tabla central de usuarios (estudiantes + admins).
-- Se crea un registro automáticamente vía trigger cuando
-- alguien se registra en Supabase Auth.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.perfiles (
  id             UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT        NOT NULL,
  nombre         TEXT,
  apellido       TEXT,
  telefono       TEXT,
  avatar_url     TEXT,
  rol            TEXT        NOT NULL DEFAULT 'estudiante'
                             CHECK (rol IN ('estudiante', 'admin', 'staff')),
  activo         BOOLEAN     NOT NULL DEFAULT false,
  cursada        TEXT        DEFAULT 'Cursada 1',
  -- Borrado lógico (papelera)
  eliminado_en        TIMESTAMPTZ,
  eliminado_por       UUID     REFERENCES auth.users(id),
  eliminado_por_email TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS perfiles_updated_at ON public.perfiles;
CREATE TRIGGER perfiles_updated_at
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: crea perfil automáticamente al registrar usuario en Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.perfiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════
-- 2. FUNCIONES DE SEGURIDAD
-- Deben crearse ANTES de las políticas RLS.
-- ═══════════════════════════════════════════════════════════

-- Helper: saber si el usuario actual es admin/staff
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND rol IN ('admin', 'staff')
  );
$$;

-- Trigger: impide que un estudiante cambie su propio rol o activo
CREATE OR REPLACE FUNCTION public.prevent_rol_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.rol    := OLD.rol;
    NEW.activo := OLD.activo;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_rol_on_update ON public.perfiles;
CREATE TRIGGER protect_rol_on_update
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_rol_change();

-- ═══════════════════════════════════════════════════════════
-- 3. CUPONES DE DESCUENTO
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.cupones (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT         NOT NULL UNIQUE,
  type        TEXT         NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value       NUMERIC(10,2) NOT NULL,
  description TEXT,
  max_uses    INT,
  used_count  INT          NOT NULL DEFAULT 0,   -- ojo: "used_count" (lo lee utils/cupones.js)
  active      BOOLEAN      NOT NULL DEFAULT true, -- ojo: "active" (no "activo")
  is_flash    BOOLEAN      NOT NULL DEFAULT false,
  expires_at  TIMESTAMPTZ,
  -- Borrado lógico
  eliminado_en        TIMESTAMPTZ,
  eliminado_por       UUID REFERENCES auth.users(id),
  eliminado_por_email TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS cupones_updated_at ON public.cupones;
CREATE TRIGGER cupones_updated_at
  BEFORE UPDATE ON public.cupones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Índice UNIQUE case-insensitive (evita duplicados como "PROMO10" y "promo10")
CREATE UNIQUE INDEX IF NOT EXISTS cupones_code_unique_idx ON public.cupones(UPPER(code));
CREATE INDEX IF NOT EXISTS idx_cupones_active ON public.cupones(active);

-- Función RPC: incremento atómico de usos de cupón
-- (evita race conditions si dos personas usan el cupón simultáneamente)
-- Llamada desde utils/cupones.js → supabase.rpc('increment_cupon_used_count', { cupon_id })
CREATE OR REPLACE FUNCTION public.increment_cupon_used_count(cupon_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.cupones
  SET used_count = used_count + 1
  WHERE id = cupon_id;
$$;

-- ═══════════════════════════════════════════════════════════
-- 4. APP SETTINGS (configuración global)
-- Leída por AppSettingsContext.jsx en el front sin auth.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.app_settings (
  id          TEXT        PRIMARY KEY,
  value       TEXT        NOT NULL,
  descripcion TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS app_settings_updated_at ON public.app_settings;
CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed: valores iniciales EDIT MASTER
INSERT INTO public.app_settings (id, value, descripcion) VALUES
  ('precio_base',    '350000',                    'Precio de inscripción en ARS'),
  ('precio_tachado', '500000',                    'Precio tachado de referencia en ARS'),
  ('fecha_inicio',   '15 de Julio',               'Fecha de inicio del curso'),
  ('test_mode_mp',   'false',                     'true = habilita plan de prueba $100 en inscripción'),
  ('site_url',       'https://www.editmaster.co', 'URL pública del sitio')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- 5. CARPETAS DE RECURSOS
-- Agrupan los recursos del portal en secciones (módulos).
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.carpetas (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT        NOT NULL,
  orden      INT         DEFAULT 0,
  activo     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carpetas_orden ON public.carpetas(orden);

-- ═══════════════════════════════════════════════════════════
-- 6. RECURSOS DEL CURSO
-- Videos, PDFs y links del portal del estudiante.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.recursos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      TEXT        NOT NULL,
  descripcion TEXT,
  tipo        TEXT        NOT NULL CHECK (tipo IN ('video', 'pdf', 'link', 'imagen')),
  url         TEXT,
  storage_path TEXT,
  modulo      INT,                    -- número de módulo (1-7), NULL = general
  orden       INT         DEFAULT 0,
  activo      BOOLEAN     NOT NULL DEFAULT true,
  free_preview BOOLEAN    NOT NULL DEFAULT false,
  carpeta_id  UUID        REFERENCES public.carpetas(id) ON DELETE SET NULL,
  -- Borrado lógico
  eliminado_en        TIMESTAMPTZ,
  eliminado_por       UUID REFERENCES auth.users(id),
  eliminado_por_email TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS recursos_updated_at ON public.recursos;
CREATE TRIGGER recursos_updated_at
  BEFORE UPDATE ON public.recursos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_recursos_modulo   ON public.recursos(modulo, orden);
CREATE INDEX IF NOT EXISTS idx_recursos_carpeta  ON public.recursos(carpeta_id, orden);
CREATE INDEX IF NOT EXISTS idx_recursos_tipo     ON public.recursos(tipo);

-- ═══════════════════════════════════════════════════════════
-- 6. CERTIFICADOS
-- Uno por alumno al completar el curso.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.certificados (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id         UUID         NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  nombre_en_certificado TEXT         NOT NULL,
  fecha_emision         DATE         NOT NULL,
  firmante1             TEXT,
  firmante2             TEXT,
  cargo1                TEXT,
  cargo2                TEXT,
  emitido_por           UUID         REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificados_estudiante ON public.certificados(estudiante_id);

-- ═══════════════════════════════════════════════════════════
-- 7. FINANZAS — MOVIMIENTOS
-- Ingresos y egresos con soporte de pagos parciales.
-- JSONB pagos[] permite registrar múltiples abonos por movimiento.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.finanzas_movimientos (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            TEXT         NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  categoria       TEXT         NOT NULL,
  descripcion     TEXT         NOT NULL,
  monto           NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
  fecha           DATE         NOT NULL DEFAULT CURRENT_DATE,
  metodo          TEXT         DEFAULT 'Transferencia bancaria',
  cobrador        TEXT,
  beneficiario    TEXT,
  notas           TEXT,

  -- Deuda / pagos parciales
  tiene_deuda     BOOLEAN      NOT NULL DEFAULT false,
  deuda_estado    TEXT         CHECK (deuda_estado IN ('pendiente', 'pagado')) DEFAULT 'pendiente',
  pagos           JSONB        NOT NULL DEFAULT '[]',  -- [{id, fecha, monto, metodo, notas, cobrador}]
  monto_pagado    NUMERIC(12,2) NOT NULL DEFAULT 0,    -- calculado por trigger
  deuda_restante  NUMERIC(12,2) NOT NULL DEFAULT 0,    -- calculado por trigger

  -- Datos del alumno en el momento del pago (snapshot)
  alumno_data     JSONB,       -- {nombre, apellido, email, telefono, cursada}

  -- Comprobantes de pago
  comprobantes    TEXT[]       DEFAULT '{}',

  -- Borrado lógico
  eliminado_en        TIMESTAMPTZ,
  eliminado_por       UUID REFERENCES auth.users(id),
  eliminado_por_email TEXT,

  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS finanzas_updated_at ON public.finanzas_movimientos;
CREATE TRIGGER finanzas_updated_at
  BEFORE UPDATE ON public.finanzas_movimientos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_finanzas_tipo    ON public.finanzas_movimientos(tipo);
CREATE INDEX IF NOT EXISTS idx_finanzas_fecha   ON public.finanzas_movimientos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_finanzas_deuda   ON public.finanzas_movimientos(tiene_deuda) WHERE tiene_deuda = true;
CREATE INDEX IF NOT EXISTS idx_finanzas_restante ON public.finanzas_movimientos(deuda_restante) WHERE tiene_deuda = true;
CREATE INDEX IF NOT EXISTS idx_finanzas_created     ON public.finanzas_movimientos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finanzas_alumno_data ON public.finanzas_movimientos(categoria) WHERE alumno_data IS NOT NULL;

-- Trigger: recalcula monto_pagado, deuda_restante y deuda_estado desde el JSONB pagos[]
CREATE OR REPLACE FUNCTION public.fn_calcular_deuda_pagos()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  total_pagado NUMERIC(12,2);
BEGIN
  IF NEW.tiene_deuda THEN
    SELECT COALESCE(SUM((p ->> 'monto')::NUMERIC), 0)
    INTO   total_pagado
    FROM   jsonb_array_elements(COALESCE(NEW.pagos, '[]'::jsonb)) AS p;

    NEW.monto_pagado   := total_pagado;
    NEW.deuda_restante := GREATEST(COALESCE(NEW.monto, 0) - total_pagado, 0);

    IF NEW.deuda_restante = 0 AND NEW.monto > 0 THEN
      NEW.deuda_estado := 'pagado';
    ELSE
      NEW.deuda_estado := 'pendiente';
    END IF;
  ELSE
    NEW.monto_pagado   := COALESCE(NEW.monto, 0);
    NEW.deuda_restante := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calcular_deuda_pagos ON public.finanzas_movimientos;
CREATE TRIGGER trg_calcular_deuda_pagos
  BEFORE INSERT OR UPDATE ON public.finanzas_movimientos
  FOR EACH ROW EXECUTE FUNCTION public.fn_calcular_deuda_pagos();

-- ═══════════════════════════════════════════════════════════
-- 8. FINANZAS — NOTAS
-- Anotaciones, recordatorios y ajustes del panel de finanzas.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.finanzas_notas (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha            DATE         NOT NULL DEFAULT CURRENT_DATE,
  autor            TEXT         NOT NULL,
  texto            TEXT         NOT NULL,
  comprobante_url  TEXT,
  -- Borrado lógico
  eliminado_en        TIMESTAMPTZ,
  eliminado_por       UUID REFERENCES auth.users(id),
  eliminado_por_email TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finanzas_notas_fecha ON public.finanzas_notas(fecha DESC);

-- ═══════════════════════════════════════════════════════════
-- 9. COSTOS DE ALUMNOS
-- Calculadora de costos por proyecto por alumno.
-- Accesible en el portal del estudiante.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.costos_alumnos (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id        UUID          NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  nombre_proyecto      TEXT          NOT NULL,
  fecha                DATE          NOT NULL DEFAULT CURRENT_DATE,
  unidad_tela          TEXT          NOT NULL DEFAULT 'metros',
  cantidad_prendas     NUMERIC(10,2) NOT NULL DEFAULT 1,
  fabric_qty           NUMERIC(12,2) NOT NULL DEFAULT 0,
  fabric_price         NUMERIC(12,2) NOT NULL DEFAULT 0,
  costo_costura        NUMERIC(12,2) NOT NULL DEFAULT 0,
  detalle_insumos      JSONB         NOT NULL DEFAULT '[]',
  margen_ganancia      NUMERIC(5,2)  NOT NULL DEFAULT 30,
  -- Resultados calculados (guardados para historial)
  costo_tela_total     NUMERIC(14,2) NOT NULL DEFAULT 0,
  costo_costura_total  NUMERIC(14,2) NOT NULL DEFAULT 0,
  costo_insumos_total  NUMERIC(14,2) NOT NULL DEFAULT 0,
  costo_total          NUMERIC(14,2) NOT NULL DEFAULT 0,
  costo_unitario       NUMERIC(14,2) NOT NULL DEFAULT 0,
  precio_venta         NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- Borrado lógico
  eliminado_en        TIMESTAMPTZ,
  eliminado_por       UUID REFERENCES auth.users(id),
  eliminado_por_email TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS costos_updated_at ON public.costos_alumnos;
CREATE TRIGGER costos_updated_at
  BEFORE UPDATE ON public.costos_alumnos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_costos_estudiante ON public.costos_alumnos(estudiante_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════
-- 10. AUDITORÍA
-- Registro de acciones admin: eliminar, modificar, restaurar.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.auditoria (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla_origen         TEXT        NOT NULL,
  registro_id          TEXT        NOT NULL,
  accion               TEXT        NOT NULL CHECK (accion IN ('eliminacion', 'modificacion', 'restauracion', 'creacion')),
  descripcion          TEXT,
  datos_anteriores     JSONB,
  datos_nuevos         JSONB,
  realizado_por        UUID        REFERENCES auth.users(id),
  realizado_por_email  TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_tabla   ON public.auditoria(tabla_origen);
CREATE INDEX IF NOT EXISTS idx_auditoria_created ON public.auditoria(created_at DESC);

-- ═══════════════════════════════════════════════════════════
-- 11. SOLICITUDES DE INSCRIPCIÓN WEB
-- Formulario público → pago MercadoPago.
-- Admin verifica y da de alta manualmente.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.solicitudes_inscripcion (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              TEXT        NOT NULL,
  apellido            TEXT        NOT NULL,
  email               TEXT        NOT NULL,
  telefono            TEXT,
  consulta            TEXT,
  plan_id             TEXT,
  plan_label          TEXT,
  monto               NUMERIC(12,2),
  monto_original      NUMERIC(12,2),
  descuento_aplicado  NUMERIC(12,2) DEFAULT 0,
  cupon_codigo        TEXT,
  mp_preference_id    TEXT,
  mp_payment_id       TEXT,
  estado              TEXT        DEFAULT 'pendiente'
                                  CHECK (estado IN ('pendiente', 'dado_de_alta', 'rechazado')),
  notas_admin         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS solicitudes_updated_at ON public.solicitudes_inscripcion;
CREATE TRIGGER solicitudes_updated_at
  BEFORE UPDATE ON public.solicitudes_inscripcion
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_solicitudes_email  ON public.solicitudes_inscripcion(email);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON public.solicitudes_inscripcion(estado);

-- ═══════════════════════════════════════════════════════════
-- 12. PEDIDOS DE EDICIÓN DE VIDEO
-- Formulario público para solicitar servicio de edición.
-- El admin recibe las solicitudes y cotiza por WhatsApp.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.pedidos_edicion (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         TEXT         NOT NULL,
  apellido       TEXT         NOT NULL,
  whatsapp       TEXT         NOT NULL,
  tipo_video     TEXT         NOT NULL,
  duracion_max   TEXT         NOT NULL,
  descripcion    TEXT         NOT NULL,
  estilos        TEXT[]       DEFAULT '{}',
  link_material  TEXT         NOT NULL,
  referencia_url TEXT,
  estado         TEXT         NOT NULL DEFAULT 'pendiente'
                              CHECK (estado IN ('pendiente', 'contactado', 'cotizado', 'aceptado', 'rechazado')),
  notas_admin    TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS pedidos_edicion_updated_at ON public.pedidos_edicion;
CREATE TRIGGER pedidos_edicion_updated_at
  BEFORE UPDATE ON public.pedidos_edicion
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_pedidos_estado    ON public.pedidos_edicion(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_created   ON public.pedidos_edicion(created_at DESC);

-- ═══════════════════════════════════════════════════════════
-- 13. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.perfiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupones                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carpetas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recursos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificados            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finanzas_movimientos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finanzas_notas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costos_alumnos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_inscripcion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_edicion         ENABLE ROW LEVEL SECURITY;

-- ── perfiles ──────────────────────────────────────────────
DROP POLICY IF EXISTS "perfiles_select_own"   ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_insert_own"   ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_update_own"   ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_delete_admin" ON public.perfiles;

CREATE POLICY "perfiles_select_own"
  ON public.perfiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "perfiles_insert_own"
  ON public.perfiles FOR INSERT
  WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "perfiles_update_own"
  ON public.perfiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "perfiles_delete_admin"
  ON public.perfiles FOR DELETE
  USING (public.is_admin());

-- ── cupones: lectura pública para validar en el front ─────
DROP POLICY IF EXISTS "cupones_public_select"  ON public.cupones;
DROP POLICY IF EXISTS "cupones_admin_insert"   ON public.cupones;
DROP POLICY IF EXISTS "cupones_admin_update"   ON public.cupones;
DROP POLICY IF EXISTS "cupones_admin_delete"   ON public.cupones;

CREATE POLICY "cupones_public_select"  ON public.cupones FOR SELECT USING (true);
CREATE POLICY "cupones_admin_insert"   ON public.cupones FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "cupones_admin_update"   ON public.cupones FOR UPDATE USING (public.is_admin());
CREATE POLICY "cupones_admin_delete"   ON public.cupones FOR DELETE USING (public.is_admin());

-- ── app_settings: lectura pública ─────────────────────────
DROP POLICY IF EXISTS "app_settings_public_select" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_admin_write"   ON public.app_settings;

CREATE POLICY "app_settings_public_select"
  ON public.app_settings FOR SELECT USING (true);

CREATE POLICY "app_settings_admin_write"
  ON public.app_settings FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── carpetas: admin gestiona; alumnos activos ven ────────
DROP POLICY IF EXISTS "admin_all_carpetas" ON public.carpetas;
DROP POLICY IF EXISTS "auth_ver_carpetas"  ON public.carpetas;

CREATE POLICY "admin_all_carpetas"
  ON public.carpetas FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "auth_ver_carpetas"
  ON public.carpetas FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid() AND rol = 'estudiante' AND activo = true
    )
  );

-- ── recursos: alumnos activos ven activos; admin gestiona ─
DROP POLICY IF EXISTS "recursos_admin_all"           ON public.recursos;
DROP POLICY IF EXISTS "recursos_select_authenticated" ON public.recursos;

CREATE POLICY "recursos_admin_all"
  ON public.recursos FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "recursos_select_authenticated"
  ON public.recursos FOR SELECT
  USING (
    activo = true AND eliminado_en IS NULL
    AND EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid() AND rol = 'estudiante' AND activo = true
    )
  );

-- ── certificados ──────────────────────────────────────────
DROP POLICY IF EXISTS "certificados_admin_all"  ON public.certificados;
DROP POLICY IF EXISTS "certificados_select_own" ON public.certificados;

CREATE POLICY "certificados_admin_all"
  ON public.certificados FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "certificados_select_own"
  ON public.certificados FOR SELECT
  USING (auth.uid() = estudiante_id);

-- ── finanzas_movimientos: solo admin ──────────────────────
DROP POLICY IF EXISTS "finanzas_admin_all" ON public.finanzas_movimientos;

CREATE POLICY "finanzas_admin_all"
  ON public.finanzas_movimientos FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── finanzas_notas: solo admin ────────────────────────────
DROP POLICY IF EXISTS "finanzas_notas_admin_all" ON public.finanzas_notas;

CREATE POLICY "finanzas_notas_admin_all"
  ON public.finanzas_notas FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── costos_alumnos: alumno ve los suyos; admin ve todos ───
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

-- ── auditoria: admin lee; cualquier autenticado inserta ───
DROP POLICY IF EXISTS "audit_admin_select"  ON public.auditoria;
DROP POLICY IF EXISTS "audit_auth_insert"   ON public.auditoria;

CREATE POLICY "audit_admin_select"
  ON public.auditoria FOR SELECT USING (public.is_admin());

CREATE POLICY "audit_auth_insert"
  ON public.auditoria FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── pedidos_edicion: cualquier visitante inserta; admin gestiona ──
DROP POLICY IF EXISTS "pedidos_insert_publica"  ON public.pedidos_edicion;
DROP POLICY IF EXISTS "pedidos_admin_select"    ON public.pedidos_edicion;
DROP POLICY IF EXISTS "pedidos_admin_update"    ON public.pedidos_edicion;
DROP POLICY IF EXISTS "pedidos_admin_delete"    ON public.pedidos_edicion;

CREATE POLICY "pedidos_insert_publica"
  ON public.pedidos_edicion FOR INSERT WITH CHECK (true);

CREATE POLICY "pedidos_admin_select"
  ON public.pedidos_edicion FOR SELECT USING (public.is_admin());

CREATE POLICY "pedidos_admin_update"
  ON public.pedidos_edicion FOR UPDATE USING (public.is_admin());

CREATE POLICY "pedidos_admin_delete"
  ON public.pedidos_edicion FOR DELETE USING (public.is_admin());

-- ── solicitudes_inscripcion ───────────────────────────────
DROP POLICY IF EXISTS "solicitudes_insert_publica" ON public.solicitudes_inscripcion;
DROP POLICY IF EXISTS "solicitudes_admin_select"   ON public.solicitudes_inscripcion;
DROP POLICY IF EXISTS "solicitudes_admin_update"   ON public.solicitudes_inscripcion;
DROP POLICY IF EXISTS "solicitudes_admin_delete"   ON public.solicitudes_inscripcion;

-- Cualquier visitante (anon) puede enviar el formulario
CREATE POLICY "solicitudes_insert_publica"
  ON public.solicitudes_inscripcion FOR INSERT WITH CHECK (true);

CREATE POLICY "solicitudes_admin_select"
  ON public.solicitudes_inscripcion FOR SELECT USING (public.is_admin());

CREATE POLICY "solicitudes_admin_update"
  ON public.solicitudes_inscripcion FOR UPDATE USING (public.is_admin());

CREATE POLICY "solicitudes_admin_delete"
  ON public.solicitudes_inscripcion FOR DELETE USING (public.is_admin());

-- ═══════════════════════════════════════════════════════════
-- 13. GRANTS EXPLÍCITOS DE ROLES
-- ═══════════════════════════════════════════════════════════

-- anon: solo puede leer cupones y settings (validación sin login)
-- y puede insertar solicitudes de inscripción / pedidos de edición
GRANT SELECT ON public.cupones                 TO anon;
GRANT SELECT ON public.app_settings            TO anon;
GRANT INSERT ON public.solicitudes_inscripcion TO anon;
GRANT INSERT ON public.pedidos_edicion         TO anon;

-- authenticated: acceso a las tablas que usa el front
GRANT SELECT, UPDATE                         ON public.perfiles               TO authenticated;
GRANT SELECT                                 ON public.cupones                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE         ON public.app_settings           TO authenticated;
GRANT SELECT                                 ON public.certificados           TO authenticated;
GRANT SELECT                                 ON public.recursos               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE         ON public.carpetas               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE         ON public.costos_alumnos         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE         ON public.finanzas_notas         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE         ON public.solicitudes_inscripcion TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE         ON public.pedidos_edicion         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE         ON public.finanzas_movimientos   TO authenticated;
GRANT INSERT                                 ON public.auditoria              TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 14. CONFIGURAR ADMINS
-- Cambiar estos emails por los de tu proyecto si es necesario.
-- Ejecutar DESPUÉS de que los admins se hayan registrado.
-- ═══════════════════════════════════════════════════════════
-- UPDATE public.perfiles SET rol = 'admin'
-- WHERE email IN ('ing.lp.tech@gmail.com', 'cristian590@gmail.com');

-- ═══════════════════════════════════════════════════════════
-- 15. STORAGE BUCKETS
-- Crear manualmente en Dashboard > Storage.
-- ═══════════════════════════════════════════════════════════
--
-- "recursos-curso"   → privado
--    Videos, PDFs, LUTs, templates del curso
--    RLS SELECT: activo estudiante OR is_admin()
--    RLS INSERT/UPDATE/DELETE: is_admin()
--
-- "comprobantes"     → público
--    Fotos de comprobantes de pago
--    RLS SELECT: true
--    RLS INSERT: auth.uid() IS NOT NULL
--
-- "certificados"     → privado
--    PDFs de certificados
--    RLS SELECT: storage.foldername(name)[1] = auth.uid()::text OR is_admin()
--    RLS INSERT/DELETE: is_admin()
--
-- "avatars"          → público
--    Fotos de perfil
--    RLS SELECT: true
--    RLS INSERT/UPDATE: filename LIKE auth.uid() || '%'

-- ═══════════════════════════════════════════════════════════
-- 16. VARIABLES DE ENTORNO
-- ═══════════════════════════════════════════════════════════
-- .env (raíz del proyecto):
--   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
--   VITE_SUPABASE_ANON_KEY=<anon-key>
--   VITE_ADMIN_EMAILS=ing.lp.tech@gmail.com,cristian590@gmail.com
--
-- Vercel (Settings > Environment Variables):
--   VITE_SUPABASE_URL        (igual)
--   VITE_SUPABASE_ANON_KEY   (igual)
--   VITE_ADMIN_EMAILS        (igual)
--   MP_ACCESS_TOKEN          (Access Token MercadoPago Producción)
--
-- Pasos de setup del nuevo proyecto:
--   1. supabase.com → New project
--   2. Settings > API → copiar URL y anon key
--   3. SQL Editor → pegar y ejecutar este archivo completo
--   4. Ejecutar el UPDATE de admins (sección 14, líneas descomentadas)
--   5. Dashboard > Storage → crear los 4 buckets
--   6. Actualizar .env con las nuevas claves
--   7. Vercel → actualizar las env vars
--   8. vercel --prod

NOTIFY pgrst, 'reload schema';
SELECT 'EDIT MASTER schema creado correctamente ✓' AS status;
