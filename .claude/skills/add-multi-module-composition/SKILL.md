# Skill: Add Multi-Module Composition (Transactions & Service-in-Service)

**Description**: Implement multi-repository database transactions and/or reuse another module's service within a service.

**Source tutorials**: [tutorial/14-multi-repo-db-transaction.md](../../../tutorial/14-multi-repo-db-transaction.md) and [tutorial/15-service-in-service.md](../../../tutorial/15-service-in-service.md)

---

## Part 1: Multi-Repository Transactions

Use this pattern when one business operation must atomically write to multiple tables/collections.

### Prerequisites

- All participating Prisma repositories must implement `withClient(tx): I{Name}Repository`
- Service must receive all repositories **and** the raw `db` (PrismaClient) via constructor
- Only works with Prisma drivers (throws for MongoDB)

### Example: Delete User + All Their Tokens Atomically

Service: `src/modules/users/services/user.service.ts`

```ts
import { withTransaction } from '../../core/database/transaction.js'
import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { IUserRepository } from '../repositories/user.repository.js'
import { IAuthRepository } from '../../auth/repositories/auth.repository.js'

export class UserService {
  constructor(
    private deps: {
      userRepository: IUserRepository
      authRepository: IAuthRepository  // ← from another module
      db: PrismaClient                 // ← raw Prisma client
    }
  ) {}

  async deleteUserAndRevokeAllTokens(userId: string): Promise<void> {
    // Wrap both operations in a transaction
    await withTransaction(this.deps.db, async (tx) => {
      // Get transaction-bound repository instances
      const userRepo = this.deps.userRepository.withClient(tx)
      const authRepo = this.deps.authRepository.withClient(tx)

      // Both operations happen atomically or both rollback
      await userRepo.delete(userId)
      await authRepo.deleteAllRefreshTokensForUser(userId)
    })
  }
}
```

Module: `src/modules/users/module.ts`

```ts
import { createUserRepository } from './repositories/user.repository.js'
import { createAuthRepository, AuthService } from '../auth/index.js'
import { FastifyInstance } from 'fastify'

export default async function usersModule(fastify: FastifyInstance) {
  // Create both repositories
  const userRepository = createUserRepository(fastify.db)
  const authRepository = createAuthRepository(fastify.db)

  // Create service with ALL dependencies injected
  const service = new UserService({
    userRepository,
    authRepository,
    db: fastify.db,  // ← raw client for withTransaction
  })

  const controller = new UserController(service)

  await fastify.register(
    async (instance) => {
      await userRoutes(instance, controller)
    },
    { prefix: '/api/v1/users' }
  )
}
```

### What `withClient(tx)` Does

Returns a **new repository instance** bound to the transaction client, leaving the original on the normal connection:

```ts
// Prisma repository
withClient(tx: TransactionClient): IPostRepository {
  return new PostPrismaRepository(tx)  // ← new instance, bound to tx
}

// Mongo repository (no-op for transactions)
withClient(): IPostRepository {
  return this  // ← just returns self
}
```

### MongoDB Caveat

`withTransaction()` throws an error if called with MongoDB (`db === null`):

```ts
if (!db) {
  throw new Error(
    'Transactions are not supported for MongoDB. ' +
    'MongoDB requires a replica set for multi-document transactions.'
  )
}
```

For MongoDB, either:
- Accept eventual consistency (operations happen sequentially)
- Deploy MongoDB with a replica set (ops team decision)
- Switch to a Prisma database (sqlite/mysql/postgresql)

---

## Part 2: Service-in-Service Composition

Reuse complex business logic from another module's service within your own service.

### Prerequisites

1. **Registry declares the dependency**: Your module's `dependsOn[]` includes the other module.
   ```ts
   // src/registry/module.registry.ts
   { name: 'users', enabled: true, ..., dependsOn: ['auth'] }  // ✅ OK
   { name: 'auth', enabled: true, ..., dependsOn: [] }
   
   // NOT OK: circular dependency
   { name: 'auth', enabled: true, ..., dependsOn: ['users'] }
   ```

2. **Service is exported from the other module's `index.ts`**:
   ```ts
   // src/modules/auth/index.ts
   export { AuthService } from './services/auth.service.js'
   ```

3. **Service is injected via constructor**, never instantiated inside another service.

### Example: Update Email + Revoke Sessions

User updates their email → all active sessions must be revoked (handled by auth service).

Service: `src/modules/users/services/user.service.ts`

```ts
import { AuthService } from '../../auth/index.js'
import { IUserRepository } from '../repositories/user.repository.js'
import { FastifyInstance } from 'fastify'

export class UserService {
  constructor(
    private deps: {
      userRepository: IUserRepository
      authService: AuthService  // ← injected from auth module
      fastify: FastifyInstance
    }
  ) {}

  async updateProfile(userId: string, data: UpdateProfileInput): Promise<UserEntity> {
    const user = await this.deps.userRepository.findById(userId)
    if (!user) throw new NotFoundError('User not found')

    const emailChanged = data.email && data.email !== user.email

    // Update the user
    const updated = await this.deps.userRepository.update(userId, data)

    // If email changed, revoke all sessions (use auth service)
    if (emailChanged) {
      await this.deps.authService.revokeAllTokens(userId)
      this.deps.fastify.log.info(`Revoked all tokens for user ${userId}`)
    }

    return updated
  }
}
```

Module: `src/modules/users/module.ts`

```ts
import { createUserRepository } from './repositories/user.repository.js'
import { createAuthRepository, AuthService } from '../auth/index.js'  // ← import from auth
import { FastifyInstance } from 'fastify'

export default async function usersModule(fastify: FastifyInstance) {
  // Create repositories
  const userRepository = createUserRepository(fastify.db)
  const authRepository = createAuthRepository(fastify.db)

  // Create AuthService instance (separate from auth module's instance)
  const authService = new AuthService(authRepository, fastify)

  // Create UserService with authService injected
  const userService = new UserService({
    userRepository,
    authService,  // ← injected
    fastify,
  })

  const controller = new UserController(userService)

  await fastify.register(
    async (instance) => {
      await userRoutes(instance, controller)
    },
    { prefix: '/api/v1/users' }
  )
}
```

### Rules

1. **Only flows in `dependsOn[]` direction** — if `users` depends on `auth`, users can use auth services. Not the reverse.
2. **Never instantiate a service inside another service**:
   ```ts
   // ❌ Wrong
   export class UserService {
     async updateProfile(userId, data) {
       const authService = new AuthService(...)  // ❌
       await authService.revokeAllTokens(userId)
     }
   }
   
   // ✅ Correct
   export class UserService {
     constructor(private deps: { authService: AuthService }) {}
     async updateProfile(...) {
       await this.deps.authService.revokeAllTokens(userId)
     }
   }
   ```

3. **Import only from the origin module's `index.ts`**:
   ```ts
   // ✅ Correct
   import { AuthService } from '../auth/index.js'
   
   // ❌ Wrong
   import { AuthService } from '../auth/services/auth.service.js'
   ```

4. **Wiring happens in `module.ts`**, not in the constructor of another service.

5. **Avoid chains deeper than 2** — A → B → C is OK, A → B → C → D suggests redesign (move logic to utils or a coordinator service).

### When NOT to Use Service Composition

**Wrong case**: Just reading from another module's repository.

```ts
// ❌ Wrong: don't use composition just for a DB read
export class UserService {
  constructor(private deps: { postService: PostService }) {}
  
  async getUserWithPostCount(userId: string) {
    const count = await this.deps.postService.countByUser(userId)  // ❌
    return { user, count }
  }
}

// ✅ Better: inject the repository directly
export class UserService {
  constructor(
    private deps: {
      userRepository: IUserRepository
      postRepository: IPostRepository  // ← direct repo injection
    }
  ) {}
  
  async getUserWithPostCount(userId: string) {
    const user = await this.deps.userRepository.findById(userId)
    const count = await this.deps.postRepository.countByAuthor(userId)
    return { user, count }
  }
}
```

Use service composition only when reusing **business logic** (not just DB reads).

## Combined Example: Create Post + Update User Stats

```ts
export class PostService {
  constructor(
    private deps: {
      postRepository: IPostRepository
      userRepository: IUserRepository
      userService: UserService  // ← service composition
      db: PrismaClient  // ← for transactions
    }
  ) {}

  async createPost(
    authorId: string,
    data: CreatePostInput
  ): Promise<PostEntity> {
    // Atomic: create post + increment user's post count
    const post = await withTransaction(this.deps.db, async (tx) => {
      const postRepo = this.deps.postRepository.withClient(tx)
      const userRepo = this.deps.userRepository.withClient(tx)

      // Create post
      const newPost = await postRepo.create({ ...data, authorId })

      // Update user stats via repository
      await userRepo.incrementPostCount(authorId)

      // Reuse user service logic: if 100th post, award badge
      if (await userRepo.getPostCount(authorId) === 100) {
        await this.deps.userService.awardBadge(authorId, 'century-author')
      }

      return newPost
    })

    return post
  }
}
```

For complete details, see the source tutorials.
