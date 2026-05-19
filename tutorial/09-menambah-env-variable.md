# Menambah Environment Variable Baru

Semua environment variable di FastNG divalidasi saat startup menggunakan Zod di `src/core/config/env.config.js`. Jika ada variable wajib yang tidak ada atau tidak valid, server langsung berhenti dengan pesan error yang jelas (fail-fast).

---

## Cara Kerja

1. Variable dibaca dari `.env` via `node --env-file=.env`
2. Zod memvalidasi semua variable di `envSchema`
3. Hasil validasi tersedia di `fastify.config` (didaftarkan oleh `db.plugin.js`)
4. Semua plugin dan modul bisa akses via `fastify.config.NAMA_VARIABLE`

---

## Cara Menambah Variable Baru

### Langkah 1 — Tambahkan ke `.env`

```
# .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=supersecretpassword
EMAIL_ENABLED=true
```

### Langkah 2 — Tambahkan ke Schema Zod di `env.config.js`

Edit `src/core/config/env.config.js` dan tambahkan field baru ke `envSchema`:

```js
const envSchema = z.object({
  // ... variable yang sudah ada ...

  // Konfigurasi email (tambahkan di sini)
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string().min(1),
  EMAIL_ENABLED: z.string().transform(v => v === 'true').default('false')
})
```

### Langkah 3 — Gunakan di Plugin Baru

Buat `src/core/plugins/email.plugin.js`:

```js
import fp from 'fastify-plugin'
import nodemailer from 'nodemailer'

async function emailPlugin(fastify) {
  // Skip jika email tidak diaktifkan
  if (!fastify.config.EMAIL_ENABLED) return

  const transporter = nodemailer.createTransport({
    host: fastify.config.SMTP_HOST,
    port: fastify.config.SMTP_PORT,
    auth: {
      user: fastify.config.SMTP_USER,
      pass: fastify.config.SMTP_PASS
    }
  })

  fastify.decorate('mailer', transporter)
  fastify.log.info('[Email] Mailer initialized')
}

export default fp(emailPlugin)
```

Daftarkan di `src/app.js`:

```js
import emailPlugin from './core/plugins/email.plugin.js'
await app.register(emailPlugin)
```

Gunakan di service lewat injection di `module.js`:

```js
// src/modules/auth/module.js
export default async function authModule(fastify) {
  const repository = createAuthRepository(fastify)
  const service = new AuthService(repository, fastify, fastify.mailer)  // inject mailer
  // ...
}
```

---

## Referensi Tipe Zod untuk Env Var

| Kebutuhan | Contoh Zod |
|---|---|
| String wajib | `z.string().min(1)` |
| String opsional | `z.string().optional()` |
| Number (dari string env) | `z.coerce.number()` |
| Integer positif | `z.coerce.number().int().positive()` |
| Boolean dari "true"/"false" | `z.string().transform(v => v === 'true')` |
| Default value | `.default('nilai-default')` |
| Pilihan terbatas | `z.enum(['sqlite', 'mysql', 'postgresql', 'mongodb'])` |
| URL | `z.string().url()` |
| Email | `z.string().email()` |
| Min panjang | `z.string().min(32, 'Minimal 32 karakter')` |

---

## Validasi Kondisional (Variable Bergantung pada Variable Lain)

Contoh: `MONGODB_URI` wajib hanya jika `DB_DRIVER=mongodb`:

```js
const envSchema = z.object({
  DB_DRIVER: z.enum(['sqlite', 'mysql', 'postgresql', 'mongodb']),
  DATABASE_URL: z.string().optional(),
  MONGODB_URI: z.string().optional()
}).refine(
  data => data.DB_DRIVER !== 'mongodb' || !!data.MONGODB_URI,
  { message: 'MONGODB_URI is required when DB_DRIVER is mongodb' }
).refine(
  data => data.DB_DRIVER === 'mongodb' || !!data.DATABASE_URL,
  { message: 'DATABASE_URL is required for non-MongoDB drivers' }
)
```

---

## Mengapa Fail-Fast?

Daripada error saat runtime (misal: saat mengirim email pertama kali), validasi di startup memastikan:

- **Semua variable tersedia** sebelum server menerima request apapun
- **Pesan error yang jelas**: `"SMTP_HOST: Required"` daripada `"Cannot read property 'host' of undefined"` di tengah proses
- **Tidak ada silent failure** — server tidak jalan sama sekali jika konfigurasi salah

Jika validasi gagal, kamu akan melihat output seperti:

```
[Env] Configuration validation failed:
  - SMTP_HOST: Required
  - SMTP_USER: Invalid email

Process exited with code 1
```
