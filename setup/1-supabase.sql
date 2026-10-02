-- =====================================================================
-- NOTULEN AI — setup Supabase (jalankan SEKALI di SQL Editor)
-- Sebelum Run: ganti 3 nilai di bagian "ISI DI SINI" paling bawah.
-- =====================================================================

-- 1. Tabel rapat -------------------------------------------------------
create table if not exists public.rapat (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  judul         text not null default 'Rapat',
  audio_path    text,                        -- nama file di bucket "audio"
  status        text not null default 'mengunggah'
                check (status in ('mengunggah','antri','ditranskrip',
                                  'minta_resume','meresume','selesai','gagal')),
  transcript_id text,                        -- id di AssemblyAI
  durasi_detik  int,
  transkrip     jsonb,                       -- [{s:"A", m:detik, t:"teks"}]
  nama_speaker  jsonb not null default '{}', -- {"A":"Pak Dir","B":"Budi"}
  resume        text,
  error         text,
  stt_model     text,                        -- model transkrip yang dipakai
  stt_detik     int not null default 0,      -- total detik audio yang ditranskrip
  ai_model      text,                        -- model OpenAI terakhir
  ai_token_in   int not null default 0,      -- total token masuk OpenAI
  ai_token_out  int not null default 0,      -- total token keluar OpenAI
  deck          jsonb not null default '{}', -- paparan: {"resume": {...}, "transkrip": {...}}
  deck_sumber   text,                        -- 'resume' | 'transkrip'
  deck_status   text,                        -- minta | proses | selesai | gagal
  deck_error    text,
  kurs          numeric                     -- kurs USD→IDR hari rapat dibuat (dikunci)
);

-- Hanya user yang login (akun lo sendiri) yang bisa akses.
alter table public.rapat enable row level security;
revoke all on public.rapat from anon;
grant select, insert, update, delete on public.rapat to authenticated;
drop policy if exists "pemilik" on public.rapat;
create policy "pemilik" on public.rapat
  for all to authenticated using (true) with check (true);

-- 2. Bucket audio (privat, maks 50 MB per file = batas paket free) -------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', false, 52428800, array['audio/*','video/mp4','video/webm'])
on conflict (id) do nothing;

drop policy if exists "audio pemilik" on storage.objects;
create policy "audio pemilik" on storage.objects
  for all to authenticated
  using (bucket_id = 'audio') with check (bucket_id = 'audio');

-- 3. Pengaturan rahasia (tidak bisa dibaca dari app) --------------------
create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists private.pengaturan (
  id       int primary key default 1 check (id = 1),
  n8n_url  text not null,   -- alamat n8n, tanpa "/" di akhir
  kunci    text not null,   -- kata acak, SAMA dengan credential "Kunci Notulen" di n8n
  supa_url text not null    -- Project URL Supabase ini
);

-- 3b. Pilihan model AI (diatur dari app)
create table if not exists public.pengaturan_app (
  id            int primary key default 1 check (id = 1),
  model_notulen text not null default 'otomatis',
  model_paparan text not null default 'otomatis'
);
insert into public.pengaturan_app (id) values (1) on conflict (id) do nothing;

alter table public.pengaturan_app enable row level security;
revoke all on public.pengaturan_app from anon;
grant select, update on public.pengaturan_app to authenticated;
drop policy if exists "baca" on public.pengaturan_app;
drop policy if exists "ubah" on public.pengaturan_app;
create policy "baca" on public.pengaturan_app for select to authenticated using (true);
create policy "ubah" on public.pengaturan_app for update to authenticated using (true) with check (true);


-- 4. Kabari n8n otomatis saat status berubah -----------------------------
create extension if not exists pg_net;

create or replace function private.kabari_n8n()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  cfg   private.pengaturan;
  app   public.pengaturan_app;
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
  select * into app from public.pengaturan_app where id = 1;

  perform net.http_post(
    url     := cfg.n8n_url || '/webhook/' || jalur,
    body    := jsonb_build_object(
                 'rapat_id', new.id, 'supa_url', cfg.supa_url,
                 'model_notulen', coalesce(app.model_notulen, 'otomatis'),
                 'model_paparan', coalesce(app.model_paparan, 'otomatis')),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-kunci', cfg.kunci),
    timeout_milliseconds := 10000
  );
  return new;
end $$;

drop trigger if exists kabari_n8n on public.rapat;
create trigger kabari_n8n
  after insert or update of status, deck_status on public.rapat
  for each row execute function private.kabari_n8n();

-- 5. ISI DI SINI ---------------------------------------------------------
insert into private.pengaturan (id, n8n_url, kunci, supa_url) values (
  1,
  'https://ISI-DOMAIN-N8N',          -- contoh: https://n8n-abcd.sumopod.my.id
  'ISI_KATA_ACAK_MIN_20_KARAKTER',   -- bikin sendiri, tanpa spasi
  'https://ISI.supabase.co'          -- Project URL Supabase ini
)
on conflict (id) do update
  set n8n_url = excluded.n8n_url, kunci = excluded.kunci, supa_url = excluded.supa_url;

-- Cek: harus keluar 1 baris berisi n8n_url & supa_url yang barusan diisi
select n8n_url, supa_url, length(kunci) as panjang_kunci from private.pengaturan;
