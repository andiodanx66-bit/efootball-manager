-- ============================================================
-- Supabase Storage Policies for "competition" bucket
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- Allow authenticated users to upload files to competition bucket
create policy "Allow authenticated uploads to competition"
on storage.objects for insert
to authenticated
with check (bucket_id = 'competition');

-- Allow public to read files from competition bucket
create policy "Allow public read access to competition"
on storage.objects for select
to public
using (bucket_id = 'competition');

-- Optional: Allow authenticated users to delete their own files
create policy "Allow authenticated to delete competition files"
on storage.objects for delete
to authenticated
using (bucket_id = 'competition');
