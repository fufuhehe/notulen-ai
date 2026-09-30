// Ambil hasil AssemblyAI, simpan versi ringkas: speaker, detik mulai, teks
const t = $input.first().json;
const lama = $('Tandai ditranskrip').first().json;   // untuk menjumlah biaya kalau diproses ulang

const transkrip = (t.utterances || []).map(u => ({
  s: u.speaker,
  m: Math.round(u.start / 1000),
  t: u.text,
}));
if (!transkrip.length && t.text) transkrip.push({ s: 'A', m: 0, t: t.text });

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
} }];
