# 19 — Manifest Menu & Permission per Modul

> **Update v3.0.0**: `permissions` kini array objek `{ code, name?, description, route? }` (bukan `string[]`). `description` wajib dan tampil di checklist admin + docs Scalar. Contoh:
> ```ts
> permissions: [
>   { code: 'can_access', description: 'Access the menu' },
>   { code: 'read', description: 'View items', route: { method: 'GET', path: '/api/v1/items' } },
> ]
> ```

**Tujuan**: Menjelaskan file `{name}.manifest.ts` yang mendeklarasikan apakah sebuah modul adalah menu sidebar dan permission apa yang didukungnya.

**Kapan digunakan**: Saat membuat modul yang tampil di sidebar, atau modul service/helper yang bukan menu.

**Prasyarat**: Memahami registry modul (`tutorial/01-menambah-modul-baru.md`).

## Pengenalan

Katalog menu & permission tidak disimpan di kode aplikasi secara tersebar, melainkan dideklarasikan satu tempat per modul: `src/modules/{name}/{name}.manifest.ts`. File ini murni data (tanpa efek samping), sehingga aman diimport walau modul sedang nonaktif — CLI membutuhkannya untuk tahu apa yang harus dihapus saat modul dinonaktifkan.

Kami memilih **manifest TypeScript** (bukan YAML) agar type-safe, tanpa dependency tambahan, dan langsung diimport oleh loader ESM.

## Alur/Mekanisme

```
loadManifests()  → import {name}.manifest.ts tiap modul (aktif & nonaktif)
                 → { enabled: [...], disabled: [...] }
syncCatalog()    → enabled+menu  : upsert menu + permission
                 → disabled+menu : hapus menu + grant terkait
```

## Langkah-Langkah

### Langkah 1: Tentukan tipe modul

**Modul menu** (tampil di sidebar):

```ts
// src/modules/users/users.manifest.ts
import type { ModuleManifest } from '../../registry/manifest.js'

export const manifest: ModuleManifest = {
  menu: { code: 'user_management', name: 'User Management', icon: 'users', path: '/users', order: 2 },
  permissions: ['can_access', 'create', 'read', 'update', 'delete', 'export'],
}
```

**Modul service/helper** (bukan menu):

```ts
// src/modules/auth/auth.manifest.ts
export const manifest: ModuleManifest = { menu: false }
```

Menu bertingkat: isi `parent` dengan `code` menu induk.

```ts
menu: { code: 'user_roles', name: 'Roles', parent: 'user_management', path: '/users/roles', order: 1 }
```

### Langkah 2: Sinkronkan

```bash
bun run db:sync   # menu + menu_permissions dibuat/diperbarui/dihapus
```

### Langkah 3: Manfaatkan permission di route

Permission yang dideklarasikan menjadi katalog yang dipakai `fastify.authorize('user_management', 'export')` (lihat `tutorial/17-...`).

## Contoh Lengkap

Definisi tipe di `src/registry/manifest.ts`:

```ts
export interface MenuManifest {
  code: string; name: string; icon?: string; path?: string; parent?: string; order?: number
}
export interface ModuleManifest {
  menu?: MenuManifest | false
  permissions?: string[] // ['create','read','update','delete','export','can_access', ...]
}
```

`can_access` adalah permission khusus: menu hanya muncul di `GET /me/menus` bila role user punya `can_access` pada menu tersebut.

## Aturan/Pedoman

| ✅ Lakukan | ❌ Hindari |
|---|---|
| `menu: false` untuk service/helper | Membuat manifest dengan menu palsu agar "muncul" |
| Sertakan `can_access` bila ingin tampil di sidebar | Lupa `db:sync` setelah mengubah manifest |
| `code` menu unik & stabil | Mengganti `code` (memutus grant yang ada) |

## Verifikasi

1. Tambah/ubah manifest → `bun run db:sync` → cek output `upserted menus: ...`.
2. Untuk modul menu, `GET /api/v1/auth/me/menus` menampilkannya (jika role punya `can_access`).

## Referensi Kode Aktual

- `src/registry/manifest.ts` — tipe & `loadManifests()`.
- `src/modules/users/users.manifest.ts` — contoh menu.
- `src/modules/auth/auth.manifest.ts` — contoh non-menu.
- `src/core/database/sync/catalog-sync.ts` — orkestrasi sinkron.

## Catatan

- Modul tanpa file manifest diperlakukan sebagai service tanpa menu/permission.
- Menu induk harus berasal dari modul yang juga aktif; jika induk tak ditemukan, menu anak menjadi root.

## Lihat Juga

- `tutorial/17-rbac-dinamis-user-role-menu-permission.md`
- `tutorial/18-migrasi-seeder-per-module.md`
