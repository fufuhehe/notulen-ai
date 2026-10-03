# Notulen Rapat

Rekam rapat dari HP. Aplikasi ini lalu bikin transkrip yang dipisah per pembicara, plus resume siap kirim ke WhatsApp.

**App:** https://fufuhehe.github.io/notulen-ai/

```
HP (PWA) ──upload──▶ Supabase Storage + tabel rapat
                         │ status berubah → Supabase otomatis colek n8n
                         ▼
n8n "1 Transkrip": AssemblyAI (pisah speaker) → simpan transkrip
n8n "2 Resume":    AI via Sumopod (model dipilih di app) → simpan notulen
                         ▼
HP menampilkan resume, transkrip, dan form kasih nama speaker
```

## Pasang (sekali, ±20 menit)

### A. Supabase (project baru)
1. **SQL Editor** → tempel isi [`setup/1-supabase.sql`](setup/1-supabase.sql). **Sebelum Run**, ganti 3 nilai di bagian `5. ISI DI SINI` (alamat n8n, kata kunci bikinan sendiri, Project URL). Setelah Run, baris paling bawah harus menampilkan nilai-nilai itu.
2. **Authentication → Sign In / Providers**: matikan *Allow new users to sign up*. Ini supaya orang lain tidak bisa daftar.
3. **Authentication → Users → Add user → Create new user**: isi email + password lo dan centang *Auto Confirm User*.
4. **Project Settings → API Keys**: catat **publishable key** (buat app di HP) dan **secret / service_role key** (buat n8n, RAHASIA).

### B. n8n
1. Bikin **Credentials** dulu:
   | Jenis | Nama credential | Isi |
   |---|---|---|
   | Header Auth | `Kunci Notulen` | Name: `x-kunci` · Value: kata kunci yang sama dengan di SQL |
   | Supabase API | `Supabase Notulen` | Host: Project URL · Service Role Secret: secret/service_role key |
   | AssemblyAI API | (bebas) | API key AssemblyAI |
   | OpenAI | (bebas) | API Key dari **Sumopod** (atau OpenAI). Node *Minta AI* memanggil `ai.sumopod.com/v1/chat/completions`; kalau pakai OpenAI langsung, ganti URL di node itu |
2. **Import** dua workflow: buka [`setup/2-n8n-transkrip.json`](setup/2-n8n-transkrip.json) dan [`setup/3-n8n-resume.json`](setup/3-n8n-resume.json) → tombol *Raw* → salin semua → di n8n bikin workflow baru → tempel (Ctrl+V) di kanvas.
3. Buka node yang ada tanda merah, lalu pilih credential-nya.
4. **Aktifkan (Publish) dua-duanya.**
5. Opsional tapi disarankan: impor juga [`setup/4-n8n-jaga-aktif.json`](setup/4-n8n-jaga-aktif.json). Ganti `ISI.supabase.co` di node *Ping Supabase* dengan Project URL lo, lalu aktifkan. Workflow ini nge-ping Supabase tiap 2 hari supaya project free ga di-pause karena sepi.

> Kalau waktu impor muncul pesan node AssemblyAI tidak dikenal: Settings → Community Nodes → Install → `n8n-nodes-assemblyai`.

### C. HP
1. Buka link app → isi **Project URL** + **publishable key** → login.
2. Menu browser → *Tambahkan ke Layar Utama* supaya jadi app.

## Tes pertama
Pakai **Upload file** dengan rekaman lama 10–15 menit. Statusnya bakal jalan: Antri → Ditranskrip → Bikin resume → Selesai. Setelah itu buka tab **Nama**, isi siapa saja yang bicara, lalu tekan *Simpan nama & buat ulang resume*.

## Kalau macet
| Status | Cek |
|---|---|
| Diam di **Antri** | Workflow 1 belum aktif, alamat n8n di SQL salah, atau kata kunci beda. Jalankan di SQL Editor: `select status_code, content from net._http_response order by created desc limit 5;` |
| Diam di **Ditranskrip** / **Bikin resume** | n8n → *Executions*, lihat node yang merah |
| **Gagal** | Pesan error tampil di app. Tekan *Coba lagi* |

## Biaya di app
Di app, setiap rapat menampilkan biaya: menit audio yang ditranskrip (dari AssemblyAI) dan jumlah token (dari OpenAI), lalu dikalikan tarif resmi. Tarif dan kurs bisa diubah di bagian atas `index.html` (`KURS`, `HARGA_STT`, `HARGA_AI`).
Kalau database dipasang sebelum fitur ini ada, jalankan dulu [`setup/5-tambah-biaya.sql`](setup/5-tambah-biaya.sql) dan impor ulang kedua workflow.

## Paparan (deck + infografis)
Di tab **Paparan** pada detail rapat: pilih sumber (resume atau transkrip), tekan *Buat paparan*, lalu download **deck .pptx** dan **infografis PNG**. Hasil dari tiap sumber disimpan terpisah, beserta biayanya, supaya bisa dibandingkan.
Pasang sekali: jalankan [`setup/6-paparan.sql`](setup/6-paparan.sql), lalu impor dan aktifkan [`setup/7-n8n-paparan.json`](setup/7-n8n-paparan.json) (pilih credential Kunci Notulen, Supabase Notulen, dan OpenAI).
Isi paparan ditulis AI dalam format JSON (prompt: `setup/prompt-deck.txt`). Desainnya dibuat oleh app, jadi teks dan angkanya persis sama dengan yang ditulis AI.

## Banyak akun (opsional)
Tiap akun cuma lihat rapatnya sendiri. Admin lihat semua rapat (bisa disaring per orang) dan mengelola akun dari app.
1. **SQL Editor** → jalankan [`setup/10-multi-akun.sql`](setup/10-multi-akun.sql). Akun paling lama otomatis jadi admin, dan semua rapat lama jadi miliknya. Tabel hasil di bagian bawah menunjukkan peran tiap akun.
2. **Edge Functions → Deploy a new function → Via Editor**, beri nama `kelola-akun`, tempel isi [`setup/11-fungsi-kelola-akun.ts`](setup/11-fungsi-kelola-akun.ts), lalu Deploy. Setelah itu buka fungsinya → *Details* → matikan **Verify JWT with legacy secret** → Save.
3. Di app: Pengaturan → **Kelola akun** → *Tambah akun*. Info login otomatis disalin, tinggal kirim ke orangnya.

Pilihan model AI tersimpan per akun. n8n tidak perlu diubah.

## Rekam suara Zoom / tab lain (di laptop)
Di laptop/PC (Chrome atau Edge), di bawah tombol *Rekam rapat* ada pilihan **Sumber suara**:
- **Mic**: suara ruangan lewat mikrofon.
- **Mic + laptop**: suara dari laptop (Zoom, Meet, YouTube) dicampur dengan suara lo dari mic. Ini cocok buat rapat online. Pakai headset supaya suara Zoom ga kerekam dobel.
- **Laptop**: hanya suara dari laptop.

Waktu mulai merekam, browser minta lo pilih yang mau dibagikan:
- **Suara tab lain** (Meet di browser, YouTube): pilih *Tab* → tab-nya → nyalakan **Bagikan audio tab**.
- **Aplikasi Zoom**: pilih *Seluruh layar* → nyalakan **Bagikan audio sistem**. Di Windows bisa langsung. Di Mac butuh macOS 14.2+ dan Chrome 141+; kalau versinya lebih lama, buka Zoom lewat browser lalu pilih tab-nya.

Videonya tidak direkam, cuma audionya. Kalau lo klik "Berhenti berbagi", rekaman otomatis selesai dan diunggah.

## Batasan
- Maks **50 MB per file** (paket free Supabase). Rekaman dari app ±13 MB/jam di Android/Chrome, jadi 3 jam masih aman. Di iPhone ukuran filenya bisa lebih besar.
- Rekaman berhenti kalau layar mati atau pindah aplikasi, terutama di iPhone. Yang sudah terekam tetap tersimpan di HP dan bisa diunggah.
- Audio rapat dikirim ke AssemblyAI & OpenAI (server luar negeri). Jangan dipakai untuk rapat yang bersifat rahasia.
- Biaya per rapat 1 jam ±Rp3–4 rb (AssemblyAI) + ±Rp100–300 (OpenAI).
