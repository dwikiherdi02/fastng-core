# 23 — Hak Akses Per-User (Override) & Cascade can_access

**Tujuan**: Menjelaskan override permission di level user (allow/deny) di atas grant role, dan perilaku `can_access` sebagai gerbang utama menu.

**Kapan digunakan**: Saat admin perlu memberi/mencabut satu permission untuk satu user tertentu tanpa mengubah role-nya.

**Prasyarat**: RBAC dinamis (`tutorial/17`) sudah dipahami; `bun run db:sync` + `bun run db:seed` sudah dijalankan.

## Pengenalan

Grant permission ada di dua level:

- **Role-level** — `role_menu_permissions` (dari modul `role`). Semua user dengan role itu mewarisi grant.
- **User-level** — `user_menu_permissions` (dari modul `auth`), dengan `effect` = `allow` atau `deny`. Ini **override** untuk satu user.

Contoh: user "Budi" berperan `manager` (punya `user_management:read`). Admin bisa **mencabut** `read` khusus Budi (effect `deny`) tanpa mengubah role `manager`, atau **menambah** permission ekstra (effect `allow`) yang tidak dimiliki rolenya.

## Resolusi Efektif

```
effective(user, menu, permission):
  1. Ada user override?  deny → DITOLAK,  allow → DIIZINKAN
  2. Selain itu: ada grant dari salah satu role user? → DIIZINKAN
  3. Selain itu → DITOLAK
```

Override user **selalu menang** atas role. Resolusi antar-role tetap union (paling permisif).

## Cascade can_access

`can_access` adalah gerbang seluruh menu. Setiap cek permission non-`can_access` **wajib** lolos `can_access` dulu pada menu yang sama:

```
authorize(menu, 'delete'):
  butuh effective(menu, 'can_access') == true   ← kalau tidak, langsung DITOLAK
  lalu butuh effective(menu, 'delete') == true
```

Jadi jika admin men-`deny` `can_access` untuk seorang user, **semua** permission menu itu ikut mati untuk user tersebut, dan menu itu hilang dari `GET /me/menus`.

**Penting**: penegakan ini **hanya di middleware route** (`fastify.authorize` / `fastify.requireMenuAccess`). Pemanggilan service/repo antar-modul secara internal **tidak** terpengaruh — jadi modul A tetap bisa memakai service/repo modul B walau permission HTTP-nya di-disable.

## Langkah-Langkah (Admin)

### Set grant di level role

```bash
PUT /api/v1/roles/{roleId}/permissions
{ "grants": [ { "menuCode": "user_management", "permissions": ["can_access","read"] } ] }
```

### Set override di level user

```bash
# Cabut 'read' khusus user ini (menang atas role)
PUT /api/v1/users/{userId}/permissions
{ "overrides": [ { "menuCode": "user_management", "permissionCode": "read", "effect": "deny" } ] }

# Kosongkan override → kembali mengikuti role
PUT /api/v1/users/{userId}/permissions
{ "overrides": [] }
```

### Deklarasi permission + deskripsi di manifest

```ts
// src/modules/users/users.manifest.ts
permissions: [
  { code: 'can_access', description: 'Access the User Management menu' },
  { code: 'read', description: 'View users', route: { method: 'GET', path: '/api/v1/users' } },
  // ...
]
```

## Contoh Penegakan (Guard)

`src/core/plugins/auth-guard.plugin.ts`:

```ts
fastify.decorate('authorize', (menuCode, permissionCode) => async (request) => {
  const reader = createRbacReader(fastify.db)
  const allowed = await reader.hasPermission(request.user.sub, request.user.roles, menuCode, permissionCode)
  if (!allowed) throw new ForbiddenError(...)
})
```

Logika efektif + cascade ada di `src/core/rbac/rbac.reader.ts` (`isEffective`, `hasPermission`).

## Verifikasi

1. Beri role user grant `user_management:read` → `GET /users` **200**.
2. `PUT /users/:id/permissions` effect `deny` untuk `read` → **403** (override menang).
3. `deny` untuk `can_access` → semua `user_management:*` **403**, dan `/me/menus` tidak memuat `user_management`.
4. Kosongkan override → **200** lagi.

## Referensi Kode Aktual

- `src/modules/auth/db/auth.prisma` — tabel `user_menu_permissions`.
- `src/core/rbac/rbac.reader.ts` — resolusi efektif + cascade.
- `src/modules/users/{controllers,services}` — endpoint override.
- `src/modules/role/**` — grant level role.

## Catatan

- Token JWT tidak memuat permission; override diselesaikan server-side per-request berdasarkan `sub` (userId) + `roles`. Perubahan override berlaku tanpa perlu login ulang.

## Lihat Juga

- `tutorial/17-rbac-dinamis-user-role-menu-permission.md`
- `tutorial/19-manifest-menu-permission-module.md`
