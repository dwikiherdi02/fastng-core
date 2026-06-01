# Service-in-Service: Reuse Business Logic antar Modul

Panduan menyematkan service dari modul lain ke dalam service, untuk menggunakan kembali business logic yang kompleks tanpa duplikasi.

---

## Kapan Digunakan?

Gunakan pola ini ketika **suatu service perlu mengeksekusi business logic** yang sudah didefinisikan di service lain — bukan sekadar membaca/menulis ke database, melainkan menjalankan aturan bisnis lengkap yang ada di service tersebut.

**Contoh di codebase ini:**
- `updateProfile()` di `UserService` — ketika email user berubah, semua sesi aktif harus dicabut (revoke). Logic revoke adalah tanggung jawab `AuthService`, bukan `UserService`.

**Bedakan dengan multi-repo:**
| | Multi-Repo + Transaction | Service-in-Service |
|---|---|---|
| **Kebutuhan** | Operasi multi-tabel yang harus atomik | Reuse business logic kompleks dari service lain |
| **Yang di-share** | DB client (tx) | Instance service yang sudah jadi |
| **Contoh** | Hapus user + hapus semua token-nya | Update email → revoke sesi via AuthService |

---

## Aturan Penting

1. **Hanya boleh dari modul yang sudah `dependsOn`** — `UserService` boleh pakai `AuthService` karena `users` sudah `dependsOn: ['auth']` di registry. Arah sebaliknya (`AuthService` pakai `UserService`) adalah circular dependency dan **dilarang**.

2. **Inject via constructor, bukan import di service** — service tidak boleh menginstansiasi service lain. Semua wiring dilakukan di `module.js`.

3. **Import hanya dari `index.js` modul asal** — sesuai aturan arsitektur, `users/module.js` import `AuthService` dari `'../auth/index.js'`, bukan langsung dari file internal auth.

---

## Cara Kerja

```
users/module.js
  │
  ├─ createAuthRepository(fastify.db)  → authRepository
  ├─ new AuthService(authRepository, fastify)  → authService
  │
  └─ new UserService({ userRepository, authRepository, authService, db })
                                              ↑
                                    authService diterima
                                    sebagai dependency

UserService.updateProfile()
  │
  ├─ userRepository.update(userId, data)
  │
  └─ jika data.email berubah:
       authService.revokeAllTokens(userId)
         └─ authRepository.deleteAllRefreshTokensForUser(userId)
```

---

## Implementasi Langkah demi Langkah

### Langkah 1: Pastikan service yang akan di-share sudah mengeksport method yang dibutuhkan

```ts
// src/modules/auth/services/auth.service.ts

export class AuthService {
  // ...method yang sudah ada...

  async revokeAllTokens(userId: string): Promise<void> {
    await this.repository.deleteAllRefreshTokensForUser(userId)
  }
}
```

### Langkah 2: Export service dari `index.js` modul asal

```ts
// src/modules/auth/index.ts

export { AuthService } from './services/auth.service.js'
export { createAuthRepository } from './repositories/auth.repository.js'
// Ekspor createAuthRepository juga karena konsumer perlu menginstansiasi AuthService
// dengan repository yang sesuai
```

### Langkah 3: Terima service sebagai dependency di constructor

```ts
// src/modules/users/services/user.service.ts
import type { PrismaClient } from '@prisma/client'
import { NotFoundError } from '../../../core/utils/errors.js'

export class UserService {
  constructor(private deps: {
    userRepository: any
    authRepository: any
    authService: any
    db: PrismaClient | null
  }) {}

  async updateProfile(userId: string, data: { email?: string; [key: string]: unknown }): Promise<any> {
    const entity = await this.deps.userRepository.findById(userId)
    if (!entity) throw new NotFoundError('User not found')

    const updated = await this.deps.userRepository.update(userId, data)

    // Service-in-service: revoke semua sesi aktif jika email berubah
    if (data.email && data.email !== entity.email) {
      await this.deps.authService.revokeAllTokens(userId)
    }

    return updated
  }
}
```

### Langkah 4: Wire semua dependency di `module.js`

```ts
// src/modules/users/module.ts
import type { FastifyInstance } from 'fastify'
import { createUserRepository } from './repositories/user.repository.js'
import { UserService } from './services/user.service.js'
import { UserController } from './controllers/user.controller.js'
import userRoutes from './routes/user.routes.js'
import { createAuthRepository, AuthService } from '../auth/index.js'  // ← dari public API

export default async function usersModule(fastify: FastifyInstance): Promise<void> {
  const userRepository = createUserRepository(fastify.db)

  // Instantiasi AuthService beserta repository-nya untuk di-inject ke UserService
  const authRepository = createAuthRepository(fastify.db)
  const authService = new AuthService(authRepository, fastify)

  const service = new UserService({ userRepository, authRepository, authService, db: fastify.db })
  const controller = new UserController(service)

  // ...register routes...
}
```

---

## Contoh: Menambah Service Baru yang Butuh AuthService

Misalnya membuat `OrderService` yang perlu memverifikasi status user via `UserService`:

**1. Pastikan `orders` ada di `dependsOn` yang benar di registry:**
```ts
// src/registry/module.registry.ts
{
  name: 'orders',
  enabled: true,
  path: '../modules/orders/module.js',  // NodeNext ESM: path value stays .js
  dependsOn: ['auth', 'users'],  // boleh pakai AuthService dan UserService
}
```

**2. Export `UserService` dari `users/index.js`** (sudah ada):
```ts
// src/modules/users/index.ts
export { UserService } from './services/user.service.js'
export { createUserRepository } from './repositories/user.repository.js'
```

**3. Inject di `orders/module.js`:**
```ts
import { createUserRepository, UserService } from '../users/index.js'
import { createAuthRepository, AuthService } from '../auth/index.js'
import type { FastifyInstance } from 'fastify'

export default async function ordersModule(fastify: FastifyInstance): Promise<void> {
  // Wire deps dari modul lain
  const userRepository = createUserRepository(fastify.db)
  const authRepository = createAuthRepository(fastify.db)
  const authService = new AuthService(authRepository, fastify)
  const userService = new UserService({ userRepository, authRepository, authService, db: fastify.db })

  // Wire deps lokal
  const orderRepository = createOrderRepository(fastify.db)
  const orderService = new OrderService({ orderRepository, userService, db: fastify.db })

  // ...
}
```

**4. Terima di constructor `OrderService`:**
```ts
export class OrderService {
  constructor(private deps: {
    orderRepository: any
    userService: UserService
    db: any
  }) {}

  async createOrder(userId: string, items: any[]): Promise<any> {
    // Reuse UserService business logic — bukan query DB langsung
    const user = await this.deps.userService.getProfile(userId)
    if (user.role === 'suspended') throw new ForbiddenError('Account suspended')

    return this.deps.orderRepository.create({ userId, items })
  }
}
```

---

## Catatan Penting

### Instance Terpisah adalah Normal

`authService` yang dibuat di `users/module.js` adalah **instance berbeda** dari `authService` yang dibuat di `auth/module.js`. Ini tidak masalah karena `AuthService` **stateless** — tidak ada shared mutable state, hanya berbagi DB client yang sama (singleton Prisma).

### Hindari Deep Chaining

```
OrderService → UserService → AuthService  ✅ (kedalaman 2)
OrderService → UserService → PostService → AuthService  ⚠️ (terlalu dalam, pertimbangkan desain ulang)
```

Jika dependency chain terlalu panjang, pertimbangkan untuk memindahkan logic ke `core/utils/` atau membuat service koordinator baru.

### Jangan Gunakan untuk Sekadar Query DB

```js
// ❌ Salah — ini seharusnya pakai repository langsung, bukan lewat UserService
const user = await this.userService.userRepository.findById(userId)

// ✅ Benar — akses langsung ke repository yang di-inject
const user = await this.userRepository.findById(userId)

// ✅ Benar — panggil service jika butuh business logic-nya
const user = await this.userService.getProfile(userId)  // includes NotFoundError logic
```

---

## Contoh Nyata di Codebase Ini

Lihat implementasi di:
- `src/modules/users/services/user.service.ts` — method `updateProfile()`, service-in-service ke `authService.revokeAllTokens()`
- `src/modules/users/module.ts` — wiring `AuthService` ke dalam `UserService`
- `src/modules/auth/services/auth.service.ts` — method `revokeAllTokens()` yang di-share
- `src/modules/auth/index.ts` — `AuthService` dan `createAuthRepository` di-export sebagai public API
