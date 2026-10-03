// =====================================================================
// NOTULEN AI — Edge Function "kelola-akun"
// Dipakai halaman "Kelola akun" di app (khusus admin): daftar, tambah,
// ubah peran/nama, nonaktifkan/aktifkan, dan ganti password akun.
//
// Pasang (sekali): Supabase → Edge Functions → Deploy a new function →
// Via Editor → nama: kelola-akun → hapus isi contoh, tempel file ini → Deploy.
// Lalu buka fungsinya → Details → matikan "Verify JWT with legacy secret"
// (fungsi ini memeriksa login sendiri). Cek lagi tiap habis deploy ulang,
// karena toggle ini kadang nyala sendiri. Kunci rahasia tidak perlu diisi:
// SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY sudah tersedia otomatis.
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jawab = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const gagal = (pesan: string, status = 400) => jawab({ error: pesan }, status);

// Kunci server: otomatis tersedia. Kalau suatu saat kosong, tambahkan secret SERVICE_KEY
// (Edge Functions → Secrets) berisi secret/service_role key.
const KUNCI = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_KEY') || '';
const admin = createClient(Deno.env.get('SUPABASE_URL')!, KUNCI, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const PERAN = ['admin', 'user'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return gagal('Metode tidak didukung', 405);
  if (!KUNCI) return gagal('Kunci server belum tersedia. Tambahkan secret SERVICE_KEY.', 500);

  // 1) Pastikan yang meminta adalah admin yang aktif
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u, error: eu } = await admin.auth.getUser(token);
  if (eu || !u?.user) return gagal('Belum login', 401);
  const saya = u.user.id;
  const { data: p } = await admin.from('profil').select('peran, aktif').eq('id', saya).maybeSingle();
  if (!p || p.peran !== 'admin' || !p.aktif) return gagal('Khusus admin', 403);

  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch (_) { /* kosong */ }
  const aksi = String(b.aksi || '');
  const id = String(b.id || '');

  try {
    // 2) Daftar akun
    if (aksi === 'daftar') {
      const { data: prof, error } = await admin.from('profil').select('*').order('created_at');
      if (error) throw error;
      const { data: au, error: e2 } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (e2) throw e2;
      const info = new Map(au.users.map((x) => [x.id, x]));
      return jawab({
        akun: prof.map((x) => ({ ...x, terakhir_masuk: info.get(x.id)?.last_sign_in_at || null })),
        saya,
      });
    }

    // 3) Tambah akun
    if (aksi === 'tambah') {
      const email = String(b.email || '').trim().toLowerCase();
      const password = String(b.password || '');
      const nama = String(b.nama || '').trim() || null;
      const peran = PERAN.includes(String(b.peran)) ? String(b.peran) : 'user';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return gagal('Email tidak valid');
      if (password.length < 8) return gagal('Password minimal 8 karakter');
      const { data: baru, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error;
      const { error: e2 } = await admin.from('profil')
        .upsert({ id: baru.user.id, email, nama, peran, aktif: true });
      if (e2) throw e2;
      return jawab({ ok: true, id: baru.user.id });
    }

    if (!id) return gagal('Akun tidak dipilih');

    // 4) Ubah nama / peran / status aktif
    if (aksi === 'ubah') {
      const ubah: Record<string, unknown> = {};
      if (typeof b.nama === 'string') ubah.nama = b.nama.trim() || null;
      if (b.peran !== undefined) {
        if (!PERAN.includes(String(b.peran))) return gagal('Peran tidak dikenal');
        if (id === saya && b.peran !== 'admin') return gagal('Ga bisa nurunin peran akun sendiri');
        ubah.peran = b.peran;
      }
      if (b.aktif !== undefined) {
        if (id === saya && !b.aktif) return gagal('Ga bisa nonaktifkan akun sendiri');
        ubah.aktif = !!b.aktif;
        // nonaktif = diblokir login; aktif lagi = blokir dicabut
        const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: b.aktif ? 'none' : '876000h' });
        if (error) throw error;
      }
      if (!Object.keys(ubah).length) return gagal('Tidak ada yang diubah');
      const { error } = await admin.from('profil').update(ubah).eq('id', id);
      if (error) throw error;
      return jawab({ ok: true });
    }

    // 5) Ganti password
    if (aksi === 'sandi') {
      const password = String(b.password || '');
      if (password.length < 8) return gagal('Password minimal 8 karakter');
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) throw error;
      return jawab({ ok: true });
    }

    return gagal('Aksi tidak dikenal');
  } catch (e) {
    const m = (e as { message?: string })?.message || String(e);
    if (/already been registered|already exists/i.test(m)) return gagal('Email itu sudah punya akun');
    return gagal(m, 500);
  }
});
