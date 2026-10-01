// Rakit hasil OpenAI jadi data deck, simpan per sumber (resume / transkrip)
const lama = $('Tandai deck diproses').first().json;
const bahan = $('Susun bahan').first().json;
const res = $input.first().json;

const tambahToken = (u) => ({
  ai_token_in: (lama.ai_token_in || 0) + ((u && u.prompt_tokens) || 0),
  ai_token_out: (lama.ai_token_out || 0) + ((u && u.completion_tokens) || 0),
});

// Gagal sebelum/saat memanggil AI
if (bahan.gagal || res.error || !res.choices) {
  const e = bahan.gagal ? bahan.error : 'AI: ' + ((res.error && (res.error.message || (typeof res.error === 'string' ? res.error : JSON.stringify(res.error)))) || res.message || JSON.stringify(res).slice(0, 300));
  return [{ json: { deck_status: 'gagal', deck_error: String(e).slice(0, 500), ...tambahToken(res.usage) } }];
}

let isi = res.choices[0].message && res.choices[0].message.content;
if (typeof isi === 'string') {
  // sebagian model membungkus JSON dengan ```json ... ``` atau teks lain — ambil dari { pertama s/d } terakhir
  const a = isi.indexOf('{'), z = isi.lastIndexOf('}');
  try { isi = JSON.parse(a >= 0 && z > a ? isi.slice(a, z + 1) : isi); } catch (_) { isi = null; }
}
const daftar = (x) => (Array.isArray(x) ? x : []);
if (!isi || typeof isi !== 'object' || !isi.judul) {
  return [{ json: { deck_status: 'gagal', deck_error: 'Format balasan AI tidak sesuai. Coba buat ulang.', ...tambahToken(res.usage) } }];
}

const u = res.usage || {};
const hasil = {
  judul: String(isi.judul || ''),
  subjudul: String(isi.subjudul || ''),
  pesan_kunci: String(isi.pesan_kunci || ''),
  ringkasan: daftar(isi.ringkasan).map(String).slice(0, 4),
  slides: daftar(isi.slides).slice(0, 6).map(s => ({ judul: String(s.judul || ''), poin: daftar(s.poin).map(String).slice(0, 6) })),
  angka: daftar(isi.angka).slice(0, 4).map(a => ({ nilai: String(a.nilai || ''), label: String(a.label || '') })),
  tindak_lanjut: daftar(isi.tindak_lanjut).slice(0, 6).map(t => ({ pic: String(t.pic || ''), tugas: String(t.tugas || '') })),
  model: res.model,
  token_in: u.prompt_tokens || 0,
  token_out: u.completion_tokens || 0,
  dibuat: new Date().toISOString(),
};

const deck = Object.assign({}, lama.deck || {});
deck[bahan.sumber] = hasil;

return [{ json: {
  deck,
  deck_status: 'selesai',
  deck_error: null,
  ai_model: res.model,
  ...tambahToken(u),
} }];
