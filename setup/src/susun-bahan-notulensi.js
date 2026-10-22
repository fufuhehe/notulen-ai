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

const koreksi = String(r.koreksi || '').trim();
const kosakata = String(r.kosakata || '').trim();
let prompt = `Judul rapat (dari pengguna, boleh diperbaiki): ${r.judul || 'Rapat'}
Tanggal: ${tanggal}
Pembicara yang terekam: ${peserta}
${koreksi ? `
CATATAN KOREKSI DARI PENGGUNA (wajib diterapkan di seluruh notulensi; lebih diutamakan daripada transkrip, terutama ejaan nama, jabatan, dan istilah):
${koreksi}
` : ''}${kosakata ? `
KOSAKATA PENGGUNA (ejaan yang benar untuk nama/istilah yang mungkin muncul):
${kosakata}
` : ''}
TRANSKRIP:
${baris.map(b => `[${jam(b.m)}] ${label(b.s)}: ${b.t}`).join('\n')}`;

// Mode revisi: notulensi sebelumnya + instruksi pengguna (dipakai sekali, lalu dikosongkan)
const revisi = String(r.notulensi_revisi || '').trim();
const nt = r.notulensi;
if (revisi && nt && typeof nt === 'object') {
  const lama = { judul: nt.judul, pimpinan: nt.pimpinan, peserta: nt.peserta, pengantar: nt.pengantar, diskusi: nt.diskusi, penutup: nt.penutup };
  prompt = `MODE REVISI. Di bawah ada INSTRUKSI REVISI dari pengguna, NOTULENSI SEBELUMNYA (JSON), lalu transkrip sebagai rujukan.
Keluarkan ulang notulensi LENGKAP dengan struktur JSON yang sama. Terapkan instruksi revisi dengan teliti. Bagian yang tidak disinggung instruksi tetap dipertahankan isinya. Instruksi pengguna lebih diutamakan daripada transkrip kalau keduanya berbeda.

INSTRUKSI REVISI:
${revisi}

NOTULENSI SEBELUMNYA:
${JSON.stringify(lama)}

=====
${prompt}`;
}

return [{ json: { gagal: false, prompt } }];
