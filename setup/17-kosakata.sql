-- =====================================================================
-- NOTULEN AI — Kosakata (jalankan SEKALI di SQL Editor). Aman dijalankan ulang.
-- Butuh: 10-multi-akun.sql dan 16-jenis-kegiatan.sql.
-- * kosakata       : daftar istilah/nama milik tiap akun, per jenis kegiatan
--                    ('semua' = dipakai di semua jenis). Baris "salah → benar"
--                    langsung dibetulkan di transkrip oleh n8n; istilahnya
--                    dikirim ke AssemblyAI (keyterms) dan ke AI sebagai ejaan
--                    yang benar. Diisi dari app: Pengaturan → Kosakata.
-- * rapat.kosakata : salinan kosakata yang dipakai saat rekaman itu diproses.
-- =====================================================================
create table if not exists public.kosakata (
  pemilik  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  jenis    text not null default 'semua',
  istilah  text not null default '',
  diubah   timestamptz not null default now(),
  primary key (pemilik, jenis)
);
alter table public.kosakata enable row level security;
revoke all on public.kosakata from anon;
grant select, insert, update, delete on public.kosakata to authenticated;
drop policy if exists "kosakata sendiri" on public.kosakata;
create policy "kosakata sendiri" on public.kosakata for all to authenticated
  using (public.saya_aktif() and pemilik = auth.uid())
  with check (public.saya_aktif() and pemilik = auth.uid());

alter table public.rapat add column if not exists kosakata text;

-- Cek: harus keluar 1 baris berisi 'kosakata'
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'rapat' and column_name = 'kosakata';
