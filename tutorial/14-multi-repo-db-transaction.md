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
| `withTransaction` | `src/core/database/transaction.js` | Membungkus callback dalam Prisma interactive transaction |
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

File `src/core/database/transaction.js` sudah tersedia. Tidak perlu dibuat ulang.

### Langkah 2: Tambahkan `withClient(tx)` ke Prisma repository baru

Setiap repository Prisma yang akan digunakan dalam transaksi **harus** punya method ini:

```js
// src/modules/posts/repositories/post.prisma.repository.js

export class PostPrismaRepository {
  constructor(prisma) {
    this.prisma = prisma
  }

  async create(data) {
    return this.prisma.post.create({ data })
  }

  async delete(id) {
    await this.prisma.post.delete({ where: { id } })
  }

  // Wajib ada jika repository ini digunakan dalam withTransaction
  withClient(tx) {
    return new PostPrismaRepository(tx)
  }
}
```

Untuk Mongo repository, tambahkan no-op agar API konsisten:

```js
// src/modules/posts/repositories/post.mongo.repository.js

export class PostMongoRepository {
  // ... methods ...

  // No-op — MongoDB transactions butuh replica set (tidak didukung boilerplate ini)
  withClient() {
    return this
  }
}
```

### Langkah 3: Inject semua repository + `db` ke service lewat `module.js`

```js
// src/modules/posts/module.js

import { createPostRepository } from './repositories/post.repository.js'
import { PostService } from './services/post.service.js'
import { createUserRepository } from '../users/index.js'  // repo dari modul lain

export default async function postsModule(fastify) {
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

```js
// src/modules/posts/services/post.service.js

import { withTransaction } from '../../../core/database/transaction.js'
import { NotFoundError } from '../../../core/utils/errors.js'

export class PostService {
  constructor({ postRepository, userRepository, db }) {
    this.postRepository = postRepository
    this.userRepository = userRepository
    this.db = db
  }

  async deletePostAndCleanup(requesterId, postId) {
    const post = await this.postRepository.findById(postId)
    if (!post) throw new NotFoundError('Post not found')

    // Hapus post dan update counter user secara atomik
    await withTransaction(this.db, async (tx) => {
      await this.postRepository.withClient(tx).delete(postId)
      await this.userRepository.withClient(tx).decrementPostCount(post.authorId)
    })
  }
}
```

---

## Catatan Penting

### Constructor dengan Object Destructuring

Karena service kini menerima banyak dependency, gunakan object destructuring agar urutan tidak penting dan mudah dibaca:

```js
// ✅ Lebih scalable
constructor({ postRepository, userRepository, db }) { ... }

// ❌ Positional args — mudah salah urutan saat dependency bertambah
constructor(postRepository, userRepository, db) { ... }
```

### `db` Harus Diteruskan

`withTransaction` membutuhkan `fastify.db` (PrismaClient). Inject `db: fastify.db` ke service lewat `module.js`. Service **tidak boleh** mengimport `getPrismaClient()` langsung — itu melanggar aturan dependency direction.

### Batasan MongoDB

`withTransaction` akan **throw error** jika dipanggil dengan MongoDB driver (`db === null`). Untuk MongoDB, lakukan operasi secara sekuensial (tanpa jaminan atomisitas) atau gunakan replica set di infrastruktur.

### `withClient(tx)` Mengembalikan Instance Baru

```js
// ✅ Benar — instance asli tidak berubah, tx client hanya berlaku di dalam callback
await withTransaction(this.db, async (tx) => {
  await this.postRepository.withClient(tx).delete(postId)
  // this.postRepository masih menggunakan koneksi normal di luar callback
})
```

---

## Contoh Nyata di Codebase Ini

Lihat implementasi di:
- `src/modules/users/services/user.service.js` — method `deleteUser()`
- `src/modules/users/module.js` — wiring multi-repository ke `UserService`
- `src/modules/users/repositories/user.prisma.repository.js` — method `withClient(tx)`
- `src/modules/auth/repositories/auth.prisma.repository.js` — method `withClient(tx)`
