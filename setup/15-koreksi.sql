-- =====================================================================
-- NOTULEN AI — Catatan koreksi + revisi notulensi (jalankan SEKALI di SQL Editor)
-- Butuh: 13-notulensi.sql sudah dijalankan. Aman dijalankan ulang.
-- * koreksi          : daftar koreksi nama/istilah dari user. Tetap tersimpan dan
--                      dipakai n8n di setiap proses (ringkasan, notulensi, paparan).
-- * notulensi_revisi : instruksi revisi notulensi, dipakai sekali lalu dikosongkan.
--                      Kalau diisi bersamaan dengan revisi ringkasan, notulensi
--                      direvisi otomatis setelah ringkasan selesai.
-- =====================================================================
alter table public.rapat add column if not exists koreksi          text;
alter table public.rapat add column if not exists notulensi_revisi text;

-- Cek: harus keluar 2 baris
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'rapat' and column_name in ('koreksi', 'notulensi_revisi');
