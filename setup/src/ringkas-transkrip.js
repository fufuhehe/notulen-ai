// Ambil hasil AssemblyAI, simpan versi ringkas: speaker, detik mulai, teks
const t = $input.first().json;
const lama = $('Tandai ditranskrip').first().json;   // untuk menjumlah biaya kalau diproses ulang
const kos = $('Susun kosakata').first().json;         // kosakata yang dipakai, disimpan untuk ringkasan/notulensi

// Perbaikan salah dengar dari kosakata ("kuatitatif → kuantitatif"), utuh per kata, tanpa peduli huruf besar/kecil
const lolos = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const aturan = (kos.ganti || []).map(([salah, benar]) => [new RegExp(`(?<![\\p{L}\\p{N}])${lolos(salah)}(?![\\p{L}\\p{N}])`, 'giu'), benar]);
const perbaiki = (x) => aturan.reduce((a, [re, b]) => a.replace(re, b), String(x || ''));

const transkrip = (t.utterances || []).map(u => ({
  s: u.speaker,
  m: Math.round(u.start / 1000),
  t: perbaiki(u.text),
}));
if (!transkrip.length && t.text) transkrip.push({ s: 'A', m: 0, t: perbaiki(t.text) });

if (!transkrip.length) {
  return [{ json: { status: 'gagal', error: 'Transkrip kosong. Audio mungkin tanpa suara atau rusak.',
    stt_detik: (lama.stt_detik || 0) + Math.round(t.audio_duration || 0) } }];
}

return [{ json: {
  status: 'minta_resume',          // otomatis memicu workflow Resume
  transcript_id: t.id,
  durasi_detik: Math.round(t.audio_duration || 0),
  stt_model: t.speech_model_used || null,
  stt_detik: (lama.stt_detik || 0) + Math.round(t.audio_duration || 0),
  transkrip,
  error: null,
  ...(kos.adaKolom ? { kosakata: kos.teks || null } : {}),
} }];
