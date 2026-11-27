// Pakai prompt sesuai jenis kegiatan (tabel jenis_kegiatan, diatur admin dari app).
// Kosong / tabel belum ada = pakai prompt bawaan dari node "Prompt sistem".
// ATURAN ditempel di akhir semua prompt: model seperti Gemini suka menambah garis "---",
// huruf miring, atau rumus LaTeX yang jadi berantakan di WhatsApp.
const ATURAN = '\n\nATURAN FORMAT (wajib, mengalahkan aturan format lain): tanda * hanya untuk judul bagian atau penebalan. JANGAN pakai huruf miring, garis pemisah (---), tabel, tanda #, emoji, rumus atau LaTeX (tulis "chi-square", bukan simbol). Istilah asing ditulis biasa tanpa penanda apa pun.';
const dasar = $('Prompt sistem').first().json;
const dariTabel = $input.all().map(i => i.json)
  .find(j => j && typeof j.prompt_ringkasan === 'string' && j.prompt_ringkasan.trim());
return [{ json: { ...dasar, sistem: (dariTabel ? dariTabel.prompt_ringkasan.trim() : dasar.sistem) + ATURAN } }];
