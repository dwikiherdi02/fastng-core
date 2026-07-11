# 17 — RBAC Dinamis: User → Role → Menu → Permission

**Tujuan**: Menjelaskan model otorisasi dinamis di FastNG di mana permission tidak di-hardcode, melainkan dikatalogkan per-menu dan diberikan (grant) per-role.

**Kapan digunakan**: Saat Anda perlu membatasi akses endpoint berdasarkan permission spesifik (`create`, `read`, `update`, `delete`, `export`, `can_access`, dst.) yang bisa berbeda untuk tiap menu/modul, dan bisa diubah admin tanpa migrasi schema.

**Prasyarat**: Modul `auth` aktif; database sudah di-`yarn db:sync` dan di-`yarn db:seed`.

## Pengenalan

RBAC lama hanya punya satu kolom `role: string` pada `User` dan cek `role === 'admin'`. Itu kaku: menambah permission baru berarti mengubah kode. Model baru bersifat **dinamis**:

- **User ↔ Role** — many-to-many (`user_roles`). Satu user bisa punya banyak role.
- **Permission** — katalog global (`permissions`). Menambah permission = menambah satu baris, tanpa migrasi.
- **Menu ↔ Permission** — `menu_permissions` mencatat permission apa saja yang *tersedia* untuk sebuah menu (menu A mendukung `create/read/update/delete/export`, menu B hanya `can_access`).
- **Role → Menu Permission** — `role_menu_permissions` mencatat, dari permission yang tersedia di menu itu, mana yang benar-benar *dimiliki* sebuah role.

Resolusi multi-role bersifat **union** (paling permisif): jika salah satu role user punya permission tersebut, akses diberikan.

## Alur/Mekanisme

```
User ──< user_roles >── Role ──< role_menu_permissions >── MenuPermission >── Menu
                                                                     └─────────< Permission

Cek izin: apakah ADA baris role_menu_permissions untuk (role ∈ roles user)
          yang menunjuk MenuPermission dengan (menu.code = X dan permission.code = Y)?
```

Permission **tidak** ditaruh di dalam JWT (bisa panjang & berubah saat admin mengedit role). JWT hanya membawa `roles`; permission di-resolve di server dari `role_menu_permissions`.

## Langkah-Langkah

### Langkah 1: Deklarasikan menu + permission di manifest modul

Setiap modul yang merupakan menu mendeklarasikan katalognya di `src/modules/{name}/{name}.manifest.ts`. Lihat `tutorial/19-manifest-menu-permission-module.md`.

```ts
// src/modules/users/users.manifest.ts
export const manifest: ModuleManifest = {
  menu: { code: 'user_management', name: 'User Management', icon: 'users', path: '/users', order: 2 },
  permissions: ['can_access', 'create', 'read', 'update', 'delete', 'export'],
}
```

### Langkah 2: Sinkronkan katalog & seed role

```bash
yarn db:sync   # membuat menu + menu_permissions dari manifest
yarn db:seed   # membuat role admin (semua permission) & user (can_access) + admin user
```

### Langkah 3: Lindungi route dengan guard `authorize`

```ts
// src/modules/users/routes/user.routes.ts
const canRead = { preHandler: [fastify.authenticate, fastify.authorize('user_management', 'read')] }
const canDelete = { preHandler: [fastify.authenticate, fastify.authorize('user_management', 'delete')] }

fastify.get('/', { schema: listUsersSchema, ...canRead }, (req, rep) => controller.listUsers(req, rep))
fastify.delete('/:id', { schema: deleteUserSchema, ...canDelete }, (req, rep) => controller.deleteUser(req, rep))
```

`fastify.authenticate` **harus** dijalankan sebelum `fastify.authorize` (guard membaca `request.user.roles`).

## Contoh Lengkap

`fastify.authorize(menuCode, permissionCode)` didefinisikan di `src/core/plugins/auth-guard.plugin.ts`:

```ts
fastify.decorate('authorize', function (menuCode: string, permissionCode: string) {
  return async function (request: FastifyRequest): Promise<void> {
    const roles = request.user?.roles ?? []
    const reader = createRbacReader(fastify.db)
    const allowed = await reader.hasPermission(roles, menuCode, permissionCode)
    if (!allowed) throw new ForbiddenError(`Missing permission "${permissionCode}" on "${menuCode}"`)
  }
})
```

Query izin sebenarnya ada di `src/core/rbac/rbac.reader.ts` (Prisma & Mongo), sehingga plugin `core` tidak perlu meng-import modul.

## Aturan/Pedoman

| ✅ Lakukan | ❌ Hindari |
|---|---|
| Deklarasikan permission di manifest, lalu `db:sync` | Meng-hardcode cek `role === 'admin'` |
| Pakai `fastify.authorize('menu', 'perm')` untuk aksi granular | Menaruh daftar permission di dalam JWT |
| Pakai `fastify.requireRole('admin')` untuk cek role kasar | Membuat query RBAC di dalam controller |
| Urutan preHandler: `[authenticate, authorize]` | Memanggil `authorize` tanpa `authenticate` |

## Verifikasi

1. Login sebagai admin → `GET /api/v1/users` → **200**.
2. Register user biasa (role default `user`) → `GET /api/v1/users` → **403** `Missing permission "read" on "user_management"`.
3. `GET /api/v1/auth/me/menus` mengembalikan pohon menu sesuai grant `can_access`.

## Referensi Kode Aktual

- `src/modules/auth/db/auth.prisma` — tabel RBAC.
- `src/core/rbac/rbac.reader.ts` — `hasPermission()` dan `getAccessibleMenus()`.
- `src/core/plugins/auth-guard.plugin.ts` — decorator `authorize` / `requireRole`.
- `src/modules/users/routes/user.routes.ts` — contoh pemakaian guard.

## Catatan

- Resolusi permission dilakukan per-request (satu query). Untuk skala besar, cache per-role di Redis (invalidasi saat admin mengubah grant) bisa ditambahkan nanti.
- Explicit-deny override belum ada; default union sudah cukup untuk versi awal.

## Lihat Juga

- `tutorial/19-manifest-menu-permission-module.md`
- `tutorial/20-session-control-force-logout.md`
- `.claude/rules/auth-and-jobs.md`
