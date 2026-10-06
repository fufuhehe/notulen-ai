// Susun bahan untuk AI: transkrip (bisa dipotong sesuai rentang pilihan user)
// + kalau ada instruksi revisi: notulen sebelumnya + instruksinya.
const r = $input.first().json;
if (!Array.isArray(r.transkrip) || !r.transkrip.length) {
  throw new Error('Transkrip belum ada untuk rapat ini');
}

const nama = r.nama_speaker || {};
const label = (s) => nama[s] || ('Speaker ' + s);
const jam = (d) => [Math.floor(d / 3600), Math.floor(d / 60) % 60, Math.floor(d % 60)]
  .map(n => String(n).padStart(2, '0')).join(':');

// Rentang: mulai ikut, akhir tidak ikut (null = sampai habis)
const rg = r.rentang || {};
const mulai = Number.isFinite(rg.mulai) ? rg.mulai : null;
const akhir = Number.isFinite(rg.akhir) ? rg.akhir : null;
const dipakai = r.transkrip.filter(u => (mulai === null || u.m >= mulai) && (akhir === null || u.m < akhir));
if (!dipakai.length) throw new Error('Bagian rekaman yang dipilih kosong. Atur ulang rentangnya di tab Transkrip.');
const dipotong = mulai !== null || akhir !== null;

// Ucapan berurutan dari orang yang sama digabung jadi satu baris
const baris = [];
for (const u of dipakai) {
  const a = baris[baris.length - 1];
  if (a && a.s === u.s) a.t += ' ' + u.t;
  else baris.push({ s: u.s, m: u.m, t: u.t });
}

const peserta = [...new Set(dipakai.map(u => u.s))].sort().map(label).join(', ');
const tanggal = new Date(r.created_at).toLocaleDateString('id-ID', {
  timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
const totalDetik = r.durasi_detik || r.transkrip[r.transkrip.length - 1].m;
const awalBagian = dipakai[0].m;
const akhirBagian = akhir !== null ? akhir : totalDetik;
const durasi = jam(dipotong ? Math.max(0, akhirBagian - awalBagian) : totalDetik);

let prompt = `Judul: ${r.judul || 'Rapat'}
Tanggal: ${tanggal}
Durasi: ${durasi}
Peserta bicara: ${peserta}
${dipotong ? `Catatan: yang dicatat hanya bagian rekaman ${jam(awalBagian)}–${jam(akhirBagian)}; bagian lain sengaja dibuang.\n` : ''}
TRANSKRIP:
${baris.map(b => `[${jam(b.m)}] ${label(b.s)}: ${b.t}`).join('\n')}`;

const revisi = String(r.revisi || '').trim();
if (revisi && String(r.resume || '').trim()) {
  prompt = `MODE REVISI. Di bawah ada NOTULEN SEBELUMNYA, INSTRUKSI REVISI dari pengguna, lalu transkrip sebagai rujukan.
Tulis ulang notulen LENGKAP dengan format yang sama. Terapkan instruksi revisi dengan teliti. Bagian yang tidak disinggung instruksi tetap dipertahankan isinya (boleh dirapikan seperlunya). Instruksi pengguna lebih diutamakan daripada transkrip kalau keduanya berbeda (misalnya koreksi nama atau istilah).

INSTRUKSI REVISI:
${revisi}

NOTULEN SEBELUMNYA:
${String(r.resume).trim()}

=====
${prompt}`;
}

return [{ json: { prompt } }];
