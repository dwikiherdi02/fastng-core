# Menambah Role-Based Authorization (RBAC)

FastNG mendukung dua role: `user` (default) dan `admin`. Tutorial ini menjelaskan cara membatasi akses endpoint berdasarkan role.

---

## Cara Kerja Role

Role disimpan di kolom `role` pada tabel `users`. Saat login, role di-encode ke dalam JWT:

```js
// Di auth.service.js saat generate token
const payload = {
  id: user.id,
  email: user.email,
  role: user.role    // 'user' atau 'admin'
}
```

Setelah `fastify.authenticate` berhasil, `request.user.role` tersedia di controller.

---

## Cara 1 — Role Check di Controller (paling sederhana)

Pola yang sudah dipakai di `UserController.findAll`:

```ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { ForbiddenError } from '../../../core/utils/errors.js'
import { successResponse } from '../../../core/utils/response.js'

export class PostController {
  async deleteAnyPost(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    // Hanya admin yang boleh hapus post milik siapapun
    if (request.user.role !== 'admin') {
      throw new ForbiddenError('Only admins can delete any post')
    }

    const result = await this.service.deletePost(request.params.id)
    return reply.send(successResponse(result))
  }
}
```

---

## Cara 2 — preHandler Middleware (reusable)

Buat plugin `requireAdmin` yang bisa dipakai di banyak route:

```ts
// src/core/plugins/auth-guard.plugin.ts
import fp from 'fastify-plugin'
import { ForbiddenError } from '../utils/errors.js'

async function authGuardPlugin(fastify: any): Promise<void> {
  fastify.decorate('requireAdmin', async function (request: any) {
    if (request.user.role !== 'admin') {
      throw new ForbiddenError('Admin access required')
    }
  })
}

export default fp(authGuardPlugin)
```

Daftarkan di `src/app.ts` setelah jwt.plugin:

```ts
import authGuardPlugin from './core/plugins/auth-guard.plugin.js'

// ... setelah register jwt.plugin
await app.register(authGuardPlugin)
```

Gunakan di route:

```ts
const adminOnly = {
  preHandler: [fastify.authenticate, fastify.requireAdmin]
}

fastify.get('/admin/users', adminOnly, controller.findAll.bind(controller))
fastify.delete('/admin/posts/:id', adminOnly, controller.adminDelete.bind(controller))
```

---

## Cara Membuat User Admin

### Opsi A — Prisma Studio (GUI)

```bash
npm run db:studio
```

Buka browser, temukan user, ubah kolom `role` dari `'user'` menjadi `'admin'`, klik Save.

### Opsi B — Script seed

Buat file `prisma/seed.ts`:

```ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  const hash = await bcrypt.hash('Admin123!', 10)
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@example.com',
      password: hash,
      role: 'admin'
    }
  })
  console.log('Admin user created: admin@example.com / Admin123!')
}

main().finally(() => prisma.$disconnect())
```

Jalankan:

```bash
node --env-file=.env --import tsx/esm prisma/seed.ts
```

---

## Role Check dengan Logic Berbeda per Role

Contoh — user hanya bisa lihat post milik sendiri, admin bisa lihat semua:

```ts
// src/modules/posts/services/post.service.ts
import type { UserPayload } from '../../../types/fastify.js'

export class PostService {
  async findAll(requestingUser: UserPayload) {
    if (requestingUser.role === 'admin') {
      // Admin: lihat semua post
      return this.repository.findAll()
    }
    // User biasa: hanya post milik sendiri
    return this.repository.findByAuthor(requestingUser.id)
  }
}
```

```ts
// src/modules/posts/controllers/post.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { successResponse } from '../../../core/utils/response.js'

export class PostController {
  async findAll(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Kirim data user ke service untuk diputuskan logic-nya
    const result = await this.service.findAll(request.user)
    return reply.send(successResponse(result))
  }
}
```

Di route, endpoint ini harus protected (user harus login):

```ts
const auth = { preHandler: [fastify.authenticate] }
fastify.get('/posts', auth, controller.findAll.bind(controller))
```

---

## Menambah Role Baru (Selain admin/user)

Jika perlu role tambahan, misal `moderator`:

1. Update Prisma schema — ubah field `role` menjadi enum:

```prisma
enum Role {
  user
  admin
  moderator
}
```

2. Jalankan migrasi: `bun run migrate`

3. Tambah guard di plugin:

```ts
fastify.decorate('requireModerator', async function (request: any): Promise<void> {
  if (!['admin', 'moderator'].includes(request.user.role)) {
    throw new ForbiddenError('Moderator access required')
  }
})
```
