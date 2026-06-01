# Cara Kerja JWT dan Refresh Token

FastNG menggunakan sistem dua token: **access token** (berumur pendek) dan **refresh token** (berumur panjang). Ini adalah pola industri standar untuk keamanan API.

---

## Alur Autentikasi Lengkap

```
1. POST /api/v1/auth/register  atau  POST /api/v1/auth/login
   ├─ Validasi email + password
   ├─ Generate accessToken (15 menit) — TIDAK disimpan di DB
   ├─ Generate refreshToken (7 hari) — disimpan di DB
   └─ Response: { accessToken, refreshToken, user }

2. Client kirim request dengan accessToken:
   GET /api/v1/users/me
   Authorization: Bearer <accessToken>
   └─ fastify.authenticate verifikasi JWT → request.user terisi

3. accessToken expired (setelah 15 menit):
   POST /api/v1/auth/refresh
   Body: { refreshToken: "..." }
   ├─ Verifikasi JWT secara kriptografi
   ├─ Cek refreshToken ada di database
   ├─ HAPUS refreshToken lama dari database (rotation)
   ├─ Generate pasangan token BARU
   └─ Response: { accessToken, refreshToken }

4. Logout:
   DELETE /api/v1/auth/logout
   Body: { refreshToken: "..." }
   ├─ Hapus refreshToken dari database
   └─ accessToken akan expired sendiri (max 15 menit)
```

---

## Access Token vs Refresh Token

| | Access Token | Refresh Token |
|---|---|---|
| Umur default | 15 menit | 7 hari |
| Disimpan di DB | Tidak | Ya |
| Digunakan untuk | Autentikasi setiap request | Mendapatkan access token baru |
| Di-revoke saat logout | Tidak (expired sendiri) | Ya, langsung dihapus |
| Isi payload | id, email, role | id saja |

---

## Kode Inti di `auth.service.js`

### Generate Token (Private Method)

```ts
async #issueTokens(user: UserEntity): Promise<{ accessToken: string; refreshToken: string }> {
  // Access token — payload lengkap, tidak disimpan di DB
  const accessToken = this.fastify.jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    { expiresIn: this.fastify.config.JWT_EXPIRES_IN }  // '15m'
  )

  // Refresh token — hanya id, disimpan di DB
  const refreshToken = this.fastify.jwt.sign(
    { id: user.id },
    { expiresIn: this.fastify.config.JWT_REFRESH_EXPIRES_IN }  // '7d'
  )

  // Hitung kapan refresh token expired untuk disimpan di DB
  const expiresAt = new Date(
    Date.now() + msFromExpiry(this.fastify.config.JWT_REFRESH_EXPIRES_IN)
  )

  await this.repository.saveRefreshToken(user.id, refreshToken, expiresAt)
  return { accessToken, refreshToken }
}
```

### Token Rotation saat Refresh

```ts
async refreshTokens(oldRefreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  // 1. Verifikasi tanda tangan JWT (kriptografi)
  const payload = this.fastify.jwt.verify(oldRefreshToken)

  // 2. Cek token masih ada di database (belum dipakai/logout)
  const stored = await this.repository.findRefreshToken(oldRefreshToken)
  if (!stored) throw new UnauthorizedError('Invalid refresh token')

  // 3. Hapus token lama — ini yang disebut "rotation"
  await this.repository.deleteRefreshToken(oldRefreshToken)

  // 4. Ambil data user terbaru dan generate token baru
  const user = await this.repository.findById(payload.id)
  if (!user) throw new UnauthorizedError('User not found')

  return this.#issueTokens(user)
}
```

---

## Mengapa Token Rotation Penting?

Jika refresh token dicuri oleh attacker:

- **Tanpa rotation**: Attacker bisa pakai token yang dicuri selamanya (7 hari)
- **Dengan rotation**: Token lama langsung invalid setelah dipakai sekali. Jika attacker mencoba pakai token yang sudah dipakai user, database check akan gagal

---

## Format Konfigurasi di `.env`

```
JWT_SECRET=minimum-32-random-characters-here-abc123
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

Format durasi yang didukung: `30s`, `5m`, `15m`, `1h`, `2h`, `1d`, `7d`, `30d`

---

## Payload JWT

```js
// Access token payload (decode dengan jwt.verify):
{
  id: "uuid-string",
  email: "user@example.com",
  role: "user",          // atau "admin"
  iat: 1747000000,       // issued at (Unix timestamp)
  exp: 1747000900        // expires at (15 menit kemudian)
}

// Refresh token payload:
{
  id: "uuid-string",
  iat: 1747000000,
  exp: 1747604800        // expires at (7 hari kemudian)
}
```

Akses di controller setelah authenticate: `request.user.id`, `request.user.email`, `request.user.role`

---

## Auto-Delete Expired Token di MongoDB

Model `RefreshToken` Mongoose menggunakan TTL index:

```ts
// src/core/database/models/refresh-token.model.ts
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
```

MongoDB otomatis menghapus dokumen saat `expiresAt` terlewati — tidak perlu cron job cleanup.

Untuk **Prisma** (SQLite/MySQL/PostgreSQL), token expired tetap tersimpan sampai user logout. Untuk production, pertimbangkan cron job periodic cleanup:

```ts
// Contoh: hapus refresh token yang sudah expired
await prisma.refreshToken.deleteMany({
  where: { expiresAt: { lt: new Date() } }
})
```

---

## Rekomendasi Keamanan

1. **`JWT_SECRET`** harus minimal 32 karakter random — generate dengan: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Simpan refresh token di **`httpOnly` cookie** di frontend, bukan `localStorage` (rentan XSS)
3. `JWT_EXPIRES_IN=15m` sudah pendek — jangan perpanjang terlalu jauh
4. Saat logout, **selalu call** `DELETE /api/v1/auth/logout` agar refresh token terhapus dari DB
5. Jangan menyimpan data sensitif (password, kartu kredit, dll) di dalam JWT payload
