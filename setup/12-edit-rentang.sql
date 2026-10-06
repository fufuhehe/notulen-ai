-- Jalankan sekali: fitur edit notulen, minta revisi ke AI, dan pilih bagian rekaman.
-- * rentang : bagian transkrip yang dipakai untuk notulen/paparan
--             {"mulai": detik, "akhir": detik}  (mulai ikut, akhir tidak ikut; null = sampai habis)
-- * revisi  : instruksi revisi dari user, dipakai sekali oleh n8n lalu dikosongkan
alter table public.rapat add column if not exists rentang jsonb;
alter table public.rapat add column if not exists revisi  text;
