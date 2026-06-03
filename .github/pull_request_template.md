## Deskripsi
<!-- Berikan deskripsi yang jelas dan ringkas tentang perubahan yang diperkenalkan dalam PR ini -->

## Tipe Perubahan
- [ ] ✨ Fitur Baru
- [ ] 🐛 Perbaikan Bug
- [ ] ♻️ Refactor
- [ ] 📝 Dokumentasi
- [ ] 🚀 Peningkatan Performa

## Checklist Arsitektur
*Pastikan perubahan Anda mematuhi Modular Clean Architecture yang didefinisikan di `ARCHITECTURE.md` dan `.github/copilot-instructions.md`:*

- [ ] **Layering**: Mengikuti alur Controller → Service → Repository → Entity.
- [ ] **Business Logic**: Tidak ada business logic di Controller atau Repository (diletakkan di Service).
- [ ] **Data Access**: Tidak ada panggilan DB/ORM di Service (diletakkan di Repository).
- [ ] **Module Communication**: Hanya melakukan import dari file `index` modul lain (Public API).
- [ ] **Dependency Direction**: Arah dependensi mengalir ke dalam (outer layers depend on inner).
- [ ] **Entities**: Objek domain murni tanpa import dari ORM, framework, atau HTTP layer.
- [ ] **Error Handling**: Service melempar typed domain errors; Controller tidak menangkapnya.
- [ ] **Import Paths**: Semua import TypeScript menggunakan ekstensi `.js` (NodeNext ESM).

## Quality Assurance
- [ ] **Keamanan**: Sudah diperiksa dari SQL Injection, XSS, SSRF, dan paparan data sensitif.
- [ ] **Performa**: Tidak ada N+1 queries atau loop yang tidak efisien.
- [ ] **Maintainability**: Mengikuti prinsip SOLID dan konsistensi penamaan.
- [ ] **Testing**: Unit/Integration test telah ditambahkan atau diperbarui.

## Screenshot / Log
<!-- Tambahkan screenshot atau log jika relevan -->

## Issue Terkait
<!-- contoh: Fixes #123 -->
