# Mengaktifkan dan Menonaktifkan Modul

FastNG menggunakan registry terpusat di `src/registry/module.registry.ts` untuk mengontrol modul mana yang aktif. Modul yang dinonaktifkan tidak akan dimuat — route, service, dan repository-nya tidak ada di runtime.

---

## Struktur Registry

```ts
// src/registry/module.registry.ts
export const modules = [
  {
    name: 'welcome',
    enabled: true,
    path: '../modules/welcome/module.js',   // NodeNext ESM: path value stays .js
    dependsOn: []
  },
  {
    name: 'auth',
    enabled: true,
    path: '../modules/auth/module.js',
    dependsOn: []
  },
  {
    name: 'users',
    enabled: true,
    path: '../modules/users/module.js',
    dependsOn: ['auth']   // users butuh auth sudah terdaftar dulu
  }
]
```

Setiap entri memiliki 4 field:
- `name` — identifier unik, dipakai sebagai referensi di `dependsOn`
- `enabled` — `true` untuk aktif, `false` untuk nonaktif
- `path` — path relatif dari `src/registry/` ke file `module.js`
- `dependsOn` — array nama modul yang harus dimuat sebelum modul ini

---

## Cara Menonaktifkan Modul

Ubah `enabled` menjadi `false`:

```ts
{
  name: 'welcome',
  enabled: false,   // dinonaktifkan
  path: '../modules/welcome/module.js',
  dependsOn: []
}
```

Restart server (`npm run dev`) — route `GET /` tidak akan tersedia lagi. Log startup tidak akan menampilkan modul ini.

---

## Cara Mengaktifkan Kembali

Ubah kembali ke `enabled: true` dan restart server.

---

## Feature Flag via Environment Variable

Untuk mengontrol modul berdasarkan environment tanpa mengubah kode:

```ts
// src/registry/module.registry.ts
export const modules = [
  // ... modul lain ...
  {
    name: 'payments',
    enabled: process.env.PAYMENTS_ENABLED === 'true',
    path: '../modules/payments/module.js',
    dependsOn: ['auth', 'users']
  }
]
```

Di `.env` development:
```
PAYMENTS_ENABLED=false
```

Di `.env` production:
```
PAYMENTS_ENABLED=true
```

Ganti env var, restart server — tidak perlu ubah kode sama sekali.

---

## Cara Kerja `dependsOn`

`module.loader.ts` menggunakan **Kahn's topological sort** untuk menentukan urutan loading:

```
Contoh dengan dependensi:
  auth        — tidak ada dependency → dimuat pertama
  users       — dependsOn: ['auth'] → dimuat setelah auth
  posts       — dependsOn: ['users'] → dimuat setelah users
  comments    — dependsOn: ['posts', 'users'] → dimuat setelah keduanya

Urutan load: auth → users → posts → comments
```

**Kapan perlu mengisi `dependsOn`?**

- Jika di dalam `module.js` kamu mengakses decorator, service, atau repository dari modul lain saat registrasi
- Contoh: modul `users` membutuhkan decorator `fastify.authenticate` yang didaftarkan oleh modul `auth`

**Jika modul berdiri sendiri** (tidak perlu apapun dari modul lain), isi dengan array kosong: `dependsOn: []`

---

## Verifikasi Modul Aktif

Saat server start, lihat log di terminal:

```
[ModuleLoader] Loading module: auth
[ModuleLoader] Loading module: users
[ModuleLoader] Loading module: posts
[Server] Server running at http://localhost:3000
```

Modul dengan `enabled: false` **tidak akan muncul** di log dan route-nya tidak terdaftar.

---

## Error Dependency

Jika modul yang dibutuhkan dinonaktifkan, server akan error saat startup:

```
Error: Module 'users' depends on 'auth', but 'auth' is disabled or not found in registry.
```

Solusi: pastikan semua modul yang ada di `dependsOn` juga `enabled: true`.

---

## Contoh: Menambah Modul Baru ke Registry

Setelah membuat modul `posts` (lihat [Menambah Modul Baru](01-menambah-modul-baru.md)):

```ts
// src/registry/module.registry.ts
export const modules = [
  { name: 'welcome', enabled: true, path: '../modules/welcome/module.js', dependsOn: [] },
  { name: 'auth', enabled: true, path: '../modules/auth/module.js', dependsOn: [] },
  { name: 'users', enabled: true, path: '../modules/users/module.js', dependsOn: ['auth'] },

  // Tambahkan di sini:
  {
    name: 'posts',
    enabled: true,
    path: '../modules/posts/module.js',
    dependsOn: ['auth', 'users']   // posts butuh auth (untuk authenticate) dan users (jika ada relasi)
  }
]
```
