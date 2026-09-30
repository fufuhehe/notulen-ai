-- Jalankan sekali: fitur Paparan (deck .pptx + infografis) dari resume/transkrip

alter table public.rapat
  add column if not exists deck         jsonb not null default '{}',  -- {"resume": {...}, "transkrip": {...}}
  add column if not exists deck_sumber  text,                          -- 'resume' | 'transkrip' (yang diminta terakhir)
  add column if not exists deck_status  text,                          -- minta | proses | selesai | gagal
  add column if not exists deck_error   text;

-- Trigger sekarang juga mengabari n8n saat deck_status berubah jadi 'minta'
create or replace function private.kabari_n8n()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  cfg   private.pengaturan;
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

  perform net.http_post(
    url     := cfg.n8n_url || '/webhook/' || jalur,
    body    := jsonb_build_object('rapat_id', new.id, 'supa_url', cfg.supa_url),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-kunci', cfg.kunci),
    timeout_milliseconds := 10000
  );
  return new;
end $$;

drop trigger if exists kabari_n8n on public.rapat;
create trigger kabari_n8n
  after insert or update of status, deck_status on public.rapat
  for each row execute function private.kabari_n8n();
