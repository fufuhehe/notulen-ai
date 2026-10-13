// Susun transkrip (ikut rentang pilihan user) untuk notulensi lengkap
const r = $input.first().json;
if (!Array.isArray(r.transkrip) || !r.transkrip.length) {
  return [{ json: { gagal: true, error: 'Transkrip belum ada untuk rapat ini' } }];
}
const nama = r.nama_speaker || {};
const label = (s) => nama[s] || ('Speaker ' + s);
const jam = (d) => [Math.floor(d / 3600), Math.floor(d / 60) % 60, Math.floor(d % 60)]
  .map(n => String(n).padStart(2, '0')).join(':');

const rg = r.rentang || {};
const mulai = Number.isFinite(rg.mulai) ? rg.mulai : null;
const akhir = Number.isFinite(rg.akhir) ? rg.akhir : null;
const dipakai = r.transkrip.filter(u => (mulai === null || u.m >= mulai) && (akhir === null || u.m < akhir));
if (!dipakai.length) return [{ json: { gagal: true, error: 'Bagian rekaman yang dipilih kosong. Atur ulang rentangnya di tab Transkrip.' } }];

const baris = [];
for (const u of dipakai) {
  const a = baris[baris.length - 1];
  if (a && a.s === u.s) a.t += ' ' + u.t;
  else baris.push({ s: u.s, m: u.m, t: u.t });
}
const tanggal = new Date(r.created_at).toLocaleDateString('id-ID', {
  timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
const peserta = [...new Set(dipakai.map(u => u.s))].sort().map(label).join(', ');

return [{ json: { gagal: false, prompt: `Judul rapat (dari pengguna, boleh diperbaiki): ${r.judul || 'Rapat'}
Tanggal: ${tanggal}
Pembicara yang terekam: ${peserta}

TRANSKRIP:
${baris.map(b => `[${jam(b.m)}] ${label(b.s)}: ${b.t}`).join('\n')}` } }];
