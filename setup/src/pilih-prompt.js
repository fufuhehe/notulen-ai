// Pakai prompt sesuai jenis kegiatan (tabel jenis_kegiatan, diatur admin dari app).
// Kosong / tabel belum ada = pakai prompt bawaan dari node "Prompt sistem".
// ATURAN (format WA) dan ATURAN_ISI (transkrip rusak jangan dirakit jadi fakta; kosakata jangan dimunculkan
// kalau tidak dibicarakan) ditempel di akhir semua prompt ringkasan.
const ATURAN = "\n\nATURAN FORMAT (wajib, mengalahkan aturan format lain): tanda * hanya untuk judul bagian atau penebalan. JANGAN pakai huruf miring, garis pemisah (---), tabel, tanda #, emoji, rumus atau LaTeX (tulis \"chi-square\", bukan simbol). Istilah asing ditulis biasa tanpa penanda apa pun.";
const ATURAN_ISI = "\n\nATURAN ISI (wajib):\n- Transkrip mesin bisa berisi bagian rusak: kata atau kalimat yang diulang-ulang, kalimat tanpa makna, atau teks yang tidak nyambung dengan pembicaraan (mis. \"jangan lupa like, share dan subscribe\"). Lewati bagian seperti itu. JANGAN merakit angka, fakta, nama, atau kesimpulan dari bagian yang tidak jelas.\n- Kalau maksud suatu bagian masih bisa ditangkap tapi ragu, tetap tulis dan beri tanda (?) di akhir poinnya.\n- KOSAKATA PENGGUNA hanya untuk membetulkan ejaan kata yang memang muncul di transkrip. Jangan memunculkan istilah dari kosakata yang tidak dibicarakan.\n- Label pembicara bisa tertukar. Kalau isi pembicaraan jelas menunjukkan pembicara lain, ikuti isinya.\n- Jangan mengarang tanggapan, persetujuan, atau jabatan yang tidak diucapkan.\n";
const dasar = $('Prompt sistem').first().json;
const dariTabel = $input.all().map(i => i.json)
  .find(j => j && typeof j.prompt_ringkasan === 'string' && j.prompt_ringkasan.trim());
return [{ json: { ...dasar, sistem: (dariTabel ? dariTabel.prompt_ringkasan.trim() : dasar.sistem) + ATURAN + ATURAN_ISI } }];
