// Susun transkrip yang sudah diberi nama speaker, untuk dikirim ke OpenAI
const r = $input.first().json;
if (!Array.isArray(r.transkrip) || !r.transkrip.length) {
  throw new Error('Transkrip belum ada untuk rapat ini');
}

const nama = r.nama_speaker || {};
const label = (s) => nama[s] || ('Speaker ' + s);
const jam = (d) => [Math.floor(d / 3600), Math.floor(d / 60) % 60, d % 60]
  .map(n => String(n).padStart(2, '0')).join(':');

// Ucapan berurutan dari orang yang sama digabung jadi satu baris
const baris = [];
for (const u of r.transkrip) {
  const akhir = baris[baris.length - 1];
  if (akhir && akhir.s === u.s) akhir.t += ' ' + u.t;
  else baris.push({ s: u.s, m: u.m, t: u.t });
}

const peserta = [...new Set(r.transkrip.map(u => u.s))].sort().map(label).join(', ');
const tanggal = new Date(r.created_at).toLocaleDateString('id-ID', {
  timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
const durasi = jam(r.durasi_detik || r.transkrip[r.transkrip.length - 1].m);

const prompt = `Judul: ${r.judul || 'Rapat'}
Tanggal: ${tanggal}
Durasi: ${durasi}
Peserta bicara: ${peserta}

TRANSKRIP:
${baris.map(b => `[${jam(b.m)}] ${label(b.s)}: ${b.t}`).join('\n')}`;

return [{ json: { prompt } }];
