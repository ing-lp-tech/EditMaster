-- =================================================
-- MIGRACIÓN: columna activo para admin_permisos
-- Ejecutar en: Supabase → SQL Editor → Run
-- (Solo si ya ejecutaste admin_permisos.sql antes)
-- =================================================

ALTER TABLE public.admin_permisos
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
