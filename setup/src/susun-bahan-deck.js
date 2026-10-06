// Siapkan bahan untuk deck: dari resume atau dari transkrip lengkap
const r = $input.first().json;
const sumber = r.deck_sumber === 'transkrip' ? 'transkrip' : 'resume';

const nama = r.nama_speaker || {};
const label = (s) => nama[s] || ('Speaker ' + s);
const jam = (d) => [Math.floor(d / 3600), Math.floor(d / 60) % 60, d % 60]
  .map(n => String(n).padStart(2, '0')).join(':');
const tanggal = new Date(r.created_at).toLocaleDateString('id-ID', {
  timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

let bahan = '';
if (sumber === 'resume') {
  bahan = (r.resume || '').trim();
} else if (Array.isArray(r.transkrip) && r.transkrip.length) {
  // ikut rentang pilihan user (mulai ikut, akhir tidak ikut)
  const rg = r.rentang || {};
  const mulai = Number.isFinite(rg.mulai) ? rg.mulai : null, akhir = Number.isFinite(rg.akhir) ? rg.akhir : null;
  const baris = [];
  for (const u of r.transkrip.filter(u => (mulai === null || u.m >= mulai) && (akhir === null || u.m < akhir))) {
    const a = baris[baris.length - 1];
    if (a && a.s === u.s) a.t += ' ' + u.t; else baris.push({ s: u.s, m: u.m, t: u.t });
  }
  bahan = baris.map(b => `[${jam(b.m)}] ${label(b.s)}: ${b.t}`).join('\n');
}

if (!bahan) {
  return [{ json: { gagal: true, sumber, error: `Bahan kosong: ${sumber} belum ada untuk rapat ini` } }];
}

return [{ json: {
  gagal: false,
  sumber,
  prompt: `Judul rapat: ${r.judul || 'Rapat'}
Tanggal: ${tanggal}
Durasi: ${jam(r.durasi_detik || 0)}
Sumber bahan: ${sumber === 'resume' ? 'NOTULEN (sudah diringkas)' : 'TRANSKRIP MENTAH'}

BAHAN:
${bahan}`,
} }];
