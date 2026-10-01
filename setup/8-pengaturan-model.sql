-- Jalankan sekali: pilihan model AI bisa diatur dari app (Pengaturan)

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

-- Trigger sekarang ikut mengirim pilihan model ke n8n
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

select * from public.pengaturan_app;
