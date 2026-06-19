-- =================================================
-- MIGRACIÓN: WhatsApp para admin_permisos
-- Ejecutar en: Supabase → SQL Editor → Run
-- =================================================

ALTER TABLE public.admin_permisos
  ADD COLUMN IF NOT EXISTS cod_pais TEXT NOT NULL DEFAULT '+54';

ALTER TABLE public.admin_permisos
  ADD COLUMN IF NOT EXISTS telefono TEXT NOT NULL DEFAULT '';
