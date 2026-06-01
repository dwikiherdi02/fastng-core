# Multi-Repository & DB Transaction

Panduan menggunakan lebih dari satu repository di dalam satu service method, dengan jaminan atomisitas menggunakan DB transaction.

---

## Kapan Digunakan?

Gunakan pola ini ketika **satu operasi bisnis menyentuh lebih dari satu tabel/koleksi** dan seluruh operasi tersebut harus berhasil atau gagal bersama-sama (atomik).

**Contoh di codebase ini:**
- `deleteUser()` — harus menghapus row `User` **dan** semua `RefreshToken` miliknya secara atomik. Jika salah satu gagal, keduanya di-rollback.

---

## Komponen yang Terlibat

| Komponen | File | Peran |
|---|---|---|
| `withTransaction` | `src/core/database/transaction.ts` | Membungkus callback dalam Prisma interactive transaction |
| `withClient(tx)` | Setiap Prisma repository | Mengembalikan instance repository baru yang bound ke `tx` client |
| `withClient()` | Setiap Mongo repository | No-op untuk API consistency |

---

## Cara Kerja

```
Service.deleteUser()
  │
  ├─ withTransaction(this.db, async (tx) => {
  │     │
  │     ├─ userRepository.withClient(tx).delete(userId)
  │     │      └─ prisma tx → DELETE FROM user WHERE id = ?
  │     │
  │     └─ authRepository.withClient(tx).deleteAllRefreshTokensForUser(userId)
  │            └─ prisma tx → DELETE FROM refresh_token WHERE userId = ?
  │  })
  │
  └─ Jika keduanya sukses → COMMIT
     Jika salah satu throw → ROLLBACK keduanya
```

`withClient(tx)` **tidak mengubah** instance yang ada — ia mengembalikan instance repository **baru** yang menggunakan `tx` sebagai Prisma client, sementara instance aslinya tetap menggunakan koneksi normal.

---

## Implementasi Langkah demi Langkah

### Langkah 1: Pastikan `withTransaction` sudah ada

File `src/core/database/transaction.ts` sudah tersedia. Tidak perlu dibuat ulang.

### Langkah 2: Tambahkan `withClient(tx)` ke Prisma repository baru

Setiap repository Prisma yang akan digunakan dalam transaksi **harus** punya method ini:

```ts
// src/modules/posts/repositories/post.prisma.repository.ts
import type { PrismaClient } from '@prisma/client'

export class PostPrismaRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: { title: string; content: string; authorId: string }) {
    return this.prisma.post.create({ data })
  }

  async delete(id: string): Promise<void> {
    await this.prisma.post.delete({ where: { id } })
  }

  // Wajib ada jika repository ini digunakan dalam withTransaction
  withClient(tx: PrismaClient): PostPrismaRepository {
    return new PostPrismaRepository(tx)
  }
}
```

Untuk Mongo repository, tambahkan no-op agar API konsisten:

```ts
// src/modules/posts/repositories/post.mongo.repository.ts

export class PostMongoRepository {
  // ... methods ...

  // No-op — MongoDB transactions butuh replica set (tidak didukung boilerplate ini)
  withClient(): PostMongoRepository {
    return this
  }
}
```

### Langkah 3: Inject semua repository + `db` ke service lewat `module.js`

```ts
// src/modules/posts/module.ts
import type { FastifyInstance } from 'fastify'
import { createPostRepository } from './repositories/post.repository.js'
import { PostService } from './services/post.service.js'
import { createUserRepository } from '../users/index.js'  // repo dari modul lain

export default async function postsModule(fastify: FastifyInstance): Promise<void> {
  const postRepository = createPostRepository(fastify.db)
  const userRepository = createUserRepository(fastify.db)

  const service = new PostService({
    postRepository,
    userRepository,
    db: fastify.db,   // ← wajib diteruskan agar service bisa memanggil withTransaction
  })

  // ...
}
```

### Langkah 4: Gunakan `withTransaction` di service

```ts
// src/modules/posts/services/post.service.ts
import type { PrismaClient } from '@prisma/client'
import { withTransaction } from '../../../core/database/transaction.js'
import { NotFoundError } from '../../../core/utils/errors.js'

export class PostService {
  constructor(private deps: {
    postRepository: any
    userRepository: any
    db: PrismaClient | null
  }) {}

  async deletePostAndCleanup(requesterId: string, postId: string): Promise<void> {
    const post = await this.deps.postRepository.findById(postId)
    if (!post) throw new NotFoundError('Post not found')

    // Hapus post dan update counter user secara atomik
    await withTransaction(this.deps.db, async (tx: PrismaClient) => {
      await this.deps.postRepository.withClient(tx).delete(postId)
      await this.deps.userRepository.withClient(tx).decrementPostCount(post.authorId)
    })
  }
}
```

---

## Catatan Penting

### Constructor dengan Object Destructuring

Karena service kini menerima banyak dependency, gunakan object destructuring agar urutan tidak penting dan mudah dibaca:

```ts
// ✅ Lebih scalable
constructor(private deps: { postRepository: any; userRepository: any; db: PrismaClient | null }) {}

// ❌ Positional args — mudah salah urutan saat dependency bertambah
constructor(postRepository: any, userRepository: any, db: PrismaClient | null) { ... }
```

### `db` Harus Diteruskan

`withTransaction` membutuhkan `fastify.db` (PrismaClient). Inject `db: fastify.db` ke service lewat `module.js`. Service **tidak boleh** mengimport `getPrismaClient()` langsung — itu melanggar aturan dependency direction.

### Batasan MongoDB

`withTransaction` akan **throw error** jika dipanggil dengan MongoDB driver (`db === null`). Untuk MongoDB, lakukan operasi secara sekuensial (tanpa jaminan atomisitas) atau gunakan replica set di infrastruktur.

### `withClient(tx)` Mengembalikan Instance Baru

```ts
// ✅ Benar — instance asli tidak berubah, tx client hanya berlaku di dalam callback
await withTransaction(this.deps.db, async (tx: PrismaClient) => {
  await this.deps.postRepository.withClient(tx).delete(postId)
  // this.deps.postRepository masih menggunakan koneksi normal di luar callback
})
```

---

## Contoh Nyata di Codebase Ini

Lihat implementasi di:
- `src/modules/users/services/user.service.ts` — method `deleteUser()`
- `src/modules/users/module.ts` — wiring multi-repository ke `UserService`
- `src/modules/users/repositories/user.prisma.repository.ts` — method `withClient(tx)`
- `src/modules/auth/repositories/auth.prisma.repository.ts` — method `withClient(tx)`
