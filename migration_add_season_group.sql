-- ============================================================
-- Migration: tambah kolom season_group ke tabel seasons
-- Digunakan untuk mengelompokkan kompetisi dalam satu musim
-- Contoh: "Musim 1", "2024/2025", dll
-- Jalankan di Supabase SQL Editor
-- ============================================================

alter table seasons
  add column if not exists season_group text;

-- Index untuk mempercepat query grouping
create index if not exists idx_seasons_season_group on seasons(season_group);
