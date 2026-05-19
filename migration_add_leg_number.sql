-- Migration: tambah kolom leg_number ke tabel matches
-- Jalankan ini di Supabase SQL Editor jika database sudah ada

alter table matches
  add column if not exists leg_number int default 1;
