# Database: Drivers, Repository Pattern, and Transactions

> **v3.0.0 updates** (see `tutorial/22`): DB naming is **snake_case** — Prisma models keep PascalCase but map via `@@map`/`@map` (client access unchanged); Mongoose collections + fields are snake_case. RBAC tables are split into per-module fragments: `permission` (`permissions`), `menu` (`menus`, `menu_permissions`), `role` (`roles`, `role_menu_permissions`), `session` (`sessions`), `auth` (`users`, `user_roles`, `user_menu_permissions`). Cross-module FKs are **scalar columns (no `@relation`)** — reader/repos do step-wise joins, and cross-module cascades run in the service layer via `withTransaction`.

> **v2.0.0 updates** (see `tutorial/18`, `tutorial/21`):
> - **Fifth driver**: `sqlserver` (SQL Server 2017+) joins `sqlite`/`mysql`/`postgresql`/`mongodb`. `DB_DRIVER` enum in `env.config.ts` includes it; base block at `prisma/base/sqlserver.prisma`.
> - **Per-module schema**: each module owns `src/modules/{name}/db/{name}.prisma` (only `model` blocks). `src/core/database/schema-builder.ts` assembles `prisma/schema.prisma` from `prisma/base/{driver}.prisma` + enabled modules' fragments. **`prisma/schema.prisma` is auto-generated — do not edit by hand.** Fragments must be self-contained (no cross-module `@relation`; use scalar FK columns). The old `schema.mysql.prisma`/`schema.postgresql.prisma` copies are gone.
> - **Migration workflow**: `bun run db:sync` (validate deps → assemble → `prisma db push --accept-data-loss` → sync menu/permission catalog) and `bun run db:seed` (default roles + admin user). Disabling a module drops its tables and removes its catalog rows (bidirectional). For mongodb, `db:sync` runs catalog sync only.
> - **Auth schema**: `RefreshToken` replaced by `sessions` (SHA-256-hashed opaque tokens); added RBAC tables (`roles`, `user_roles`, `menus`, `permissions`, `menu_permissions`, `role_menu_permissions`). Catalog sync lives in `src/core/database/sync/`; RBAC reads in `src/core/rbac/rbac.reader.ts`.

## Dual-Driver Model

FastNG supports four databases via the `DB_DRIVER` environment variable:

| `DB_DRIVER` | Database | ORM/ODM | Schema File | Usage |
|---|---|---|---|---|
| `sqlite` | SQLite (local file) | Prisma | `prisma/schema.prisma` | Default, best for local dev |
| `mysql` | MySQL 8+ | Prisma | Copy `schema.mysql.prisma` → `schema.prisma` | Production alternative |
| `postgresql` | PostgreSQL 14+ | Prisma | Copy `schema.postgresql.prisma` → `schema.prisma` | Production alternative |
| `mongodb` | MongoDB 6+ | Mongoose | Schemas in `core/database/models/*.model.ts` | No schema migration needed |

### Prisma Databases (sqlite/mysql/postgresql)

All three use Prisma with a single schema file at `src/prisma/schema.prisma`. Reference variants are kept as:
- `src/prisma/schema.mysql.prisma`
- `src/prisma/schema.postgresql.prisma`

To switch between them, copy the target variant over `schema.prisma`, then run `bun run db:generate` and `bun run db:push` (or `bun run db:migrate`).

### MongoDB

When `DB_DRIVER=mongodb`, Prisma is not used. Instead:
- Set `MONGODB_URI` in `.env` (local: `mongodb://localhost:27017/db_name`, or MongoDB Atlas: `mongodb+srv://user:pass@cluster.mongodb.net/db_name`)
- Mongoose schemas live in `src/core/database/models/` (e.g. `user.model.ts`, `refresh-token.model.ts`)
- No migration/schema push needed — Mongoose auto-creates collections

## Repository Pattern

Every data-accessing module has three repository files:

### 1. Repository Interface & Factory (`{name}.repository.ts`)

Defines the interface contract and exports a factory function:

```ts
// src/modules/posts/repositories/post.repository.ts
export interface IPostRepository {
  findById(id: string): Promise<PostEntity | null>
  findAll(opts?: { limit?: number, offset?: number }): Promise<PostEntity[]>
  create(data: CreatePostData): Promise<PostEntity>
  update(id: string, data: UpdatePostData): Promise<PostEntity>
  delete(id: string): Promise<void>
  
  // For Prisma transactions only
  withClient(tx: TransactionClient): IPostRepository
}

// Factory: branches on DB_DRIVER to pick the right implementation
export function createPostRepository(db: any): IPostRepository {
  if (process.env.DB_DRIVER === 'mongodb') {
    return new PostMongoRepository()
  }
  return new PostPrismaRepository(db)  // db is PrismaClient
}
```

The factory is instantiated in `module.ts` and injected into the service.

### 2. Prisma Implementation (`{name}.prisma.repository.ts`)

Maps Prisma queries to Entity objects:

```ts
// src/modules/posts/repositories/post.prisma.repository.ts
import { PrismaClient } from '@prisma/client'
import { PostEntity } from '../entities/post.entity.js'
import { IPostRepository } from './post.repository.js'

export class PostPrismaRepository implements IPostRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<PostEntity | null> {
    const record = await this.prisma.post.findUnique({ where: { id } })
    return record ? this.toEntity(record) : null  // ✅ return null, don't throw
  }

  async create(data: CreatePostData): Promise<PostEntity> {
    const record = await this.prisma.post.create({ data })
    return this.toEntity(record)
  }
  
  // For transactions: return a new instance bound to the transaction client
  withClient(tx: TransactionClient): IPostRepository {
    return new PostPrismaRepository(tx)  // ✅ returns new bound instance
  }

  // Private mapper: ORM shape → Entity
  private toEntity(record: any): PostEntity {
    return new PostEntity({
      id: record.id,
      title: record.title,
      authorId: record.authorId,
      createdAt: record.createdAt,
    })
  }
}
```

**Key principles:**
- `findById` and similar read methods return `Entity | null`, never throw domain errors (throw `NotFoundError` in the service instead).
- The private `toEntity()` function is responsible for mapping Prisma records to Entity objects.
- For write operations, map Entity back to Prisma shape before calling `prisma.method()`.
- `withClient(tx)` returns a *new* instance bound to the transaction client, leaving the original on the normal connection.

### 3. Mongoose Implementation (`{name}.mongo.repository.ts`)

Same interface, using Mongoose instead:

```ts
// src/modules/posts/repositories/post.mongo.repository.ts
import { PostModel } from '../../core/database/models/post.model.js'
import { PostEntity } from '../entities/post.entity.js'
import { IPostRepository } from './post.repository.js'

export class PostMongoRepository implements IPostRepository {
  async findById(id: string): Promise<PostEntity | null> {
    const record = await PostModel.findById(id)
    return record ? this.toEntity(record) : null
  }

  async create(data: CreatePostData): Promise<PostEntity> {
    const record = await PostModel.create(data)
    return this.toEntity(record)
  }
  
  // Mongo: no-op (no transaction support in this setup)
  withClient(): IPostRepository {
    return this
  }

  private toEntity(record: any): PostEntity { ... }
}
```

**Note:** MongoDB's `withClient()` is a no-op returning `this` — MongoDB transactions require a replica set, which is beyond the scope of this boilerplate. If multi-repository atomicity is needed with MongoDB, document operations sequentially without transaction guarantees, or deploy MongoDB with a replica set.

## Repository Contract

All repository implementations follow these rules:

| Operation | Return Type | Behavior |
|---|---|---|
| `findById(id)` | `Entity \| null` | Return null if not found, never throw |
| `findAll(...)` | `Entity[]` | Return empty array if none found |
| `create(data)` | `Entity` | Throw DB constraint errors (e.g., unique violation), map to Entity |
| `update(id, data)` | `Entity` | Return the updated Entity, or throw DB errors; never throw domain errors |
| `delete(id)` | `void` | Don't check if exists (caller's responsibility via service) |
| `withClient(tx)` | `IRepository` | Return new bound instance (Prisma), or `this` (Mongo) |

**Important:** Repositories never throw domain errors like `NotFoundError`, `ForbiddenError`, or `ConflictError`. The service layer is responsible for translating `null` returns and other repository outcomes into appropriate domain errors.

## Database Transactions (Prisma Only)

For atomic multi-repository writes (e.g., create a post AND increment author's post count simultaneously), use `withTransaction()`:

```ts
// src/core/database/transaction.ts (already exists)
export async function withTransaction<T>(
  db: PrismaClient,
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return await db.$transaction(callback)
}
```

Usage in a service:

```ts
export class PostService {
  constructor(
    private deps: {
      postRepository: IPostRepository
      userRepository: IUserRepository
      db: PrismaClient  // injected from fastify.db
    }
  ) {}

  async createPostAndIncrement(authorId: string, data: CreatePostData): Promise<PostEntity> {
    return await withTransaction(this.deps.db, async (tx) => {
      // Get repository instances bound to the transaction
      const postRepo = this.deps.postRepository.withClient(tx)
      const userRepo = this.deps.userRepository.withClient(tx)
      
      // Both operations happen atomically
      const post = await postRepo.create({ ...data, authorId })
      await userRepo.incrementPostCount(authorId)
      
      return post
    })
  }
}
```

### Requirements for Transactional Code

1. Every Prisma repository involved must implement `withClient(tx): IRepository` returning a new bound instance.
2. The service must inject both repositories and the raw `db` (PrismaClient) via its constructor.
3. Inside the transaction callback, call `repository.withClient(tx)` to get a transaction-bound instance.
4. All writes must go through the transaction-bound instances.

### MongoDB Caveat

`withTransaction()` **throws an error** if called with the MongoDB driver (`db === null`):

```ts
if (!db) {
  throw new Error('Transactions are not supported for MongoDB. MongoDB requires a replica set.')
}
```

For MongoDB multi-document atomicity, rely on either:
- Individual document transactions (if supported by your ops setup)
- Accepting eventual consistency (sequential operations without atomicity)
- Migrating to Prisma with a SQL database

## Command Comparison: `db:push` vs `db:migrate`

| Command | Use Case | Creates Migration File | Rollback Support |
|---|---|---|---|
| `bun run db:push` | Local development, prototyping | No | No |
| `bun run db:migrate` | Production deployments | Yes | Yes |

**Development**: `bun run db:push` is faster and simpler.  
**Production**: Always use `bun run db:migrate` to create migration files for version control and rollback safety.

## Environment Variables

Set these in `.env`:

```env
# Database driver selection
DB_DRIVER=sqlite|mysql|postgresql|mongodb

# For Prisma (sqlite/mysql/postgresql)
DATABASE_URL=file:./prisma/dev.db|mysql://user:pass@host:3306/db|postgresql://user:pass@host:5432/db

# For MongoDB
MONGODB_URI=mongodb://localhost:27017/db_name
```

For complete tutorials and code samples, see `tutorial/08-ganti-database-driver.md` (driver switching) and `tutorial/14-multi-repo-db-transaction.md` (transactions).
