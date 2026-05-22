-- Migration: Add final series support for Champions League and Cup
-- Jalankan di Supabase SQL Editor

-- Tambahkan kolom untuk konfigurasi final series ke tabel seasons
alter table seasons 
  add column if not exists final_series_type text default 'single' check (final_series_type in ('single','best_of')),
  add column if not exists final_best_of int default 1;

-- Pastikan default values benar
update seasons set final_series_type = 'single' where final_series_type is null;
update seasons set final_best_of = 1 where final_best_of is null;
