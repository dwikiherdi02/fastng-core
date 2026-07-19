# 22 — Pemecahan Modul RBAC (permission / menu / role / session)

**Tujuan**: Menjelaskan pemecahan tabel RBAC dari satu fragmen `auth` menjadi modul-modul terpisah, beserta aturan FK antar-modul dan urutan `dependsOn`.

**Kapan digunakan**: Saat menambah tabel yang berelasi dengan tabel milik modul lain, atau memahami kepemilikan tabel RBAC.

**Prasyarat**: Memahami migrasi per-module (`tutorial/18`) dan manifest (`tutorial/19`).

## Pengenalan

Pada v2 semua tabel RBAC tinggal di `src/modules/auth/db/auth.prisma`. Mulai v3 tabel dipecah agar tiap domain punya modulnya sendiri (kepemilikan jelas, bisa dikembangkan terpisah):

| Modul | Tabel | dependsOn |
|---|---|---|
| `permission` | `permissions` | — |
| `menu` | `menus`, `menu_permissions` | `permission` |
| `role` | `roles`, `role_menu_permissions` | `menu` |
| `session` | `sessions` | — |
| `auth` | `users`, `user_roles`, `user_menu_permissions` | `role`, `menu`, `session` |
| `users` | (tanpa tabel) | `auth`, `role` |

## Aturan Utama: Fragmen Mandiri + FK Skalar

Tabel RBAC saling mereferensi dua arah (mis. `user_roles` butuh `users` **dan** `roles`). Jika kita paksa `@relation` lintas modul, `dependsOn` menjadi **siklik** dan loader/assembler gagal. Karena itu **FK antar-modul memakai kolom skalar tanpa `@relation`**:

```prisma
// role/db/role.prisma
model RoleMenuPermission {
  roleId           String @map("role_id")
  menuPermissionId String @map("menu_permission_id") // scalar → milik modul menu, tanpa @relation
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade) // intra-modul: boleh
  @@map("role_menu_permissions")
}
```

Konsekuensi: **tidak ada cascade DB lintas modul**. Cascade dilakukan di service memakai `withTransaction` (mis. saat menghapus user, sesi di modul `session` dihapus manual — lihat `src/modules/users/services/user.service.ts`).

## Alur/Mekanisme

```
db:sync assembler menggabungkan fragmen semua modul AKTIF → prisma/schema.prisma
   urutan dependsOn menjamin: permission, menu, session, role, auth, users, welcome
Query lintas tabel dilakukan step-wise (bukan include relasi) di core/rbac/rbac.reader.ts
```

## Langkah Menambah Tabel yang Mereferensi Modul Lain

1. Tambahkan model di fragmen modul Anda; kolom FK ke modul lain **skalar** (`@map("...")`), tanpa `@relation`.
2. Set `dependsOn` modul Anda ke modul yang tabelnya Anda referensikan (untuk urutan + validasi enable).
3. Untuk baca lintas tabel, lakukan query bertahap (resolve id per langkah), lihat `MenuPrismaRepository.listCatalog()` sebagai contoh.
4. Untuk hapus yang harus cascade lintas modul, gunakan `withTransaction` di service.
5. `bun run db:sync` + `bun run db:seed`.

## Verifikasi

1. `bun run db:sync` merakit skema dari semua fragmen tanpa error.
2. Nonaktifkan modul `role` → `auth`/`users` gagal validasi dependency dengan pesan jelas.
3. `GET /api/v1/menus` dan `/permissions` mengembalikan katalog dari modul menu/permission.

## Referensi Kode Aktual

- `src/modules/{permission,menu,role,session}/db/*.prisma` — fragmen per modul.
- `src/registry/module.registry.ts` — `dependsOn` graph.
- `src/core/database/schema-builder.ts` — perakitan skema.
- `src/modules/users/services/user.service.ts` — cascade lintas modul via transaksi.

## Catatan

- Baris pivot yatim (mis. `user_roles` yang role-nya dihapus) tidak berbahaya: reader memfilter berdasarkan role yang masih ada.

## Lihat Juga

- `tutorial/18-migrasi-seeder-per-module.md`
- `tutorial/23-hak-akses-per-user-dan-cascade-can-access.md`
