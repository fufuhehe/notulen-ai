// Pakai prompt sesuai jenis kegiatan (tabel jenis_kegiatan, diatur admin dari app).
// Kosong / tabel belum ada = pakai prompt bawaan dari node "Prompt sistem".
const dasar = $('Prompt sistem').first().json;
const dariTabel = $input.all().map(i => i.json)
  .find(j => j && typeof j.prompt_ringkasan === 'string' && j.prompt_ringkasan.trim());
return [{ json: { ...dasar, sistem: dariTabel ? dariTabel.prompt_ringkasan.trim() : dasar.sistem } }];
