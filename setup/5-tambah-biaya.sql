-- Jalankan sekali kalau tabel rapat sudah ada (untuk fitur tampilan biaya)
alter table public.rapat
  add column if not exists stt_model    text,
  add column if not exists stt_detik    int not null default 0,  -- total detik audio yang ditranskrip (termasuk proses ulang)
  add column if not exists ai_model     text,
  add column if not exists ai_token_in  int not null default 0,  -- total token masuk OpenAI (semua pembuatan resume)
  add column if not exists ai_token_out int not null default 0;  -- total token keluar OpenAI

-- Isi perkiraan biaya transkrip untuk rapat yang sudah ada (token AI lama tidak tercatat)
update public.rapat set stt_detik = durasi_detik, stt_model = coalesce(stt_model, 'universal-2')
where stt_detik = 0 and durasi_detik is not null and transkrip is not null;
