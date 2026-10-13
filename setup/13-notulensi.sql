-- =====================================================================
-- NOTULEN AI — Notulensi lengkap + unduh Word (jalankan SEKALI di SQL Editor)
-- Butuh: 1-supabase.sql dan 10-multi-akun.sql sudah dijalankan.
-- Aman dijalankan ulang.
-- =====================================================================

-- 1. Kolom baru di rapat
alter table public.rapat add column if not exists notulensi        jsonb;  -- hasil AI: pengantar, diskusi + tanggapan, penutup
alter table public.rapat add column if not exists notulensi_status text;   -- minta | proses | selesai | gagal
alter table public.rapat add column if not exists notulensi_error  text;
alter table public.rapat add column if not exists info_rapat       jsonb;  -- waktu, tempat, pimpinan, agenda, peserta, notulis, mengetahui

-- 2. Kop surat untuk dokumen Word (diatur admin dari app)
alter table public.pengaturan_app add column if not exists kop1 text not null default '';
alter table public.pengaturan_app add column if not exists kop2 text not null default '';
alter table public.pengaturan_app add column if not exists kota text not null default 'Jakarta';

-- 3. Kabari n8n: tambah jalur notulensi
create or replace function private.kabari_n8n()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  cfg   private.pengaturan;
  prof  public.profil;
  jalur text;
begin
  if tg_op = 'UPDATE' and new.notulensi_status is distinct from old.notulensi_status and new.notulensi_status = 'minta' then
    jalur := 'notulen-notulensi';
  elsif tg_op = 'UPDATE' and new.deck_status is distinct from old.deck_status and new.deck_status = 'minta' then
    jalur := 'notulen-deck';
  elsif tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  elsif new.status = 'antri' then jalur := 'notulen-transkrip';
  elsif new.status = 'minta_resume' then jalur := 'notulen-resume';
  else return new;
  end if;

  select * into cfg from private.pengaturan where id = 1;
  if cfg is null then return new; end if;
  select * into prof from public.profil where id = new.pemilik;

  perform net.http_post(
    url     := cfg.n8n_url || '/webhook/' || jalur,
    body    := jsonb_build_object(
                 'rapat_id', new.id, 'supa_url', cfg.supa_url,
                 'model_notulen', coalesce(prof.model_notulen, 'otomatis'),
                 'model_paparan', coalesce(prof.model_paparan, 'otomatis')),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-kunci', cfg.kunci),
    timeout_milliseconds := 10000
  );
  return new;
end $$;

drop trigger if exists kabari_n8n on public.rapat;
create trigger kabari_n8n
  after insert or update of status, deck_status, notulensi_status on public.rapat
  for each row execute function private.kabari_n8n();

-- Cek: harus keluar 1 baris
select kop1, kop2, kota from public.pengaturan_app;
