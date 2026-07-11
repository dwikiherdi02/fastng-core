# 20 — Session Control & Force Logout

**Tujuan**: Menjelaskan sistem sesi berbasis tabel `sessions` dengan refresh token opaque (SHA-256), rotasi, deteksi reuse, dan force-logout.

**Kapan digunakan**: Memahami alur login/refresh/logout baru, atau menambah fitur "logout dari perangkat lain".

**Prasyarat**: Modul `auth` aktif; `yarn db:sync` + `yarn db:seed` sudah dijalankan.

## Pengenalan

Refresh token lama berupa JWT yang disimpan mentah. Sekarang refresh token adalah **string acak opaque** (256-bit) yang hanya disimpan dalam bentuk **hash SHA-256** di tabel `sessions`. Tabel `sessions` menjadi *source of truth* validitas refresh token, sehingga admin/user bisa memaksa logout kapan pun walau masa berlaku token belum habis.

| | Access Token | Refresh Token |
|---|---|---|
| Bentuk | JWT `{ sub, sid, jti, username, roles }` | String acak base64url (bukan JWT) |
| Umur | pendek (`JWT_ACCESS_EXPIRES`, mis. 15m) | panjang (`JWT_REFRESH_EXPIRES`, mis. 7d) |
| Disimpan di DB | tidak | ya, sebagai hash SHA-256 di `sessions` |
| Dicabut saat logout | kedaluwarsa sendiri | baris session dihapus/di-revoke |

## Alur/Mekanisme

```
login/register → buat session (hash refresh, jti, expiresAt) → access token(sid=session.id)
refresh        → cari session by hash → cek isRevoked & expiresAt → ROTASI (token+jti baru di baris yang sama)
reuse token lama → hash tak ditemukan → 401
force-logout   → set isRevoked=true (admin/self) → refresh berikutnya 401
```

Access token bersifat stateless dan tetap valid sampai kedaluwarsa (maka umurnya harus pendek). Pencabutan berlaku pada percobaan refresh berikutnya.

## Langkah-Langkah

### Langkah 1: Login → dapatkan pasangan token

```bash
POST /api/v1/auth/login  { "email": "...", "password": "..." }
→ { accessToken, refreshToken, user }
```

### Langkah 2: Refresh (rotasi)

```bash
POST /api/v1/auth/refresh  { "refreshToken": "<opaque>" }
→ access & refresh baru; refresh LAMA otomatis tidak berlaku (deteksi reuse)
```

### Langkah 3: Kelola sesi / force-logout

```bash
GET    /api/v1/auth/me/sessions      # daftar perangkat/sesi aktif
DELETE /api/v1/auth/sessions/:id     # cabut satu sesi (force logout perangkat itu)
POST   /api/v1/auth/logout  { refreshToken }  # akhiri sesi saat ini
```

## Contoh Lengkap

Penerbitan token di `src/modules/auth/services/auth.service.ts`:

```ts
private async startSession(entity: AuthEntity, ctx: RequestContext): Promise<Tokens> {
  const jti = generateJti()
  const refreshToken = generateRefreshToken()               // opaque 256-bit
  const expiresAt = new Date(Date.now() + msFromExpiry(env.JWT_REFRESH_EXPIRES))
  const session = await this.repository.createSession({
    userId: entity.id, refreshTokenHash: hashToken(refreshToken), // SHA-256
    accessTokenJti: jti, expiresAt, deviceInfo: ctx.deviceInfo, ipAddress: ctx.ipAddress,
  })
  const accessToken = this.signAccessToken(entity, session.id, jti)
  return { accessToken, refreshToken }
}
```

Helper token di `src/core/utils/token.ts` (`generateRefreshToken`, `hashToken`, `generateJti`).

## Aturan/Pedoman

| ✅ Lakukan | ❌ Hindari |
|---|---|
| Simpan hanya hash refresh token | Menyimpan refresh token mentah |
| Rotasi setiap refresh | Memakai ulang refresh token yang sama |
| Umur access token pendek (5–15m) | Access token berumur panjang |
| Kirim refresh via cookie httpOnly di klien | Menyimpan refresh di localStorage |

## Verifikasi

1. Login → refresh → refresh **lama** dipakai lagi → **401** (deteksi reuse).
2. `GET /me/sessions` menampilkan sesi; `DELETE /sessions/:id` → refresh sesi itu → **401**.
3. `POST /logout` → refresh yang sama → **401**.

## Referensi Kode Aktual

- `src/modules/auth/services/auth.service.ts` — `startSession`, `refreshToken`, `revokeSession`.
- `src/modules/auth/repositories/auth.repository.ts` — kontrak sesi.
- `src/core/database/models/session.model.ts` — model Mongo (TTL index).
- `src/modules/auth/db/auth.prisma` — tabel `sessions`.

## Catatan

- MongoDB memakai TTL index (`expireAfterSeconds: 0`) untuk membersihkan sesi kedaluwarsa; Prisma bisa memakai scheduled job (lihat `tutorial/16-menambah-scheduled-job.md`).
- Untuk pencabutan instan pada access token, tambahkan blacklist `jti` di Redis (opsional).

## Lihat Juga

- `tutorial/03-cara-kerja-jwt-refresh-token.md`
- `tutorial/17-rbac-dinamis-user-role-menu-permission.md`
