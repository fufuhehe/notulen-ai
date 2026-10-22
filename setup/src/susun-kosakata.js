// Gabungkan kosakata akun (jenis 'semua' + jenis rapat ini).
// Tiap baris bisa berupa istilah ("regresi linier") atau perbaikan salah dengar ("kuatitatif → kuantitatif").
// - istilah + sisi benar → keyterms AssemblyAI (maks 200, maks 6 kata) dan bahan ejaan untuk AI
// - pasangan salah → benar → diganti langsung di teks transkrip (node Ringkas transkrip)
// Tabel belum ada / kosong = semua kosong (transkrip tetap jalan seperti biasa).
const r = $('Tandai ditranskrip').first().json;
const baris = $input.all().map(i => i.json)
  .filter(j => j && typeof j.istilah === 'string')
  .flatMap(j => j.istilah.split(/\n+/));
const bersih = (x) => String(x || '').replace(/\s+/g, ' ').replace(/^[-•*\d.)\s]+/, '').trim();
const ganti = [], istilahMentah = [];
for (const b of baris) {
  const m = b.split(/\s*(?:→|->|=>|=)\s*/);
  if (m.length >= 2 && bersih(m[0]) && bersih(m[1])) {
    for (const salah of m[0].split(/\s*[\/|]\s*/).map(bersih).filter(Boolean)) ganti.push([salah, bersih(m[1])]);
    istilahMentah.push(bersih(m[1]));
  } else istilahMentah.push(...b.split(/[,;]+/).map(bersih));
}
const lihat = new Set();
const istilah = istilahMentah
  .filter(x => x && x.length <= 60 && x.split(' ').length <= 6)     // batas AssemblyAI: maks 6 kata per istilah
  .filter(x => { const k = x.toLowerCase(); if (lihat.has(k)) return false; lihat.add(k); return true; })
  .slice(0, 200);                                                      // Universal-2: maks 200 istilah
const teks = [istilah.join(', '), ...ganti.map(([a, b]) => `${a} → ${b}`)].filter(Boolean).join('\n');
return [{ json: { istilah, ganti, teks, adaKolom: 'kosakata' in r } }];
