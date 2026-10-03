-- =====================================================================
-- NOTULEN AI — banyak akun (jalankan SEKALI di SQL Editor)
-- * Tiap rapat punya pemilik. User biasa cuma lihat rapatnya sendiri.
-- * Admin lihat semua rapat & kelola akun dari app.
-- * Akun PALING LAMA di project ini otomatis jadi admin pertama,
--   dan semua rapat yang sudah ada jadi miliknya.
-- * Instalasi baru: jalankan 1-supabase.sql dulu, baru file ini.
-- Aman dijalankan ulang.
-- =====================================================================

-- 1. Profil akun -------------------------------------------------------
create table if not exists public.profil (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  nama          text,
  peran         text not null default 'user' check (peran in ('admin','user')),
  aktif         boolean not null default true,
  model_notulen text not null default 'otomatis',
  model_paparan text not null default 'otomatis',
  created_at    timestamptz not null default now()
);

-- Cek peran (security definer supaya bisa dipakai di aturan akses tanpa berputar)
create or replace function public.saya_aktif() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profil where id = auth.uid() and aktif) $$;

create or replace function public.saya_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profil where id = auth.uid() and aktif and peran = 'admin') $$;

revoke all on function public.saya_aktif() from anon;
revoke all on function public.saya_admin() from anon;
grant execute on function public.saya_aktif() to authenticated;
grant execute on function public.saya_admin() to authenticated;

-- Akun baru (dibuat admin lewat app) otomatis dapat profil
create schema if not exists private;
create or replace function private.profil_baru() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profil (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists profil_baru on auth.users;
create trigger profil_baru after insert on auth.users
  for each row execute function private.profil_baru();

-- Isi profil untuk akun yang sudah ada (model ikut pilihan lama)
insert into public.profil (id, email, created_at, model_notulen, model_paparan)
select u.id, u.email, u.created_at,
       coalesce((select model_notulen from public.pengaturan_app where id = 1), 'otomatis'),
       coalesce((select model_paparan from public.pengaturan_app where id = 1), 'otomatis')
from auth.users u
on conflict (id) do nothing;

-- Admin pertama = akun paling lama (kalau belum ada admin sama sekali)
update public.profil set peran = 'admin'
where id = (select id from auth.users order by created_at limit 1)
  and not exists (select 1 from public.profil where peran = 'admin');

-- Akses profil: lihat diri sendiri (admin lihat semua).
-- User hanya boleh ubah nama & pilihan model miliknya. Peran/aktif diubah lewat fungsi kelola-akun.
alter table public.profil enable row level security;
revoke all on public.profil from anon, authenticated;
grant select on public.profil to authenticated;
grant update (nama, model_notulen, model_paparan) on public.profil to authenticated;
drop policy if exists "lihat profil" on public.profil;
drop policy if exists "ubah profil sendiri" on public.profil;
create policy "lihat profil" on public.profil for select to authenticated
  using (id = auth.uid() or public.saya_admin());
create policy "ubah profil sendiri" on public.profil for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- 2. Pemilik rapat -----------------------------------------------------
alter table public.rapat add column if not exists pemilik uuid default auth.uid()
  references public.profil(id) on delete set null;
create index if not exists rapat_pemilik_idx on public.rapat (pemilik, created_at desc);

update public.rapat set pemilik = (select id from public.profil where peran = 'admin' order by created_at limit 1)
where pemilik is null;

drop policy if exists "pemilik" on public.rapat;
drop policy if exists "rapat lihat" on public.rapat;
drop policy if exists "rapat tambah" on public.rapat;
drop policy if exists "rapat ubah" on public.rapat;
drop policy if exists "rapat hapus" on public.rapat;
create policy "rapat lihat" on public.rapat for select to authenticated
  using (public.saya_aktif() and (pemilik = auth.uid() or public.saya_admin()));
create policy "rapat tambah" on public.rapat for insert to authenticated
  with check (public.saya_aktif() and pemilik = auth.uid());
create policy "rapat ubah" on public.rapat for update to authenticated
  using (public.saya_aktif() and (pemilik = auth.uid() or public.saya_admin()))
  with check (public.saya_aktif() and (pemilik = auth.uid() or public.saya_admin()));
create policy "rapat hapus" on public.rapat for delete to authenticated
  using (public.saya_aktif() and (pemilik = auth.uid() or public.saya_admin()));

-- 3. File audio: boleh diakses kalau rapatnya boleh diakses -------------
-- (cek lewat tabel rapat, yang aturan aksesnya sudah per pemilik)
drop policy if exists "audio pemilik" on storage.objects;
drop policy if exists "audio per rapat" on storage.objects;
create policy "audio per rapat" on storage.objects for all to authenticated
  using (bucket_id = 'audio' and exists (select 1 from public.rapat r where r.audio_path = storage.objects.name))
  with check (bucket_id = 'audio' and exists (select 1 from public.rapat r where r.audio_path = storage.objects.name));

-- 4. Kabari n8n: model diambil dari profil pemilik rapat ----------------
create or replace function private.kabari_n8n()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  cfg   private.pengaturan;
  prof  public.profil;
  jalur text;
begin
  if tg_op = 'UPDATE' and new.deck_status is distinct from old.deck_status and new.deck_status = 'minta' then
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

-- Cek: daftar akun & perannya. Pastikan akun lo berperan 'admin'.
-- Kalau salah orang, jalankan:  update public.profil set peran = 'admin' where email = 'email-lo@contoh.com';
select email, peran, aktif, (select count(*) from public.rapat r where r.pemilik = p.id) as jumlah_rapat
from public.profil p order by created_at;
