-- Add logo_url column to seasons table
alter table seasons add column if not exists logo_url text;
