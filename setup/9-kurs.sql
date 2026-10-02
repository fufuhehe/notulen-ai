-- Jalankan sekali: simpan kurs USD→IDR per rapat.
-- Kurs diambil app saat rapat dibuat lalu dikunci, jadi biaya rapat lama tidak berubah.
-- Rapat lama (kolom kosong) tetap dihitung pakai kurs cadangan Rp16.500.
alter table public.rapat add column if not exists kurs numeric;
