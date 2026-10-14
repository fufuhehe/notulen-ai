// Ubah balasan AI jadi data notulensi, simpan ke rapat.notulensi
const lama = $('Tandai notulensi diproses').first().json;
const bahan = $('Susun bahan').first().json;
const res = $input.first().json;
const u = res.usage || {};
const token = {
  ai_token_in: (lama.ai_token_in || 0) + (u.prompt_tokens || 0),
  ai_token_out: (lama.ai_token_out || 0) + (u.completion_tokens || 0),
};
// instruksi revisi notulensi cuma dipakai sekali (kolomnya ada setelah setup/15-koreksi.sql)
if ('notulensi_revisi' in lama) token.notulensi_revisi = null;
const gagal = (pesan) => [{ json: { notulensi_status: 'gagal', notulensi_error: String(pesan).slice(0, 500), ...token } }];

if (bahan.gagal) return gagal(bahan.error);
if (res.error || !Array.isArray(res.choices) || !res.choices.length) {
  return gagal('AI: ' + ((res.error && (res.error.message || (typeof res.error === 'string' ? res.error : JSON.stringify(res.error)))) || res.message || JSON.stringify(res).slice(0, 300)));
}

const pilihan = res.choices[0] || {};
const mentah = String((pilihan.message && pilihan.message.content) || '');
let isi = null;
{
  const a = mentah.indexOf('{'), z = mentah.lastIndexOf('}');
  const potong = a >= 0 && z > a ? mentah.slice(a, z + 1) : mentah;
  try { isi = JSON.parse(potong); }
  catch (_) {
    try { isi = JSON.parse(potong.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"')); } catch (__) { isi = null; }
  }
}
if (!isi || typeof isi !== 'object') {
  const sebab = pilihan.finish_reason === 'length'
    ? 'Balasan AI kepotong (kepanjangan / kehabisan jatah token). Coba pilih bagian rekaman yang lebih pendek atau ganti model.'
    : !mentah.trim() ? 'AI ga ngasih isi apa-apa. Coba buat ulang atau ganti model.'
    : 'Format balasan AI tidak sesuai. Coba buat ulang.';
  return gagal(sebab + ` [model: ${res.model || '-'}, selesai: ${pilihan.finish_reason || '-'}, panjang: ${mentah.length} huruf, awal: ${mentah.slice(0, 120).replace(/\s+/g, ' ')}]`);
}

const daftar = (x) => (Array.isArray(x) ? x : []);
const teks = (x) => String(x || '').replace(/\*\*?/g, '').trim();
const poin = (x) => daftar(x).map(teks).filter(Boolean);
const blok = (b) => ({ pembicara: teks(b && b.pembicara), poin: poin(b && b.poin) });

const notulensi = {
  judul: teks(isi.judul),
  pimpinan: teks(isi.pimpinan),
  peserta: poin(isi.peserta),
  pengantar: daftar(isi.pengantar).map(blok).filter(b => b.poin.length),
  diskusi: daftar(isi.diskusi).map(b => ({ ...blok(b), tanggapan: daftar(b && b.tanggapan).map(blok).filter(t => t.poin.length) }))
    .filter(b => b.poin.length || b.tanggapan.length),
  penutup: poin(isi.penutup),
  model: res.model,
  token_in: u.prompt_tokens || 0,
  token_out: u.completion_tokens || 0,
  terpotong: pilihan.finish_reason === 'length',
  dibuat: new Date().toISOString(),
};
if (!notulensi.pengantar.length && !notulensi.diskusi.length) return gagal('AI ga menghasilkan isi notulensi. Coba buat ulang.');

return [{ json: { notulensi, notulensi_status: 'selesai', notulensi_error: null, ...token } }];
