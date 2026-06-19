-- ══════════════════════════════════════════════════════════════
-- DIAGNÓSTICO Y FIX: Flash Promo Banner
-- Ejecutar en: Supabase → SQL Editor → Run
-- ══════════════════════════════════════════════════════════════

-- 1. VER el estado actual de los cupones flash
SELECT
  id, code, active, is_flash,
  eliminado_en,
  expires_at,
  expires_at > NOW() AS no_expirado
FROM public.cupones
WHERE is_flash = true;

-- 2. ASEGURARSE de que los permisos de lectura estén aplicados
GRANT SELECT ON public.cupones TO anon;
GRANT SELECT ON public.cupones TO authenticated;

-- 3. VERIFICAR que RLS permita lectura pública
-- (Si la policy "cupones_public_select" ya existe, este bloque la recrea)
DROP POLICY IF EXISTS "cupones_public_select" ON public.cupones;
CREATE POLICY "cupones_public_select"
  ON public.cupones FOR SELECT
  USING (true);
