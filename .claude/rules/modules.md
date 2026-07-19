# Modules: Structure, Registry, and Lifecycle

> **v2.0.0 additions** (see `tutorial/18`, `tutorial/19`): a module may now also own —
> - `src/modules/{name}/{name}.manifest.ts` — `manifest: ModuleManifest` declaring sidebar `menu` metadata (or `menu: false` for service/helper modules) and supported `permissions[]`. Synced to the DB catalog bidirectionally by `bun run db:sync` (enabled ⇒ upsert, disabled ⇒ delete).
> - `src/modules/{name}/db/{name}.prisma` — the module's Prisma schema fragment (only `model` blocks; self-contained, no cross-module `@relation`). Assembled into `prisma/schema.prisma` (auto-generated) for enabled modules only. Disabling a module drops its tables on the next `bun run db:sync`.
>
> Dependency validation (`dependsOn` targets must be enabled) now runs both at boot and in the migration CLI via `src/registry/dependency-validator.ts`.

## Module Folder Skeleton

Every module lives under `src/modules/{name}/` and must follow this exact structure:

```
src/modules/{name}/
├── index.ts                              ← Public API (re-exports what other modules may import)
├── module.ts                             ← Fastify entry point (wires dependencies, registers routes)
├── entities/
│   └── {name}.entity.ts                  ← Pure domain object (e.g. post.entity.ts, user.entity.ts)
├── dto/
│   ├── {action}.request.dto.ts           ← Input validation (Zod + Fastify JSON Schema pair)
│   ├── {name}.response.dto.ts            ← Output mapper + shape (e.g. post.response.dto.ts)
│   └── {name}.query.dto.ts               ← Query params validation (if needed)
├── repositories/
│   ├── {name}.repository.ts              ← Interface definition + factory function
│   ├── {name}.prisma.repository.ts       ← Prisma implementation
│   └── {name}.mongo.repository.ts        ← Mongoose implementation
├── services/
│   └── {name}.service.ts                 ← Business logic layer
├── controllers/
│   └── {name}.controller.ts              ← HTTP request handling
├── routes/
│   └── {name}.routes.ts                  ← Fastify route definitions
└── jobs/ (optional)
    ├── cleanup.job.ts                    ← toad-scheduler job (if needed)
    └── report.job.ts
```

**Note**: The `jobs/` folder is optional and only created if the module needs scheduled tasks (see `.claude/rules/auth-and-jobs.md` for details).

## File Naming Conventions

| File Type | Pattern | Example |
|-----------|---------|---------|
| Entity | `{singular}.entity.ts` | `post.entity.ts`, `user.entity.ts` |
| Prisma Repo | `{singular}.prisma.repository.ts` | `post.prisma.repository.ts` |
| Mongo Repo | `{singular}.mongo.repository.ts` | `post.mongo.repository.ts` |
| Factory Repo | `{singular}.repository.ts` | `post.repository.ts` |
| Service | `{singular}.service.ts` | `post.service.ts` |
| Controller | `{singular}.controller.ts` | `post.controller.ts` |
| Routes | `{singular}.routes.ts` | `post.routes.ts` |
| Request DTO | `{action}.request.dto.ts` | `create-post.request.dto.ts`, `update-post.request.dto.ts` |
| Response DTO | `{singular}.response.dto.ts` | `post.response.dto.ts` |
| Query DTO | `{singular}.query.dto.ts` | `post.query.dto.ts` |
| Job | `{action}.job.ts` | `cleanup.job.ts`, `daily-report.job.ts` |

## Module Registration (Registry System)

Every module must be declared in `src/registry/module.registry.ts`:

```ts
interface ModuleConfig {
  name: string                    // Unique identifier (used in dependsOn arrays)
  enabled: boolean                // true = load at startup, false = skip
  path: string                    // Relative path from src/registry/ to module.js (MUST end in .js)
  dependsOn: string[]             // Array of module names this module requires to load first
}

const modules: ModuleConfig[] = [
  { 
    name: 'auth',
    enabled: true,
    path: '../modules/auth/module.js',      // ✅ ends in .js even though source is .ts
    dependsOn: []                           // auth has no dependencies
  },
  {
    name: 'users',
    enabled: true,
    path: '../modules/users/module.js',
    dependsOn: ['auth']                     // users depends on auth (must load after)
  },
  {
    name: 'posts',
    enabled: process.env.POSTS_ENABLED === 'true',  // Optional: feature flag
    path: '../modules/posts/module.js',
    dependsOn: ['auth', 'users']            // posts depends on both auth and users
  },
]
```

### Registry Rules

- **`name`**: Unique identifier, used to reference the module in `dependsOn[]` arrays.
- **`enabled`**: Boolean or expression. When `false`, the module is skipped at load time and its routes never register.
- **`path`**: Relative path from `src/registry/` to the module's `module.js` file. Must always end in `.js` extension (even though the source is `.ts`) — this is NodeNext ESM convention; `tsx` resolves `.js` → `.ts` at dev time.
- **`dependsOn`**: Array of module names. The loader validates that all declared dependencies are also `enabled: true` at boot time. If not, the server fails to start with a clear error message.

## Module Loader (Topological Sort)

`src/registry/module.loader.ts` orchestrates the module lifecycle:

1. **Filter** enabled modules (skip those with `enabled: false`).
2. **Validate** that all modules in `dependsOn[]` are enabled (throw error if not).
3. **Topological sort** (Kahn's algorithm) to determine load order respecting `dependsOn[]` relationships.
4. **Dynamic import** each module in resolved order via `import(module.path)`.
5. **Register** each module's default export (the `{name}Module` async function) with `fastify.register()` in order.

This ensures dependencies load before modules that need them, and the whole process is transparent — no manual `app.ts` edits needed.

### Validation Example

```ts
// ✅ Valid registry (all dependsOn modules are enabled)
{ name: 'posts', enabled: true, path: '...', dependsOn: ['auth', 'users'] }
{ name: 'auth', enabled: true, ... }
{ name: 'users', enabled: true, dependsOn: ['auth'], ... }

// ❌ Invalid (posts depends on a disabled module)
{ name: 'posts', enabled: true, ..., dependsOn: ['auth'] }
{ name: 'auth', enabled: false, ... }  // ← loader throws error at startup
```

## Module.ts Responsibility

The module entry point (`module.ts`) wires dependencies and registers routes:

```ts
// src/modules/posts/module.ts
import { FastifyInstance } from 'fastify'
import { createPostRepository } from './repositories/post.repository.js'
import { PostService } from './services/post.service.js'
import { PostController } from './controllers/post.controller.js'
import { postRoutes } from './routes/post.routes.js'
import { createCleanupJob } from './jobs/cleanup.job.js'

export default async function postsModule(fastify: FastifyInstance): Promise<void> {
  // 1. Instantiate repository via factory (branches on DB_DRIVER)
  const repository = createPostRepository(fastify.db)
  
  // 2. Instantiate service, passing repository + fastify (for plugins)
  const service = new PostService(repository, fastify)
  
  // 3. Instantiate controller, passing service
  const controller = new PostController(service)
  
  // 4. Register routes with prefix
  await fastify.register(
    async (instance) => {
      await postRoutes(instance, controller)
      
      // 5. (Optional) Register scheduled jobs
      if (instance.scheduler) {
        const cleanupJob = createCleanupJob(instance)
        instance.scheduler.addSimpleIntervalJob(cleanupJob)
        instance.log.info('Cleanup job registered')
      }
    },
    { prefix: '/api/v1/posts' }
  )
}
```

**Key principles:**
- Repository is instantiated via a factory (not directly).
- Service receives the repository and fastify instance.
- Controller receives the service.
- Routes are registered inside a `fastify.register()` callback with a `/api/v1/{name}` prefix.
- Scheduled jobs (if any) are registered inside the same callback, guarded by `if (instance.scheduler)`.

## Index.ts (Public API)

The module's `index.ts` is the *only* file that other modules are allowed to import:

```ts
// src/modules/posts/index.ts
export { PostService } from './services/post.service.js'
export { createPostRepository } from './repositories/post.repository.js'
export type { IPostRepository } from './repositories/post.repository.js'
```

**What to export:**
- Service class (if other modules will use its logic)
- Repository factory function
- Repository interface type (`export type { I... }`)

**What NOT to export:**
- Internal entities, DTOs, controllers, routes, or implementation details
- Anything that violates the public API contract

Other modules access this module **only** via imports from `index.ts`:

```ts
// ✅ Correct
import { PostService, createPostRepository } from '../posts/index.js'

// ❌ Wrong (internal file access)
import { PostService } from '../posts/services/post.service.js'
```

## Enable/Disable a Module

To enable or disable a module, toggle `enabled` in `src/registry/module.registry.ts`:

```ts
// To disable
{ name: 'posts', enabled: false, ... }  // Routes won't register, module won't load

// To enable
{ name: 'posts', enabled: true, ... }
```

On server restart, the module will or won't load. Check the boot logs for `[ModuleLoader] Loading module: posts` (or absence thereof).

**Feature flag pattern** (optional):

```ts
{ 
  name: 'payments',
  enabled: process.env.PAYMENTS_MODULE_ENABLED === 'true',
  path: '../modules/payments/module.js',
  dependsOn: ['auth']
}
```

Then in `.env`: `PAYMENTS_MODULE_ENABLED=true` or `false`.

## Full Workflow: Adding a New Module

For a step-by-step walkthrough, see `.claude/skills/add-module/SKILL.md` or `tutorial/01-menambah-modul-baru.md`.

For complete references and code examples, see `tutorial/01-menambah-modul-baru.md` and `tutorial/02-mengaktifkan-menonaktifkan-modul.md` (Indonesian).
