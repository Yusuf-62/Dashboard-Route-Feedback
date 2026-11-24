# Dashboard Route Feedback Kalimantan

Dashboard statis untuk GitHub Pages. Data dibaca dari file `data/dayN.json` pada repository `Yusuf-62/Dashboard-Route-Feedback`, branch `main`.

## Instalasi

1. Salin `index.html`, folder `assets/` ke root repository.
2. Pastikan JSON harian berada di `data/` dengan pola `day1.json`, `day2.json`, dan seterusnya.
3. Aktifkan GitHub Pages dari Settings → Pages → Deploy from a branch → `main` → `/ (root)`.
4. Buka URL GitHub Pages repository.

## Logo SNS

Simpan logo PNG di `assets/img/logo-sns.png`. Dashboard menggunakan placeholder teks SNS jika file belum tersedia.

## Sumber data

`assets/js/data.js` membaca daftar file pada GitHub Contents API folder `data`, kemudian mengambil file JSON dari raw.githubusercontent.com. Repository harus public agar dashboard statis dapat mengambil data tanpa token.

## Rumus KPI yang diterapkan

- Avg 1st Outlet: average `Waktu Mulai` hanya pada baris `Kunjungan = 1` (kunjungan pertama salesman).
- Jumlah JKS: jumlah baris dengan `szCustId` terisi.
- Out of Route: `MAX(0, Average EC seluruh baris - Count szCustId)`, mengikuti rumus yang dijelaskan.
- Durasi Kunjungan: average `Durasi` dengan `Alasan 2 = Sukses`.
- Sukses/Gagal: jumlah baris `Alasan 2` masing-masing.
- Effective Call: average `EC` dengan `Alasan 2 = Sukses`.
- SKU/Faktur: average `SKU/faktur`.
- Salesman terlambat: hitung `Status 1st Outlet = Terlambat` hanya pada baris `Kunjungan = 1`, agar status yang berulang pada setiap kunjungan tidak dihitung berkali-kali.
- Salesman gagal order: jumlah baris `Alasan 2 = Gagal` per Sales.
- Kurang dari 2 menit: penjumlahan `Kurang 2 Menit` per Sales.
- Gagal order berdasarkan alasan: jumlah baris gagal per `Alasan`.
- EC vs PC: average `%PC` per `Tipe Sales`, ditampilkan sebagai persen.

Catatan: rumus Out of Route mengikuti interpretasi `Average EC - Count szCustId` dari rumus Excel yang dijelaskan. Jika referensi BA5/BD7 sebenarnya mengambil pivot range/field lain, sesuaikan fungsi `aggregate()` di `assets/js/app.js`.

## Catatan teknis

- `data.js` menghapus UTF-8 BOM sebelum `JSON.parse`, karena file hasil VBA ADODB.Stream dapat memiliki BOM.
- Library ECharts dan Lucide dimuat dari CDN.
- Tidak ada token GitHub di frontend. Jangan pernah menaruh PAT di JavaScript/HTML/CSS.


## Revisi layout dashboard

- Sidebar filter dapat disembunyikan/dimunculkan dengan tombol panel di header.
- Menu Dashboard Utama dan Rincian Kunjungan berada di sidebar.
- Pada desktop, overview menggunakan layout ringkas satu layar; pada layar kecil halaman tetap dapat discroll.
- Jika satu hari dipilih, salesman terlambat ditampilkan sebagai horizontal bar chart.
- Jika lebih dari satu hari dipilih (atau seluruh hari tersedia), panel keterlambatan berubah menjadi daftar nama salesman, rata-rata Waktu Mulai kunjungan pertama, dan jumlah hari terlambat.
- Grafik Average EC per Sales dan Average PC per Tipe Sales menggunakan angka bulat.
- Tabel rincian kunjungan dipindahkan ke tampilan terpisah.


## Perbaikan tambahan
- Header atas dihapus; navigasi tetap melalui sidebar.
- Perhitungan waktu outlet pertama menggunakan Waktu Mulai paling awal per Sales dan Tanggal.
- Status terlambat dihitung satu kali per Sales per hari walaupun nilainya berulang pada baris kunjungan.
- Grafik satu hari memakai horizontal bar chart; mode multi-hari memakai daftar.
- Grafik bawah diubah menjadi dua kolom agar label dan batang lebih mudah dibaca.
